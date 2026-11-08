-- Test yakunida o‘quvchiga shu test bo‘yicha reyting ko‘rsatiladi.
-- Har bir ishtirokchi (telefon raqami bo‘yicha) reytingda bir marta, eng yaxshi natijasi bilan turadi.
-- Tartib: foiz ↓, to‘g‘ri javoblar ↓, sarflangan vaqt ↑ (vaqtli testda). Teng natijalar bir xil o‘rinni oladi.
-- Vaqtdan oshib yuborilgan natijalar reytingga kirmaydi. Telefon raqamlari hech qachon qaytarilmaydi,
-- ism esa qisqartiriladi: «Nodira Karimova» → «Nodira K.».

create or replace function private.short_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  with n as (select btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')) as v)
  select case
    when v = '' then 'Ishtirokchi'
    when split_part(v, ' ', 2) = '' then upper(left(v, 1)) || substr(left(v, 40), 2)
    else upper(left(v, 1)) || substr(left(split_part(v, ' ', 1), 40), 2) || ' ' || upper(left(split_part(v, ' ', 2), 1)) || '.'
  end
  from n
$$;

create or replace function private.test_leaderboard(
  p_test_id bigint, p_phone text, p_result_id bigint default null, p_limit integer default 10
) returns jsonb
language sql stable set search_path = '' as $$
  with best as (
    select distinct on (k.pkey)
           k.pkey, r.id, r.full_name, r.percentage, r.correct_answers, r.total_questions,
           r.duration_seconds, r.created_at
      from private.test_results r
      cross join lateral (select regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') as pkey) k
     where r.test_id = p_test_id and not r.overtime and k.pkey <> ''
     order by k.pkey, r.percentage desc, r.correct_answers desc,
              coalesce(r.duration_seconds, 2147483647), r.created_at
  ), ranked as (
    select b.*,
           rank() over (order by b.percentage desc, b.correct_answers desc,
                                 coalesce(b.duration_seconds, 2147483647)) as place,
           row_number() over (order by b.percentage desc, b.correct_answers desc,
                                       coalesce(b.duration_seconds, 2147483647), b.created_at) as pos
      from best b
  ), me as (
    select * from ranked
     where pkey = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  )
  select jsonb_build_object(
    'participants', (select count(*) from ranked),
    'your_rank', (select place from me),
    'this_attempt_counts', coalesce((select id = p_result_id from me), false),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', x.place, 'name', private.short_name(x.full_name),
               'percentage', x.percentage, 'correct', x.correct_answers, 'total', x.total_questions,
               'duration_seconds', x.duration_seconds,
               'is_you', coalesce(x.pkey = (select pkey from me), false)) order by x.pos)
        from ranked x where x.pos <= greatest(1, least(coalesce(p_limit, 10), 50))), '[]'::jsonb),
    'you', (
      select jsonb_build_object(
               'rank', m.place, 'name', private.short_name(m.full_name),
               'percentage', m.percentage, 'correct', m.correct_answers, 'total', m.total_questions,
               'duration_seconds', m.duration_seconds, 'is_you', true)
        from me m where m.pos > greatest(1, least(coalesce(p_limit, 10), 50)))
  )
$$;

create or replace function public.submit_test(
  p_test_id bigint, p_full_name text, p_phone text, p_answers jsonb, p_attempt text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_phone text;
  v_total integer;
  v_correct integer;
  v_pct numeric(5,2);
  v_clean jsonb;
  v_test private.online_tests;
  v_token text;
  a private.test_attempts;
  v_duration integer;
  v_limit integer;
  v_over boolean := false;
  v_id bigint;
begin
  select * into v_test from private.online_tests where id = p_test_id and is_active;
  if v_test.id is null then
    perform private.fail('PT404', 'Test topilmadi yoki hozir faol emas');
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    perform private.fail('PT400', 'Javoblar yuborilmadi');
  end if;
  if v_test.time_mode <> 'none' then
    select * into a from private.test_attempts
     where token_hash = encode(extensions.digest(coalesce(p_attempt, ''), 'sha256'), 'hex') and test_id = p_test_id
     for update;
    if a.token_hash is null then
      perform private.fail('PT400', 'Vaqt hisobi topilmadi. Testni qaytadan boshlang');
    end if;
    if a.finished_at is not null then
      perform private.fail('PT409', 'Bu urinish allaqachon yakunlangan');
    end if;
    v_name := a.full_name;
    v_phone := a.phone;
    v_limit := a.limit_seconds;
    v_duration := least(floor(extract(epoch from (now() - a.started_at)))::integer, 36000);
    v_over := v_duration > a.limit_seconds + 60;
    update private.test_attempts set finished_at = now() where token_hash = a.token_hash;
  else
    v_name := private.require_name(p_full_name);
    v_phone := private.normalize_phone(p_phone);
    perform private.rate_limit('test:' || p_test_id, v_phone, 10, interval '1 day');
  end if;
  select count(*),
         count(*) filter (where upper(p_answers ->> q.id::text) = q.correct_option),
         coalesce(jsonb_object_agg(q.id::text, upper(p_answers ->> q.id::text))
                  filter (where upper(p_answers ->> q.id::text) in ('A','B','C','D')), '{}'::jsonb)
    into v_total, v_correct, v_clean
    from private.test_questions q where q.test_id = p_test_id;
  if v_total = 0 then
    perform private.fail('PT400', 'Bu testda hali savollar yo‘q');
  end if;
  v_pct := round(v_correct * 100.0 / v_total, 2);
  insert into private.test_results(test_id, full_name, phone, total_questions, correct_answers, percentage, answers,
                                   time_limit_seconds, duration_seconds, overtime)
  values (p_test_id, v_name, v_phone, v_total, v_correct, v_pct, v_clean, v_limit, v_duration, v_over)
  returning id into v_id;
  if v_test.file_id is not null and v_test.file_visibility = 'after' then
    delete from private.file_grants where expires_at < now();
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into private.file_grants(token_hash, test_id, expires_at)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_test_id, now() + interval '24 hours');
  end if;
  return jsonb_build_object('total', v_total, 'correct', v_correct, 'percentage', v_pct,
                            'duration_seconds', v_duration, 'limit_seconds', v_limit, 'overtime', v_over,
                            'file_token', v_token,
                            'file_open', v_test.file_id is not null and v_test.file_visibility = 'always'
                                         and v_test.time_mode = 'none',
                            'leaderboard', private.test_leaderboard(p_test_id, v_phone, v_id, 10));
end $$;

revoke all on function private.short_name(text) from public;
revoke all on function private.test_leaderboard(bigint, text, bigint, integer) from public;
