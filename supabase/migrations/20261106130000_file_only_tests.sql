-- =====================================================================
-- Faqat fayldan iborat testlar: admin faylni testga aylantirmasdan,
-- o‘zini o‘quvchilarga ko‘rsatishi mumkin. Bunday test saytdagi ro‘yxatda
-- chiqadi (fayl «doim ochiq» bo‘lsa) va hujjat sifatida ochiladi.
-- =====================================================================

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
               'file_only', not exists (select 1 from private.test_questions q where q.test_id = t.id))
             order by t.id desc)
        from private.online_tests t
        left join private.media m on m.id = t.file_id
       where t.is_active
         and (exists (select 1 from private.test_questions q where q.test_id = t.id)
              or (t.file_id is not null and t.file_visibility = 'always'))),
      '[]'::jsonb)
  );
$$;

revoke all on function public.site_data() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.site_data() from authenticated;
    grant execute on function public.site_data() to anon;
  end if;
end $$;
