Algoritm v9 — kurs qatnashchilari va oyma-oy to‘lov holati

Yangi fayllar:
- admin/participants.php — kurs bo‘yicha qatnashchilar ro‘yxati
- admin/student_detail.php — o‘quvchi profili, qabul sanasi va oylik to‘lov holati
- upgrade_v9.sql — mavjud bazaga enrolled_at ustunini qo‘shadi

O‘rnatish:
1. Avval loyiha va bazaning zaxira nusxasini oling.
2. Fayllarni XAMPP htdocs ichidagi mavjud loyiha papkasiga nusxalang.
3. phpMyAdmin’da algoritm_center bazasini tanlab upgrade_v9.sql faylini BIR MARTA import qiling.
4. Admin panelga kiring va “Qatnashchilar” bo‘limini oching.

Qabul sanasi: o‘quvchi holatini “Qabul qilindi”ga o‘zgartirib saqlaganda enrolled_at yoziladi. Avvaldan enrolled bo‘lgan yozuvlar uchun sana created_at bilan to‘ldiriladi.
Oylik to‘lov: faqat administrator kiritgan payments yozuvlari yoki statusi paid bo‘lgan online_payment_requests qaydlari oy bo‘yicha to‘langan deb belgilanadi. To‘lovlar telefon raqami va kurs orqali moslashtiriladi.
