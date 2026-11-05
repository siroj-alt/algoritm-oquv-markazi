# Algoritm o‘quv markazi — sayt

Ommaviy sayt (kurslar, kursga yozilish, kartaga to‘lov va chek yuborish, onlayn testlar)
va admin panel (`/admin`). Vercel (Python) + Supabase (PostgreSQL).

## Tuzilishi

| Yo‘l | Vazifasi |
| --- | --- |
| `api/index.py`, `index.py` | Vercel kirish nuqtasi |
| `algoritm/main.py` | Marshrutlar, API, xavfsizlik sarlavhalari |
| `algoritm/pages.py` | Ommaviy sahifalar (serverda tayyorlanadi — SEO va tezlik uchun) |
| `algoritm/db.py` | Supabase RPC mijozi |
| `web/` | CSS, JS, admin panel, logotip |
| `supabase/schema.sql` | Baza sxemasi va barcha funksiyalar |
| `algoritm_oquv_markazi/` | Eski PHP versiya (faqat arxiv, saytda ishlatilmaydi) |

## Xavfsizlik modeli

* Jadvallar `private` sxemada — Supabase API orqali to‘g‘ridan-to‘g‘ri ko‘rinmaydi.
* Sayt bazaga faqat `public` sxemadagi funksiyalar orqali murojaat qiladi; admin funksiyalari
  har safar sessiya tokenini tekshiradi. Shuning uchun serverda faqat **publishable** kalit kerak.
* Admin parollari bcrypt bilan, sessiya tokenlari SHA-256 xesh ko‘rinishida saqlanadi.
* Noto‘g‘ri parol 5 marta kiritilsa, hisob 15 daqiqaga bloklanadi. Ariza, chek va test
  yuborishda telefon raqami bo‘yicha cheklov bor.
* Yuklangan fayllarning haqiqiy turi (imzosi) tekshiriladi.

## O‘rnatish

1. Supabase loyihasida **SQL Editor** orqali `supabase/schema.sql` faylini ishga tushiring
   (qayta ishga tushirish xavfsiz).
2. Birinchi adminni yarating (parolni o‘zingiz tanlang):

   ```sql
   insert into private.admins (username, password_hash, full_name)
   values ('admin', extensions.crypt('KUCHLI-PAROL', extensions.gen_salt('bf', 10)), 'Bosh admin');
   ```

   Eski bazadagi ma’lumotlarni (eski `public` jadvallardan) ko‘chirish kerak bo‘lsa,
   `schema.sql` dan keyin `supabase/migrate_from_old.sql` ni ishga tushiring — eski
   jadvallar o‘zgartirilmaydi, eski admin parollari ishlashda davom etadi.
3. Vercel loyihasida muhit o‘zgaruvchilari:
   * `ALGORITM_SUPABASE_URL` — `https://<loyiha>.supabase.co`
   * `ALGORITM_SUPABASE_KEY` — Supabase publishable (`sb_publishable_…`) yoki anon kalit
4. Deploy qiling va `/admin` sahifasidan kiring. Kurslar, karta raqamlari va aloqa
   ma’lumotlarini admin paneldan kiriting.

`/api/health` — baza ulanishini tekshirish uchun.
