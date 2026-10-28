<?php
session_start();
if (empty($_SESSION['admin_id'])) { header('Location: login.php'); exit; }
require_once __DIR__ . '/../config/db.php';
if (!$pdo) die('Ma’lumotlar bazasi bilan ulanish yo‘q.');
require_once __DIR__ . '/../config/schema_compat.php';
$courses = $pdo->query('SELECT id,name FROM courses ORDER BY name')->fetchAll();
$courseId = filter_input(INPUT_GET, 'course_id', FILTER_VALIDATE_INT) ?: 0;
$hasEnrolledAt = false;
try { $cols = $pdo->query("SHOW COLUMNS FROM students")->fetchAll(PDO::FETCH_COLUMN); $hasEnrolledAt = in_array('enrolled_at', $cols, true); } catch (Throwable $e) {}
$enrolledExpr = $hasEnrolledAt ? 's.enrolled_at' : 'NULL AS enrolled_at';
$sql = "SELECT s.id,s.full_name,s.phone,s.status,s.created_at," . $enrolledExpr . ",c.name AS course_name FROM students s JOIN courses c ON c.id=s.course_id";
$args=[];
if ($courseId) { $sql .= ' WHERE s.course_id=?'; $args[]=$courseId; }
$sql .= " ORDER BY c.name,s.full_name";
$q=$pdo->prepare($sql); $q->execute($args); $students=$q->fetchAll();
$labels=['new'=>'Yangi ariza','contacted'=>'Bog‘lanildi','enrolled'=>'Qabul qilindi','rejected'=>'Rad etildi'];
?>
<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kurs qatnashchilari — Algoritm</title><link rel="stylesheet" href="../assets/css/style.css?v=9"></head><body class="dashboard-body">
<header class="site-header"><a class="brand" href="dashboard.php"><span class="brand-mark">A</span><span>ALGORITM<small>Administrator</small></span></a><nav><a href="dashboard.php">Panel</a><a href="courses.php">Kurslar</a><a href="payments.php">To‘lovlar</a><a href="site_settings.php">Sozlamalar</a><a class="nav-cta" href="logout.php">Chiqish</a></nav></header>
<main class="dashboard"><div class="dashboard-title"><div><span class="eyebrow">ADMINISTRATOR</span><h1>Kurs qatnashchilari</h1><p>Kursni tanlang va ro‘yxatdagi o‘quvchi ustiga bosib, qabul sanasi hamda oylik to‘lovlarini ko‘ring.</p></div></div>
<form method="get" class="month-filter"><label>Kursni tanlang<select name="course_id"><option value="0">Barcha kurslar</option><?php foreach($courses as $c): ?><option value="<?= (int)$c['id'] ?>" <?= $courseId===(int)$c['id']?'selected':'' ?>><?= htmlspecialchars($c['name']) ?></option><?php endforeach; ?></select></label><button class="button primary">Ro‘yxatni ko‘rsatish</button></form>
<section class="table-card"><div class="table-heading"><div><h2>Umumiy qatnashuvchilar ro‘yxati</h2><p><?= count($students) ?> ta o‘quvchi/ariza</p></div><input id="studentSearch" class="search-input" placeholder="Ism yoki telefon bo‘yicha qidirish…"></div><div class="table-scroll"><table id="studentsTable"><thead><tr><th>O‘quvchi</th><th>Telefon</th><th>Kurs</th><th>Ariza sanasi</th><th>Qabul qilingan sana</th><th>Holat</th><th>Batafsil</th></tr></thead><tbody>
<?php foreach($students as $s): ?><tr><td><strong><?= htmlspecialchars($s['full_name']) ?></strong></td><td><?= htmlspecialchars($s['phone']) ?></td><td><?= htmlspecialchars($s['course_name']) ?></td><td><?= htmlspecialchars($s['created_at']) ?></td><td><?= $s['enrolled_at']?htmlspecialchars($s['enrolled_at']):'Hali qabul qilinmagan' ?></td><td><span class="status"><?= htmlspecialchars($labels[$s['status']]??$s['status']) ?></span></td><td><a class="button primary" href="student_detail.php?id=<?= (int)$s['id'] ?>">Ko‘rish →</a></td></tr><?php endforeach; ?>
<?php if(!$students): ?><tr><td colspan="7" class="empty-state">Bu kursda hozircha ro‘yxatdan o‘tganlar yo‘q.</td></tr><?php endif; ?></tbody></table></div></section></main><script src="../assets/js/app.js"></script><script src="../assets/js/theme.js?v=9"></script></body></html>
