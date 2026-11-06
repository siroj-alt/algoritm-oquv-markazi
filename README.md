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
| `supabase/migrations/` | Baza sxemasi va funksiyalar (Supabase GitHub integratsiyasi avtomatik qo‘llaydi) |
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

1. Supabase loyihasida **SQL Editor** orqali `supabase/migrations/` dagi fayllarni tartib bilan ishga tushiring
   (qayta ishga tushirish xavfsiz).
2. Birinchi adminni yarating (parolni o‘zingiz tanlang):

   ```sql
   insert into private.admins (username, password_hash, full_name)
   values ('admin', extensions.crypt('KUCHLI-PAROL', extensions.gen_salt('bf', 10)), 'Bosh admin');
   ```

   Eski bazadagi ma’lumotlarni (eski `public` jadvallardan) ko‘chirish kerak bo‘lsa,
   sxemadan keyin `supabase/migrate_from_old.sql` ni ishga tushiring — eski
   jadvallar o‘zgartirilmaydi, eski admin parollari ishlashda davom etadi.
3. Vercel loyihasida muhit o‘zgaruvchilari:
   * `ALGORITM_SUPABASE_URL` — `https://<loyiha>.supabase.co`
   * `ALGORITM_SUPABASE_KEY` — Supabase publishable (`sb_publishable_…`) yoki anon kalit
4. Deploy qiling va `/admin` sahifasidan kiring. Kurslar, karta raqamlari va aloqa
   ma’lumotlarini admin paneldan kiriting.

## Fayldan savol qo‘shish

Admin panel → Onlayn testlar → «Savollar» → «Fayldan yuklash». Word (.docx), PDF yoki
.txt fayldagi savollar avtomatik ajratiladi (`algoritm/test_import.py`):

```
1. Savol matni?
A) variant   B) variant   C) variant   D) variant
Javob: B
```

To‘g‘ri javob «Javob: B» qatori, variant oldidagi `*`/`+`, Word/PDF’dagi qalin yozuv yoki
oxiridagi «Javoblar: 1-B, 2-A…» kaliti orqali aniqlanadi. Fayl testga biriktirilib,
o‘quvchilarga «testdan keyin» yoki «doim» ko‘rsatilishi mumkin.

`/api/health` — baza ulanishini tekshirish uchun.

## Test vaqti

Har bir testga vaqt belgilash mumkin: admin panel → «Onlayn testlar» → test formasida yoki «Savollar» sahifasidagi «Test vaqti» panelida.

- **Vaqt cheklanmagan** — test avvalgidek ishlanadi.
- **Vaqtni admin belgilaydi** — admin 1–600 daqiqa kiritadi, hamma o‘quvchiga bir xil vaqt beriladi.
- **Vaqtni o‘quvchi o‘zi tanlaydi** — o‘quvchi boshlashdan oldin 10–90 daqiqalik tayyor variantlardan birini yoki 300 daqiqagacha o‘z vaqtini tanlaydi.

Vaqt ikkala ko‘rinishga ham ishlaydi:

- **Savolli test** — savollar «Testni boshlash» bosilgach ochiladi, vaqt tugashi bilan belgilangan javoblar avtomatik yuboriladi. Boshlanish vaqti serverda saqlanadi (`private.test_attempts`), shuning uchun sahifani yangilash yoki boshqa qurilmadan shu telefon raqami bilan kirish vaqtni qayta boshlamaydi. Kechikib yuborilgan javoblar natijalarda «Vaqtdan oshgan» deb belgilanadi.
- **Fayl (PDF/Word) ko‘rinishidagi test** — fayl faqat «Boshlash»dan keyin ochiladi va vaqt tugagach yopiladi; faylga kirish ruxsati serverda vaqt tugashi bilan (1 daqiqa zaxira bilan) bekor bo‘ladi.
