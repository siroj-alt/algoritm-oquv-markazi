-- =====================================================================
-- Eski bazadan (public sxemadagi jadvallar) yangi tuzilishga ko‘chirish
--
-- Tartib:
--   1. Avval supabase/schema.sql ni ishga tushiring.
--   2. Keyin shu faylni ishga tushiring. Eski jadvallar o‘chirilmaydi va
--      o‘zgartirilmaydi — faqat ulardan nusxa olinadi.
--   3. Qayta ishga tushirish xavfsiz: mavjud yozuvlar takrorlanmaydi.
--
-- Eski jadvallarning ustunlari turlicha bo‘lishi mumkinligi sababli skript
-- har bir ustun mavjudligini tekshirib ishlaydi.
-- =====================================================================

create or replace function pg_temp.has_table(t text) returns boolean language sql as $$
  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t);
$$;

-- Ustun bo‘lsa uning nomini, bo‘lmasa zaxira ifodani qaytaradi
create or replace function pg_temp.c(t text, col text, fallback text default 'null') returns text language sql as $$
  select case when exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = t and column_name = col)
              then format('o.%I', col) else fallback end;
$$;

create or replace function pg_temp.try_phone(p text) returns text language plpgsql as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if char_length(d) = 9 then return '+998' || d; end if;
  if char_length(d) = 12 and left(d, 3) = '998' then return '+' || d; end if;
  if char_length(d) between 10 and 15 then return '+' || d; end if;
  return null;
end $$;

create or replace function pg_temp.truthy(v text) returns boolean language sql as $$
  select coalesce(lower(v) in ('true', 't', '1', 'yes', 'y'), true);
$$;

create or replace function pg_temp.https_or_null(v text) returns text language sql as $$
  select case when v ~ '^https://[^\s"<>]+$' then v end;
$$;

do $$
declare
  t text;
  n bigint;
begin
  -- ------------------------------------------------------------ kurslar
  if pg_temp.has_table('courses') then
    execute format($q$
      insert into private.courses (id, name, price, description, duration, teacher_name, teacher_bio,
                                   image_url, teacher_image_url, is_active, created_at)
      select o.id::bigint,
             left(coalesce(nullif(btrim(%s::text), ''), 'Kurs ' || o.id), 120),
             greatest(coalesce(round(nullif(%s::text, '')::numeric), 0), 0),
             left(%s::text, 5000), left(%s::text, 80), left(%s::text, 120), left(%s::text, 2000),
             pg_temp.https_or_null(%s::text), pg_temp.https_or_null(%s::text),
             pg_temp.truthy(%s::text), coalesce(%s::timestamptz, now())
        from public.courses o
      on conflict (id) do nothing$q$,
      pg_temp.c('courses', 'name'), pg_temp.c('courses', 'price', '0'), pg_temp.c('courses', 'description'),
      pg_temp.c('courses', 'duration'), pg_temp.c('courses', 'teacher_name'), pg_temp.c('courses', 'teacher_bio'),
      pg_temp.c('courses', 'image_path', pg_temp.c('courses', 'image_url')),
      pg_temp.c('courses', 'teacher_image', pg_temp.c('courses', 'teacher_image_url')),
      pg_temp.c('courses', 'is_active', 'true'), pg_temp.c('courses', 'created_at'));
    get diagnostics n = row_count; raise notice 'Kurslar: % ta', n;
  end if;

  -- ------------------------------------------------------------ guruhlar
  t := case when pg_temp.has_table('study_groups') then 'study_groups'
            when pg_temp.has_table('groups') then 'groups' end;
  if t is not null then
    execute format($q$
      insert into private.study_groups (id, course_id, name, teacher_name, schedule, start_date, is_active, created_at)
      select o.id::bigint, %s::bigint,
             left(coalesce(nullif(btrim(%s::text), ''), 'Guruh ' || o.id), 100),
             left(%s::text, 120), left(%s::text, 160), %s::date, pg_temp.truthy(%s::text), coalesce(%s::timestamptz, now())
        from public.%I o
       where exists (select 1 from private.courses c where c.id = %s::bigint)
      on conflict (id) do nothing$q$,
      pg_temp.c(t, 'course_id'), pg_temp.c(t, 'group_name', pg_temp.c(t, 'name')), pg_temp.c(t, 'teacher_name'),
      pg_temp.c(t, 'schedule'), pg_temp.c(t, 'start_date'), pg_temp.c(t, 'is_active', 'true'),
      pg_temp.c(t, 'created_at'), t, pg_temp.c(t, 'course_id'));
    get diagnostics n = row_count; raise notice 'Guruhlar: % ta', n;
  end if;

  -- ------------------------------------------------------------ o‘quvchilar
  if pg_temp.has_table('students') then
    execute format($q$
      insert into private.students (id, full_name, phone, course_id, status, note, source, created_at, enrolled_at)
      select o.id::bigint,
             left(case when char_length(btrim(coalesce(%1$s::text, ''))) >= 3 then btrim(%1$s::text)
                       else 'Ism kiritilmagan #' || o.id end, 120),
             coalesce(pg_temp.try_phone(%2$s::text), '+998000000000'),
             (select c.id from private.courses c where c.id = %3$s::bigint),
             case when %4$s::text in ('new', 'contacted', 'enrolled', 'rejected') then %4$s::text else 'new' end,
             left(concat_ws(' | ', nullif(btrim(%5$s::text), ''),
                            case when pg_temp.try_phone(%2$s::text) is null then 'Eski telefon: ' || coalesce(%2$s::text, '—') end), 1000),
             'website', coalesce(%6$s::timestamptz, now()), %7$s::timestamptz
        from public.students o
      on conflict (id) do nothing$q$,
      pg_temp.c('students', 'full_name'), pg_temp.c('students', 'phone'), pg_temp.c('students', 'course_id'),
      pg_temp.c('students', 'status', '''new'''), pg_temp.c('students', 'note'), pg_temp.c('students', 'created_at'),
      pg_temp.c('students', 'enrolled_at'));
    get diagnostics n = row_count; raise notice 'O‘quvchilar: % ta', n;

    if pg_temp.has_table('enrollments') then
      execute $q$
        update private.students s set group_id = e.group_id
          from (select distinct on (student_id) student_id::bigint, group_id::bigint
                  from public.enrollments order by student_id, id desc) e
         where s.id = e.student_id and s.group_id is null
           and exists (select 1 from private.study_groups g where g.id = e.group_id)$q$;
    end if;
  end if;

  -- ------------------------------------------------------------ to‘lov cheklari
  if pg_temp.has_table('online_payment_requests') then
    execute format($q$
      insert into private.payment_requests (id, full_name, phone, course_id, amount, payer_card_last4,
                                            target_month, status, admin_note, created_at, reviewed_at)
      select o.id::bigint,
             left(case when char_length(btrim(coalesce(%1$s::text, ''))) >= 3 then btrim(%1$s::text) else 'Ism kiritilmagan' end, 120),
             coalesce(pg_temp.try_phone(%2$s::text), '+998000000000'),
             (select c.id from private.courses c where c.id = %3$s::bigint),
             round(%4$s::numeric),
             case when %5$s::text ~ '^[0-9]{4}$' then %5$s::text end,
             date_trunc('month', %6$s::date)::date,
             case when %7$s::text in ('paid', 'approved') then 'approved'
                  when %7$s::text = 'rejected' then 'rejected' else 'pending' end,
             case when nullif(%8$s::text, '') is not null then left('Eski chek fayli: ' || %8$s::text, 500) end,
             coalesce(%9$s::timestamptz, now()), %10$s::timestamptz
        from public.online_payment_requests o
       where %4$s::numeric > 0
      on conflict (id) do nothing$q$,
      pg_temp.c('online_payment_requests', 'full_name'), pg_temp.c('online_payment_requests', 'phone'),
      pg_temp.c('online_payment_requests', 'course_id'), pg_temp.c('online_payment_requests', 'amount', '0'),
      pg_temp.c('online_payment_requests', 'payer_card_last4'), pg_temp.c('online_payment_requests', 'target_month'),
      pg_temp.c('online_payment_requests', 'status', '''pending'''), pg_temp.c('online_payment_requests', 'receipt_path'),
      pg_temp.c('online_payment_requests', 'created_at'), pg_temp.c('online_payment_requests', 'reviewed_at'));
    get diagnostics n = row_count; raise notice 'To‘lov cheklari: % ta', n;
  end if;

  -- ------------------------------------------------------------ to‘lovlar
  if pg_temp.has_table('payments') then
    execute format($q$
      insert into private.payments (id, student_id, amount, method, paid_on, note, created_at)
      select o.id::bigint, %1$s::bigint, round(%2$s::numeric),
             case when %3$s::text in ('cash', 'card', 'transfer', 'other') then %3$s::text else 'other' end,
             coalesce(%4$s::date, current_date), left(%5$s::text, 500), coalesce(%4$s::timestamptz, now())
        from public.payments o
       where %2$s::numeric > 0 and exists (select 1 from private.students s where s.id = %1$s::bigint)
      on conflict (id) do nothing$q$,
      pg_temp.c('payments', 'student_id'), pg_temp.c('payments', 'amount', '0'),
      pg_temp.c('payments', 'payment_method', pg_temp.c('payments', 'method', '''cash''')),
      pg_temp.c('payments', 'paid_at', pg_temp.c('payments', 'created_at')), pg_temp.c('payments', 'note'));
    get diagnostics n = row_count; raise notice 'To‘lovlar: % ta', n;
  end if;

  -- ------------------------------------------------------------ davomat
  if pg_temp.has_table('attendance') then
    execute format($q$
      insert into private.attendance (student_id, group_id, lesson_date, status, note)
      select %1$s::bigint, (select g.id from private.study_groups g where g.id = %2$s::bigint),
             coalesce(%3$s::date, current_date),
             case when %4$s::text in ('present', 'absent', 'late', 'excused') then %4$s::text else 'present' end,
             left(%5$s::text, 300)
        from public.attendance o
       where exists (select 1 from private.students s where s.id = %1$s::bigint)
      on conflict (student_id, lesson_date) do nothing$q$,
      pg_temp.c('attendance', 'student_id'), pg_temp.c('attendance', 'group_id'),
      pg_temp.c('attendance', 'attendance_date', pg_temp.c('attendance', 'lesson_date')),
      pg_temp.c('attendance', 'status', '''present'''), pg_temp.c('attendance', 'note'));
    get diagnostics n = row_count; raise notice 'Davomat: % ta', n;
  end if;

  -- ------------------------------------------------------------ testlar
  if pg_temp.has_table('online_tests') then
    execute format($q$
      insert into private.online_tests (id, title, description, is_active, created_at)
      select o.id::bigint, left(coalesce(nullif(btrim(%s::text), ''), 'Test ' || o.id), 180), left(%s::text, 2000),
             pg_temp.truthy(%s::text), coalesce(%s::timestamptz, now())
        from public.online_tests o
      on conflict (id) do nothing$q$,
      pg_temp.c('online_tests', 'title'), pg_temp.c('online_tests', 'description'),
      pg_temp.c('online_tests', 'is_active', 'true'), pg_temp.c('online_tests', 'created_at'));
    get diagnostics n = row_count; raise notice 'Testlar: % ta', n;
  end if;
  if pg_temp.has_table('test_questions') then
    execute format($q$
      insert into private.test_questions (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, sort_order)
      select o.id::bigint, %s::bigint, left(%s::text, 2000), left(coalesce(nullif(%s::text, ''), '—'), 500),
             left(coalesce(nullif(%s::text, ''), '—'), 500), left(coalesce(nullif(%s::text, ''), '—'), 500),
             left(coalesce(nullif(%s::text, ''), '—'), 500), upper(btrim(%s::text)), coalesce(%s::integer, 0)
        from public.test_questions o
       where upper(btrim(%s::text)) in ('A', 'B', 'C', 'D') and char_length(btrim(coalesce(%s::text, ''))) > 0
         and exists (select 1 from private.online_tests t where t.id = %s::bigint)
      on conflict (id) do nothing$q$,
      pg_temp.c('test_questions', 'test_id'), pg_temp.c('test_questions', 'question_text'),
      pg_temp.c('test_questions', 'option_a'), pg_temp.c('test_questions', 'option_b'),
      pg_temp.c('test_questions', 'option_c'), pg_temp.c('test_questions', 'option_d'),
      pg_temp.c('test_questions', 'correct_option'), pg_temp.c('test_questions', 'sort_order', '0'),
      pg_temp.c('test_questions', 'correct_option'), pg_temp.c('test_questions', 'question_text'),
      pg_temp.c('test_questions', 'test_id'));
    get diagnostics n = row_count; raise notice 'Savollar: % ta', n;
  end if;
  if pg_temp.has_table('test_results') then
    execute format($q$
      insert into private.test_results (id, test_id, full_name, phone, total_questions, correct_answers, percentage, answers, created_at)
      select o.id::bigint, %s::bigint, coalesce(%s::text, ''), coalesce(%s::text, ''), coalesce(%s::integer, 0),
             coalesce(%s::integer, 0), coalesce(%s::numeric, 0), coalesce(%s::jsonb, '{}'::jsonb), coalesce(%s::timestamptz, now())
        from public.test_results o
       where exists (select 1 from private.online_tests t where t.id = %s::bigint)
      on conflict (id) do nothing$q$,
      pg_temp.c('test_results', 'test_id'), pg_temp.c('test_results', 'full_name'), pg_temp.c('test_results', 'phone'),
      pg_temp.c('test_results', 'total_questions'), pg_temp.c('test_results', 'correct_answers'),
      pg_temp.c('test_results', 'percentage'), pg_temp.c('test_results', 'answers_json', pg_temp.c('test_results', 'answers')),
      pg_temp.c('test_results', 'created_at'), pg_temp.c('test_results', 'test_id'));
    get diagnostics n = row_count; raise notice 'Test natijalari: % ta', n;
  end if;

  -- ------------------------------------------------------------ sozlamalar
  if pg_temp.has_table('site_settings') then
    execute format($q$
      insert into private.site_settings (key, value)
      select lower(%s::text), left(coalesce(%s::text, ''), 4000)
        from public.site_settings o
       where lower(%s::text) ~ '^[a-z0-9_]{2,60}$' and coalesce(%s::text, '') <> ''
      on conflict (key) do update set value = excluded.value, updated_at = now()$q$,
      pg_temp.c('site_settings', 'setting_key', pg_temp.c('site_settings', 'key')),
      pg_temp.c('site_settings', 'setting_value', pg_temp.c('site_settings', 'value')),
      pg_temp.c('site_settings', 'setting_key', pg_temp.c('site_settings', 'key')),
      pg_temp.c('site_settings', 'setting_value', pg_temp.c('site_settings', 'value')));
    -- Eski bitta karta sozlamasini yangi 1-karta maydoniga o‘tkazish
    update private.site_settings s set value = o.value
      from private.site_settings o
     where s.key = 'card_number_1' and s.value = '' and o.key = 'card_number' and o.value <> '';
    update private.site_settings s set value = o.value
      from private.site_settings o
     where s.key = 'card_holder_1' and s.value = '' and o.key = 'card_holder' and o.value <> '';
  end if;

  -- ------------------------------------------------------------ adminlar
  if pg_temp.has_table('admins') then
    execute format($q$
      insert into private.admins (username, password_hash, created_at)
      select lower(regexp_replace(%s::text, '[^a-zA-Z0-9_.-]', '', 'g')),
             regexp_replace(%s::text, '^\$2[by]\$', '$2a$'),   -- Python bcrypt xeshi pgcrypto bilan mos bo‘lishi uchun
             coalesce(%s::timestamptz, now())
        from public.admins o
       where lower(regexp_replace(%s::text, '[^a-zA-Z0-9_.-]', '', 'g')) ~ '^[a-z0-9_.-]{3,40}$'
         and %s::text ~ '^\$2[aby]\$'
      on conflict (username) do nothing$q$,
      pg_temp.c('admins', 'username'), pg_temp.c('admins', 'password_hash'), pg_temp.c('admins', 'created_at'),
      pg_temp.c('admins', 'username'), pg_temp.c('admins', 'password_hash'));
    get diagnostics n = row_count; raise notice 'Adminlar: % ta', n;
  end if;
end $$;

-- Identity hisoblagichlarini eng katta id dan davom ettirish
select setval(pg_get_serial_sequence('private.' || t, 'id'), greatest(coalesce(m, 0), 1), coalesce(m, 0) > 0)
  from (values
    ('courses', (select max(id) from private.courses)),
    ('study_groups', (select max(id) from private.study_groups)),
    ('students', (select max(id) from private.students)),
    ('payment_requests', (select max(id) from private.payment_requests)),
    ('payments', (select max(id) from private.payments)),
    ('attendance', (select max(id) from private.attendance)),
    ('online_tests', (select max(id) from private.online_tests)),
    ('test_questions', (select max(id) from private.test_questions)),
    ('test_results', (select max(id) from private.test_results)),
    ('admins', (select max(id) from private.admins))
  ) v(t, m);

-- Natija
select 'kurslar' as jadval, count(*) from private.courses
union all select 'guruhlar', count(*) from private.study_groups
union all select 'o‘quvchilar', count(*) from private.students
union all select 'to‘lov cheklari', count(*) from private.payment_requests
union all select 'to‘lovlar', count(*) from private.payments
union all select 'testlar', count(*) from private.online_tests
union all select 'savollar', count(*) from private.test_questions
union all select 'adminlar', count(*) from private.admins;
