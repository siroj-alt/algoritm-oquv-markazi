-- =====================================================================
-- Test vaqti: admin belgilaydi yoki o‘quvchi o‘zi tanlaydi.
-- Savolli testlarda ham, faqat fayldan (PDF/Word) iborat testlarda ham.
-- Vaqt serverda hisoblanadi: urinish (attempt) boshlangan vaqt saqlanadi,
-- sahifani yangilash yoki qayta kirish vaqtni qaytadan boshlamaydi.
-- =====================================================================

alter table private.online_tests add column if not exists time_mode text not null default 'none';
alter table private.online_tests add column if not exists time_limit_minutes integer;
do $$ begin
  alter table private.online_tests add constraint online_tests_time_mode_check check (time_mode in ('none', 'admin', 'student'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table private.online_tests add constraint online_tests_time_limit_check check (time_limit_minutes between 1 and 600);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table private.online_tests add constraint online_tests_time_admin_check check (time_mode <> 'admin' or time_limit_minutes is not null);
exception when duplicate_object then null; end $$;

create table if not exists private.test_attempts (
  token_hash text primary key,
  test_id bigint not null references private.online_tests(id) on delete cascade,
  full_name text,
  phone text,
  started_at timestamptz not null default now(),
  limit_seconds integer not null constraint test_attempts_limit_check check (limit_seconds between 60 and 36000),
  chosen_by text not null constraint test_attempts_chosen_check check (chosen_by in ('admin', 'student')),
  finished_at timestamptz
);
create index if not exists test_attempts_lookup_idx on private.test_attempts (test_id, phone, started_at desc);
create index if not exists test_attempts_started_idx on private.test_attempts (started_at);
alter table private.test_attempts enable row level security;
revoke all on private.test_attempts from public;

alter table private.test_results add column if not exists time_limit_seconds integer;
alter table private.test_results add column if not exists duration_seconds integer;
alter table private.test_results add column if not exists overtime boolean not null default false;

-- ---------------------------------------------------------------------
create or replace function private.questions_json(p_test_id bigint) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'text', q.question_text,
           'a', q.option_a, 'b', q.option_b, 'c', q.option_c, 'd', q.option_d)
         order by q.sort_order, q.id), '[]'::jsonb)
    from private.test_questions q where q.test_id = p_test_id;
$$;

create or replace function public.site_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', private.settings_json(),
    'courses', coalesce((
      select jsonb_agg(private.course_json(c) order by c.sort_order, c.id)
        from private.courses c where c.is_active), '[]'::jsonb),
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'title', t.title, 'description', t.description,
               'questions', (select count(*) from private.test_questions q where q.test_id = t.id),
               'file_mime', case when t.file_id is not null and t.file_visibility <> 'hidden' then m.mime end,
               'file_only', not exists (select 1 from private.test_questions q where q.test_id = t.id),
               'time_mode', t.time_mode, 'time_limit_minutes', t.time_limit_minutes)
             order by t.id desc)
        from private.online_tests t
        left join private.media m on m.id = t.file_id
       where t.is_active
         and (exists (select 1 from private.test_questions q where q.test_id = t.id)
              or (t.file_id is not null and t.file_visibility = 'always'))),
      '[]'::jsonb)
  );
$$;

-- Vaqtli testlarda savollar oldindan berilmaydi — faqat «Boshlash»dan keyin
create or replace function public.get_test(p_test_id bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'id', t.id, 'title', t.title, 'description', t.description,
           'time_mode', t.time_mode, 'time_limit_minutes', t.time_limit_minutes,
           'question_count', (select count(*) from private.test_questions q where q.test_id = t.id),
           'file', case when t.file_id is not null and t.file_visibility <> 'hidden'
                        then jsonb_build_object('name', t.file_name, 'mime', m.mime, 'visibility', t.file_visibility) end,
           'questions', case when t.time_mode = 'none' then private.questions_json(t.id) else '[]'::jsonb end)
    into v
    from private.online_tests t
    left join private.media m on m.id = t.file_id
   where t.id = p_test_id and t.is_active;
  if v is null then
    perform private.fail('PT404', 'Test topilmadi yoki hozir faol emas');
  end if;
  return v;
end $$;

create or replace function public.start_test(p_test_id bigint, p_full_name text default null,
                                             p_phone text default null, p_minutes integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t private.online_tests;
  v_has_q boolean;
  v_limit integer;
  v_name text;
  v_phone text;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_hash text;
  a private.test_attempts;
  v_started timestamptz := now();
  v_file_token text;
begin
  select * into t from private.online_tests where id = p_test_id and is_active;
  if t.id is null then
    perform private.fail('PT404', 'Test topilmadi yoki hozir faol emas');
  end if;
  if t.time_mode = 'none' then
    perform private.fail('PT400', 'Bu test vaqt bilan cheklanmagan');
  end if;
  v_has_q := exists (select 1 from private.test_questions q where q.test_id = t.id);
  if not v_has_q and not (t.file_id is not null and t.file_visibility = 'always') then
    perform private.fail('PT404', 'Bu testda hali savol yoki fayl yo‘q');
  end if;
  if t.time_mode = 'admin' then
    v_limit := t.time_limit_minutes * 60;
  else
    if p_minutes is null or p_minutes < 1 or p_minutes > 300 then
      perform private.fail('PT400', 'Vaqtni 1 daqiqadan 300 daqiqagacha tanlang');
    end if;
    v_limit := p_minutes * 60;
  end if;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  delete from private.test_attempts where started_at < now() - interval '7 days';

  if v_has_q then
    v_name := private.require_name(p_full_name);
    v_phone := private.normalize_phone(p_phone);
    -- Tugallanmagan urinish bo‘lsa — o‘sha vaqtdan davom etadi
    select * into a from private.test_attempts
     where test_id = t.id and phone = v_phone and finished_at is null
       and started_at + make_interval(secs => limit_seconds + 60) > now()
     order by started_at desc limit 1
     for update;
    if a.token_hash is not null and (t.time_mode = 'admin' or a.limit_seconds = v_limit) then
      update private.test_attempts set token_hash = v_hash where token_hash = a.token_hash;
      v_started := a.started_at;
      v_limit := a.limit_seconds;
    else
      perform private.rate_limit('start:' || t.id, v_phone, 20, interval '1 day');
      insert into private.test_attempts(token_hash, test_id, full_name, phone, limit_seconds, chosen_by)
      values (v_hash, t.id, v_name, v_phone, v_limit, t.time_mode)
      returning started_at into v_started;
    end if;
  end if;

  if t.file_id is not null and t.file_visibility = 'always' then
    v_file_token := encode(extensions.gen_random_bytes(24), 'hex');
    delete from private.file_grants where expires_at < now();
    insert into private.file_grants(token_hash, test_id, expires_at)
    values (encode(extensions.digest(v_file_token, 'sha256'), 'hex'), t.id,
            v_started + make_interval(secs => v_limit + 60));
  end if;

  return jsonb_build_object(
    'attempt', case when v_has_q then v_token end,
    'limit_seconds', v_limit,
    'remaining_seconds', greatest(0, floor(extract(epoch from (v_started + make_interval(secs => v_limit) - now()))))::integer,
    'file_token', v_file_token,
    'questions', case when v_has_q then private.questions_json(t.id) end);
end $$;

drop function if exists public.submit_test(bigint, text, text, jsonb);
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
  values (p_test_id, v_name, v_phone, v_total, v_correct, v_pct, v_clean, v_limit, v_duration, v_over);
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
                                         and v_test.time_mode = 'none');
end $$;

-- Vaqtli testning fayli faqat «Boshlash»dan keyin (vaqt tugaguncha) ochiladi
create or replace function public.get_test_file(p_test_id bigint, p_token text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t private.online_tests;
  v jsonb;
  v_granted boolean;
begin
  select * into t from private.online_tests where id = p_test_id and is_active;
  if t.id is null or t.file_id is null or t.file_visibility = 'hidden' then
    perform private.fail('PT404', 'Fayl topilmadi');
  end if;
  v_granted := exists (
    select 1 from private.file_grants g
     where g.test_id = t.id and g.expires_at > now()
       and g.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex'));
  if not v_granted and not (t.file_visibility = 'always' and t.time_mode = 'none') then
    if t.file_visibility = 'after' then
      perform private.fail('PT403', 'Bu fayl testni yakunlagandan keyin ochiladi');
    end if;
    perform private.fail('PT403', 'Faylni ko‘rish uchun testni boshlang. Vaqt tugagach fayl yopiladi');
  end if;
  select jsonb_build_object('name', t.file_name, 'mime', m.mime, 'data', encode(m.data, 'base64'),
                            'visibility', t.file_visibility, 'title', t.title)
    into v from private.media m where m.id = t.file_id;
  return v;
end $$;

-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public;
do $$
declare
  f text;
  fns text[] := array[
    'public.site_data()',
    'public.get_test(bigint)',
    'public.start_test(bigint, text, text, integer)',
    'public.submit_test(bigint, text, text, jsonb, text)',
    'public.get_test_file(bigint, text)'
  ];
begin
  foreach f in array fns loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from authenticated', f);
      execute format('grant execute on function %s to anon', f);
    end if;
  end loop;
end $$;
