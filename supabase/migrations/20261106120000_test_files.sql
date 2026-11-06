-- =====================================================================
-- Test fayllari: testga fayl biriktirish (o‘quvchilar ko‘rishi uchun),
-- fayldan savollarni ommaviy qo‘shish, 2–4 variantli savollar.
-- =====================================================================

-- 1. Hujjat turlari
alter table private.media drop constraint if exists media_kind_check;
alter table private.media add constraint media_kind_check check (kind in ('image', 'receipt', 'document'));
alter table private.media drop constraint if exists media_mime_check;
alter table private.media add constraint media_mime_check
  check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'));

-- 2. Testga biriktirilgan fayl va uning ko‘rinishi
alter table private.online_tests add column if not exists file_id uuid references private.media(id) on delete set null;
alter table private.online_tests add column if not exists file_name text;
alter table private.online_tests add column if not exists file_visibility text not null default 'after';
do $$ begin
  alter table private.online_tests add constraint online_tests_file_name_check check (char_length(file_name) <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table private.online_tests add constraint online_tests_file_visibility_check
    check (file_visibility in ('hidden', 'after', 'always'));
exception when duplicate_object then null; end $$;
create index if not exists online_tests_file_idx on private.online_tests (file_id);

-- 3. Savollarda 2–4 variant (C va D ixtiyoriy)
alter table private.test_questions alter column option_c drop not null;
alter table private.test_questions alter column option_d drop not null;
do $$ begin
  alter table private.test_questions add constraint test_questions_options_order check (option_d is null or option_c is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table private.test_questions add constraint test_questions_correct_present
    check ((correct_option <> 'C' or option_c is not null) and (correct_option <> 'D' or option_d is not null));
exception when duplicate_object then null; end $$;

-- 4. «Testdan keyin ochiladi» fayllar uchun vaqtinchalik ruxsatlar
create table if not exists private.file_grants (
  token_hash text primary key,
  test_id bigint not null references private.online_tests(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists file_grants_expires_idx on private.file_grants (expires_at);
alter table private.file_grants enable row level security;
revoke all on private.file_grants from public;

-- ---------------------------------------------------------------------
-- Fayllarni tekshirish (hujjatlar qo‘shildi)
-- ---------------------------------------------------------------------
create or replace function private.decode_file(p_b64 text, p_mime text, p_kind text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_bytes bytea;
  v_id uuid;
begin
  if not (
       (p_kind = 'image' and p_mime in ('image/jpeg', 'image/png', 'image/webp'))
    or (p_kind = 'receipt' and p_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
    or (p_kind = 'document' and p_mime in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'))
  ) then
    perform private.fail('PT400', case when p_kind = 'document'
      then 'Fayl turi noto‘g‘ri. Word (.docx), PDF yoki .txt yuklang'
      else 'Fayl turi noto‘g‘ri. JPG, PNG, WEBP yoki PDF yuklang' end);
  end if;
  begin
    v_bytes := decode(p_b64, 'base64');
  exception when others then
    perform private.fail('PT400', 'Fayl buzilgan yoki noto‘g‘ri yuborilgan');
  end;
  if v_bytes is null or length(v_bytes) = 0 then
    perform private.fail('PT400', 'Fayl bo‘sh');
  end if;
  if length(v_bytes) > 3500000 then
    perform private.fail('PT400', 'Fayl hajmi 3 MB dan oshmasin');
  end if;
  if not (
       (p_mime = 'image/jpeg' and substring(v_bytes from 1 for 3) = '\xffd8ff'::bytea)
    or (p_mime = 'image/png' and substring(v_bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea)
    or (p_mime = 'image/webp' and substring(v_bytes from 1 for 4) = '\x52494646'::bytea
                              and substring(v_bytes from 9 for 4) = '\x57454250'::bytea)
    or (p_mime = 'application/pdf' and substring(v_bytes from 1 for 4) = '\x25504446'::bytea)
    or (p_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and substring(v_bytes from 1 for 4) = '\x504b0304'::bytea)
    or (p_mime = 'text/plain' and position('\x00'::bytea in v_bytes) = 0)
  ) then
    perform private.fail('PT400', 'Fayl tarkibi tanlangan turga mos emas');
  end if;
  insert into private.media(kind, mime, size_bytes, data, is_public)
  values (p_kind, p_mime, length(v_bytes), v_bytes, p_kind = 'image')
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Ommaviy funksiyalar
-- ---------------------------------------------------------------------
create or replace function public.get_test(p_test_id bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'id', t.id, 'title', t.title, 'description', t.description,
           'file', case when t.file_id is not null and t.file_visibility <> 'hidden'
                        then jsonb_build_object('name', t.file_name, 'mime', m.mime, 'visibility', t.file_visibility) end,
           'questions', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', q.id, 'text', q.question_text,
                      'a', q.option_a, 'b', q.option_b, 'c', q.option_c, 'd', q.option_d)
                    order by q.sort_order, q.id)
               from private.test_questions q where q.test_id = t.id), '[]'::jsonb))
    into v
    from private.online_tests t
    left join private.media m on m.id = t.file_id
   where t.id = p_test_id and t.is_active;
  if v is null then
    perform private.fail('PT404', 'Test topilmadi yoki hozir faol emas');
  end if;
  return v;
end $$;

create or replace function public.submit_test(
  p_test_id bigint, p_full_name text, p_phone text, p_answers jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := private.require_name(p_full_name);
  v_phone text := private.normalize_phone(p_phone);
  v_total integer;
  v_correct integer;
  v_pct numeric(5,2);
  v_clean jsonb;
  v_test private.online_tests;
  v_token text;
begin
  select * into v_test from private.online_tests where id = p_test_id and is_active;
  if v_test.id is null then
    perform private.fail('PT404', 'Test topilmadi yoki hozir faol emas');
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    perform private.fail('PT400', 'Javoblar yuborilmadi');
  end if;
  perform private.rate_limit('test:' || p_test_id, v_phone, 10, interval '1 day');
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
  insert into private.test_results(test_id, full_name, phone, total_questions, correct_answers, percentage, answers)
  values (p_test_id, v_name, v_phone, v_total, v_correct, v_pct, v_clean);
  if v_test.file_id is not null and v_test.file_visibility = 'after' then
    delete from private.file_grants where expires_at < now();
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into private.file_grants(token_hash, test_id, expires_at)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_test_id, now() + interval '24 hours');
  end if;
  return jsonb_build_object('total', v_total, 'correct', v_correct, 'percentage', v_pct,
                            'file_token', v_token,
                            'file_open', v_test.file_id is not null and v_test.file_visibility = 'always');
end $$;

create or replace function public.get_test_file(p_test_id bigint, p_token text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t private.online_tests;
  v jsonb;
begin
  select * into t from private.online_tests where id = p_test_id and is_active;
  if t.id is null or t.file_id is null or t.file_visibility = 'hidden' then
    perform private.fail('PT404', 'Fayl topilmadi');
  end if;
  if t.file_visibility = 'after' and not exists (
       select 1 from private.file_grants g
        where g.test_id = t.id and g.expires_at > now()
          and g.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')) then
    perform private.fail('PT403', 'Bu fayl testni yakunlagandan keyin ochiladi');
  end if;
  select jsonb_build_object('name', t.file_name, 'mime', m.mime, 'data', encode(m.data, 'base64'),
                            'visibility', t.file_visibility, 'title', t.title)
    into v from private.media m where m.id = t.file_id;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Admin funksiyalari
-- ---------------------------------------------------------------------
create or replace function public.admin_save(p_token text, p_entity text, p_id bigint, p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_table text;
  v_cols text[];
  v_list text;
  v_row jsonb;
  v_data jsonb := private.clean_payload(p_data);
  v_constraint text;
  v_column text;
begin
  perform private.require_admin(p_token);
  v_table := case p_entity
    when 'courses' then 'courses'
    when 'groups' then 'study_groups'
    when 'students' then 'students'
    when 'payments' then 'payments'
    when 'attendance' then 'attendance'
    when 'tests' then 'online_tests'
    when 'questions' then 'test_questions'
  end;
  if v_table is null then
    perform private.fail('PT404', 'Bu bo‘limni tahrirlab bo‘lmaydi');
  end if;

  if p_entity = 'students' then
    if v_data ? 'phone' then
      v_data := v_data || jsonb_build_object('phone', private.normalize_phone(v_data ->> 'phone'));
    end if;
    if p_id is null and not v_data ? 'source' then
      v_data := v_data || '{"source":"admin"}'::jsonb;
    end if;
  elsif p_entity = 'questions' and v_data ? 'correct_option' then
    v_data := v_data || jsonb_build_object('correct_option', upper(v_data ->> 'correct_option'));
  elsif p_entity = 'payments' and v_data ? 'for_month' and (v_data ->> 'for_month') ~ '^\d{4}-\d{2}$' then
    v_data := v_data || jsonb_build_object('for_month', (v_data ->> 'for_month') || '-01');
  end if;

  select array_agg(column_name::text order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'private' and table_name = v_table
     and column_name::text not in ('id', 'created_at', 'updated_at', 'request_id', 'enrolled_at', 'file_id')
     and v_data ? column_name::text;
  if v_cols is null then
    perform private.fail('PT400', 'Saqlash uchun ma’lumot yuborilmadi');
  end if;
  select string_agg(format('%I', c), ', ') into v_list from unnest(v_cols) c;

  begin
    if p_id is null then
      execute format('insert into private.%I (%s) select %s from jsonb_populate_record(null::private.%I, $1) returning to_jsonb(%I.*)',
                     v_table, v_list, v_list, v_table, v_table)
         into v_row using v_data;
    else
      execute format('update private.%I t set (%s) = (select %s from jsonb_populate_record(null::private.%I, $1)) where t.id = $2 returning to_jsonb(t.*)',
                     v_table, v_list, v_list, v_table)
         into v_row using v_data, p_id;
      if v_row is null then
        perform private.fail('PT404', 'Yozuv topilmadi. Sahifani yangilang');
      end if;
    end if;
  exception
    when foreign_key_violation then
      perform private.fail('PT409', 'Tanlangan bog‘liq ma’lumot (kurs, guruh, o‘quvchi yoki test) topilmadi');
    when not_null_violation then
      get stacked diagnostics v_column = column_name;
      perform private.fail('PT400', 'Majburiy maydon to‘ldirilmagan: ' || coalesce(v_column, ''));
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      perform private.fail('PT400', 'Maydon qiymati talabga mos emas (' || coalesce(v_constraint, '') || ')');
    when unique_violation then
      perform private.fail('PT409', 'Bunday yozuv allaqachon mavjud (masalan, shu kunga davomat kiritilgan)');
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
         or numeric_value_out_of_range or invalid_parameter_value then
      perform private.fail('PT400', 'Maydonlardan biri noto‘g‘ri formatda kiritilgan');
  end;
  return v_row;
end $$;

create or replace function public.admin_delete(p_token text, p_entity text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin bigint := private.require_admin(p_token);
  v_table text;
  v_count integer;
  v_receipt uuid;
begin
  v_table := case p_entity
    when 'courses' then 'courses'
    when 'groups' then 'study_groups'
    when 'students' then 'students'
    when 'payments' then 'payments'
    when 'attendance' then 'attendance'
    when 'tests' then 'online_tests'
    when 'questions' then 'test_questions'
    when 'test_results' then 'test_results'
    when 'payment_requests' then 'payment_requests'
    when 'admins' then 'admins'
  end;
  if v_table is null then
    perform private.fail('PT404', 'Bu bo‘limdan o‘chirib bo‘lmaydi');
  end if;
  if p_entity = 'admins' then
    if p_id = v_admin then
      perform private.fail('PT400', 'O‘zingizni o‘chira olmaysiz');
    end if;
    if (select count(*) from private.admins where is_active and id <> p_id) = 0 then
      perform private.fail('PT400', 'Kamida bitta faol admin qolishi kerak');
    end if;
  end if;
  if p_entity = 'payment_requests' then
    select receipt_id into v_receipt from private.payment_requests where id = p_id;
  elsif p_entity = 'tests' then
    select file_id into v_receipt from private.online_tests where id = p_id;
  end if;
  begin
    execute format('delete from private.%I where id = $1', v_table) using p_id;
    get diagnostics v_count = row_count;
  exception when foreign_key_violation then
    perform private.fail('PT409', 'Bu yozuvni o‘chirib bo‘lmaydi: unga boshqa ma’lumotlar bog‘langan. Kerak bo‘lsa, uni faolsizlantiring.');
  end;
  if v_receipt is not null then
    delete from private.media where id = v_receipt;
  end if;
  if v_count = 0 then
    perform private.fail('PT404', 'Yozuv topilmadi');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_import_questions(p_token text, p_test_id bigint, p_questions jsonb, p_replace boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q jsonb;
  i integer := 0;
  v_order integer;
  v_text text; v_a text; v_b text; v_c text; v_d text; v_correct text;
begin
  perform private.require_admin(p_token);
  if not exists (select 1 from private.online_tests where id = p_test_id) then
    perform private.fail('PT404', 'Test topilmadi');
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) = 0 then
    perform private.fail('PT400', 'Qo‘shish uchun savol tanlanmagan');
  end if;
  if jsonb_array_length(p_questions) > 300 then
    perform private.fail('PT400', 'Bir martada 300 tadan ko‘p savol qo‘shib bo‘lmaydi');
  end if;
  if p_replace then
    delete from private.test_questions where test_id = p_test_id;
  end if;
  select coalesce(max(sort_order), 0) into v_order from private.test_questions where test_id = p_test_id;
  for q in select * from jsonb_array_elements(p_questions) loop
    i := i + 1;
    v_text := private.clean(q ->> 'question_text', 2000);
    v_a := private.clean(q ->> 'option_a', 500);
    v_b := private.clean(q ->> 'option_b', 500);
    v_c := private.clean(q ->> 'option_c', 500);
    v_d := private.clean(q ->> 'option_d', 500);
    v_correct := upper(coalesce(q ->> 'correct_option', ''));
    if v_c is null and v_d is not null then
      v_c := v_d; v_d := null;
      if v_correct = 'D' then v_correct := 'C'; end if;
    end if;
    if v_text is null or v_a is null or v_b is null then
      perform private.fail('PT400', i || '-savol: savol matni va kamida A, B variantlari bo‘lishi kerak');
    end if;
    if v_correct not in ('A', 'B', 'C', 'D')
       or (v_correct = 'C' and v_c is null) or (v_correct = 'D' and v_d is null) then
      perform private.fail('PT400', i || '-savol: to‘g‘ri javobni tanlang');
    end if;
    v_order := v_order + 1;
    insert into private.test_questions(test_id, question_text, option_a, option_b, option_c, option_d, correct_option, sort_order)
    values (p_test_id, v_text, v_a, v_b, v_c, v_d, v_correct, v_order);
  end loop;
  return jsonb_build_object('ok', true, 'added', i,
                            'total', (select count(*) from private.test_questions where test_id = p_test_id));
end $$;

create or replace function public.admin_attach_test_file(p_token text, p_test_id bigint, p_name text, p_mime text,
                                                         p_b64 text, p_visibility text default 'after')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_old uuid;
  v_new uuid;
begin
  perform private.require_admin(p_token);
  if p_visibility not in ('hidden', 'after', 'always') then
    perform private.fail('PT400', 'Ko‘rinish turi noto‘g‘ri');
  end if;
  select file_id into v_old from private.online_tests where id = p_test_id for update;
  if not found then
    perform private.fail('PT404', 'Test topilmadi');
  end if;
  v_new := private.decode_file(p_b64, p_mime, 'document');
  update private.online_tests
     set file_id = v_new, file_name = left(coalesce(nullif(btrim(p_name), ''), 'test-fayli'), 200),
         file_visibility = p_visibility
   where id = p_test_id;
  if v_old is not null then
    delete from private.media where id = v_old;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_remove_test_file(p_token text, p_test_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_old uuid;
begin
  perform private.require_admin(p_token);
  select file_id into v_old from private.online_tests where id = p_test_id for update;
  update private.online_tests set file_id = null, file_name = null where id = p_test_id;
  if v_old is not null then
    delete from private.media where id = v_old;
  end if;
  delete from private.file_grants where test_id = p_test_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_get_test_file(p_token text, p_test_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_admin(p_token);
  select jsonb_build_object('name', t.file_name, 'mime', m.mime, 'data', encode(m.data, 'base64'))
    into v
    from private.online_tests t join private.media m on m.id = t.file_id
   where t.id = p_test_id;
  if v is null then
    perform private.fail('PT404', 'Bu testga fayl biriktirilmagan');
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Ruxsatlar
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public;
do $$
declare
  f text;
  fns text[] := array[
    'public.get_test(bigint)',
    'public.submit_test(bigint, text, text, jsonb)',
    'public.get_test_file(bigint, text)',
    'public.admin_save(text, text, bigint, jsonb)',
    'public.admin_delete(text, text, bigint)',
    'public.admin_import_questions(text, bigint, jsonb, boolean)',
    'public.admin_attach_test_file(text, bigint, text, text, text, text)',
    'public.admin_remove_test_file(text, bigint)',
    'public.admin_get_test_file(text, bigint)'
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
