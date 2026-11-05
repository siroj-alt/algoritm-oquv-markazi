-- Birinchi admin hisobi (faqat hali birorta admin bo‘lmasa yaratiladi).
-- Parolni admin paneldagi «Adminlar va parol» bo‘limida darhol o‘zgartiring.
insert into private.admins (username, password_hash, full_name)
select 'admin', '$2a$10$tB1CPWHMNAxu7s91SxoT0.qdguWFxCfoWI.pVfwhHMrUG3bTUJpB6', 'Bosh admin'
where not exists (select 1 from private.admins);
