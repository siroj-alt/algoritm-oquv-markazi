<?php
session_start();
if (empty($_SESSION['admin_id'])) { header('Location: login.php'); exit; }
require_once __DIR__ . '/../config/db.php';
if (!$pdo) { die('Ma’lumotlar bazasi sozlanmagan. README.md faylini ko‘ring.'); }
require_once __DIR__ . '/../config/schema_compat.php';
$students = $pdo->query("SELECT s.id, s.full_name, s.phone, s.status, s.created_at, c.name AS course_name FROM students s JOIN courses c ON c.id=s.course_id ORDER BY s.created_at DESC")->fetchAll();
$courseCount = (int)$pdo->query('SELECT COUNT(*) FROM courses WHERE is_active=1')->fetchColumn();
$studentCount = count($students);
$paymentTotal = (float)$pdo->query('SELECT COALESCE(SUM(amount),0) FROM payments')->fetchColumn();
$statusLabels = ['new'=>'Yangi','contacted'=>'Bog‘lanildi','enrolled'=>'Qabul qilindi','rejected'=>'Rad etildi'];
?>
<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Boshqaruv paneli — Algoritm</title><link rel="stylesheet" href="../assets/css/style.css?v=9"></head><body class="dashboard-body">
<header class="site-header"><a class="brand" href="../index.php"><span class="brand-mark">A</span><span>ALGORITM<small>Boshqaruv paneli</small></span></a><nav><a href="courses.php">Kurslar</a><a href="participants.php">Qatnashchilar</a><a href="site_settings.php">Sayt ma’lumotlari</a><a href="payments.php">To‘lovlar</a><a href="tests.php">Testlar</a><a href="test_results.php">Test natijalari</a><span class="admin-welcome">Salom, <?= htmlspecialchars($_SESSION['admin_name'] ?? 'admin') ?></span><a class="nav-cta" href="logout.php">Chiqish</a></nav></header>
<main class="dashboard"><div class="dashboard-title"><div><span class="eyebrow">ADMINISTRATOR</span><h1>Boshqaruv paneli</h1><p>O‘quv markazining asosiy ko‘rsatkichlari.</p></div><a class="button primary" href="../index.php#royxat">Saytni ko‘rish ↗</a></div>
<div class="stats-grid"><article class="stat-card"><span>Jami arizalar</span><strong><?= $studentCount ?></strong><small>Ro‘yxatdagi o‘quvchilar</small></article><article class="stat-card"><span>Faol kurslar</span><strong><?= $courseCount ?></strong><small>Saytda ko‘rsatiladigan kurslar</small></article><article class="stat-card"><span>Qayd etilgan to‘lovlar</span><strong><?= number_format($paymentTotal, 0, '.', ' ') ?> so‘m</strong><small>Barcha kiritilgan to‘lovlar</small></article></div>
<section class="table-card"><div class="table-heading"><div><h2>Yangi arizalar</h2><p>Ro‘yxatdan o‘tgan o‘quvchilar</p></div><input id="studentSearch" class="search-input" placeholder="Ism yoki telefon bo‘yicha qidirish…"></div>
<div class="table-scroll"><table id="studentsTable"><thead><tr><th>O‘quvchi</th><th>Telefon</th><th>Kurs</th><th>Sana</th><th>Holati</th></tr></thead><tbody>
<?php foreach ($students as $s): ?><tr><td><strong><?= htmlspecialchars($s['full_name']) ?></strong><small class="mobile-sub"><?= htmlspecialchars($s['phone']) ?></small></td><td><?= htmlspecialchars($s['phone']) ?></td><td><?= htmlspecialchars($s['course_name']) ?></td><td><?= htmlspecialchars($s['created_at']) ?></td><td><span class="status status-<?= htmlspecialchars($s['status']) ?>"><?= htmlspecialchars($statusLabels[$s['status']] ?? $s['status']) ?></span></td></tr><?php endforeach; ?>
<?php if (!$students): ?><tr><td colspan="5" class="empty-state">Hozircha arizalar yo‘q. Sayt formasidan sinov arizasi yuborishingiz mumkin.</td></tr><?php endif; ?>
</tbody></table></div></section>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px"><a class="button primary" href="courses.php">Kurslar va narxlarni tahrirlash →</a><a class="button primary" href="participants.php">Har bir kurs qatnashchilari →</a><a class="button primary" href="payments.php">To‘lov so‘rovlarini boshqarish →</a><a class="button primary" href="tests.php">Online testlarni boshqarish →</a><a class="button primary" href="test_results.php">Test natijalari →</a></div><p class="phase-note">Eslatma: hozirgi to‘lov sahifasi so‘rovlarni saqlaydi. Haqiqiy karta to‘lovlari uchun Click yoki Payme merchant integratsiyasi va tasdiqlash callbacklari kerak.</p>
</main><script src="../assets/js/app.js"></script><script src="../assets/js/theme.js?v=9"></script></body></html>