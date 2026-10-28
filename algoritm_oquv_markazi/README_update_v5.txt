ALGoritm v5 — oylik to‘lovlar va administrator kartalari

YANGI IMKONIYATLAR
- Administrator to‘lovlar bo‘limida oxirgi 12 oy alohida tugmalar bilan ko‘rinadi. Oy tanlansa, faqat shu oyda yuborilgan to‘lov so‘rovlari va summalar ko‘rsatiladi.
- To‘lov sahifasida Click va Payme tanlovi olib tashlandi.
- To‘lov sahifasida administrator kiritgan qabul qiluvchi kartalar ko‘rsatiladi (3 tagacha).
- Administrator > Sayt ma’lumotlari sahifasida karta raqami va karta egasini o‘zgartirish mumkin.
- O‘quvchi karta ma’lumotlarini kiritmaydi; u pulni o‘z bank ilovasidan administrator ko‘rsatgan kartaga o‘tkazadi va chekni yuklaydi. Admin pul tushganini tekshirib holatni tasdiqlaydi.

YANGILASH
1. Eski loyiha papkasidan zaxira nusxa oling.
2. ZIP ichidagi algoritm_oquv_markazi papkasidagi fayllarni C:\xampp\htdocs\algoritm_oquv_markazi ichiga ko‘chiring va fayllarni yangilang.
3. Mavjud ma’lumotlar bazasini o‘chirmang va schema.sql ni qayta import qilmang.
4. XAMPP’da Apache va MySQL ishlayotganini tekshiring.
5. Sayt: http://localhost/algoritm_oquv_markazi/
6. Administrator kartalari: http://localhost/algoritm_oquv_markazi/admin/site_settings.php
7. Oylik to‘lovlar: http://localhost/algoritm_oquv_markazi/admin/payments.php

Eslatma: karta ma’lumotlarida faqat qabul qiluvchi karta raqami va egasi saqlanadi. CVV/CVC yoki karta amal qilish muddatini yig‘mang. Sayt hali avtomatik Click/Payme to‘lovi emas; bank o‘tkazmasi cheki administrator tomonidan tekshiriladi.
