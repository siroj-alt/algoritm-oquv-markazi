# Algoritm O‘quv Markazi — PHP/MySQL

Dark UI, qizil aksentlar, kurslar, admin panel, qo‘lda tekshiriladigan chekli to‘lovlar va online test moduli.

## Talablar
- Windows 10/11
- XAMPP (Apache, MySQL/MariaDB, PHP 8+)
- Brauzer

## Yangi o‘rnatish
1. Papkani `C:\xampp\htdocs\algoritm_oquv_markazi` ichiga joylashtiring.
2. XAMPP Control Panel’dan Apache va MySQL’ni ishga tushiring.
3. `http://localhost/phpmyadmin` manzilini oching va `schema.sql` faylini import qiling.
4. `config/db.php` ichida DB host/name/user/password qiymatlarini tekshiring. Standart: localhost / algoritm_center / root / bo‘sh parol.
5. `http://localhost/algoritm_oquv_markazi/` sahifasini oching.
6. Birinchi adminni `http://localhost/algoritm_oquv_markazi/admin/create_admin.php` orqali yarating. So‘ng `admin/create_admin.php` faylini o‘chirib tashlang.

## V5 dan yangilash
1. Loyiha papkasining va ma’lumotlar bazasining zaxira nusxasini oling.
2. Yangi loyiha fayllarini eski loyiha papkasiga ko‘chiring.
3. phpMyAdmin’da mavjud `algoritm_center` bazasini tanlab, `upgrade_v6.sql` faylini import qiling. Eski bazani o‘chirmang va `schema.sql` ni qayta import qilmang.

## Sahifalar
- `index.php` — bosh sahifa
- `course.php?id=...` — kurs tafsilotlari
- `payment.php` — karta tanlash, to‘lov cheki yuklash
- `tests.php` — faol online testlar ro‘yxati
- `take_test.php?id=...` — test topshirish va natija chiqarish
- `admin/dashboard.php` — admin boshqaruv paneli
- `admin/courses.php` — kurslarni boshqarish
- `admin/payments.php` — oylik to‘lovlar va cheklarni ko‘rish
- `admin/site_settings.php` — sayt va karta sozlamalari
- `admin/tests.php` — test yaratish, savol/variant/to‘g‘ri javob qo‘shish va savol o‘chirish
- `admin/test_results.php` — test natijalari

## Click/Payme haqida
To‘lov sahifasidagi Click va Payme tanlovlari admin sozlamalaridagi karta ma’lumotlarini ko‘rsatadi. Bu avtomatik Click/Payme merchant API integratsiyasi emas: o‘quvchi bank ilovasidan pul o‘tkazadi, chekni yuklaydi, administrator esa tushumni mustaqil tekshiradi. Avtomatik onlayn to‘lov uchun rasmiy merchant shartnomasi, API/callbacklar, HTTPS va provayder testlari alohida ishlab chiqilishi kerak.

## Xavfsizlik eslatmalari
- Admin hisobini yaratilgach `admin/create_admin.php` faylini o‘chiring.
- Saytni internetga chiqarishdan oldin HTTPS, CSRF himoyasi, rate limiting, kuchli DB paroli, zaxira nusxa va upload papkasi himoyasini sozlang.
- Foydalanuvchilardan to‘liq karta raqami, amal qilish muddati yoki CVV/CVC so‘ramang.
- XAMPP mahalliy ishlab chiqish uchun mo‘ljallangan; production serverga tayyorgarliksiz joylashtirmang.
