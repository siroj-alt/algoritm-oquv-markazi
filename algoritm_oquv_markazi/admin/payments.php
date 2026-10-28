<?php
session_start();
if (empty($_SESSION['admin_id'])) { header('Location: login.php'); exit; }
require_once __DIR__ . '/../config/db.php';
if (!$pdo) die('Ma’lumotlar bazasi bilan ulanish yo‘q.');

$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) $month = date('Y-m');
$monthStart = $month . '-01 00:00:00';
$monthEnd = date('Y-m-d H:i:s', strtotime($monthStart . ' +1 month'));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_POST['id'] ?? 0);
    $status = $_POST['status'] ?? '';
    $returnMonth = $_POST['month'] ?? $month;
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $returnMonth)) $returnMonth = date('Y-m');
    if ($id > 0 && in_array($status, ['pending','paid','rejected'], true)) {
        $q = $pdo->prepare('UPDATE online_payment_requests SET status=?, reviewed_at=NOW() WHERE id=?');
        $q->execute([$status, $id]);
    }
    header('Location: payments.php?month=' . urlencode($returnMonth) . '&updated=1'); exit;
}

$q = $pdo->prepare('SELECT p.*, c.name AS course_name FROM online_payment_requests p JOIN courses c ON c.id=p.course_id WHERE p.created_at >= ? AND p.created_at < ? ORDER BY p.created_at DESC');
$q->execute([$monthStart, $monthEnd]);
$rows = $q->fetchAll();
$q = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM online_payment_requests WHERE status='paid' AND created_at >= ? AND created_at < ?");
$q->execute([$monthStart, $monthEnd]); $paid = (float)$q->fetchColumn();
$q = $pdo->prepare('SELECT COALESCE(SUM(amount),0) FROM online_payment_requests WHERE created_at >= ? AND created_at < ?');
$q->execute([$monthStart, $monthEnd]); $requested = (float)$q->fetchColumn();
$labels = ['pending'=>'Kutilmoqda','paid'=>'To‘langan','rejected'=>'Rad etilgan'];
$monthNames = ['January'=>'Yanvar','February'=>'Fevral','March'=>'Mart','April'=>'Aprel','May'=>'May','June'=>'Iyun','July'=>'Iyul','August'=>'Avgust','September'=>'Sentabr','October'=>'Oktabr','November'=>'Noyabr','December'=>'Dekabr'];
$monthLabel = ($monthNames[date('F', strtotime($monthStart))] ?? date('F', strtotime($monthStart))) . ' ' . date('Y', strtotime($monthStart));
?>
<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oylik to‘lovlar</title><link rel="stylesheet" href="../assets/css/style.css?v=8"><style>
.status-pending{background:#fff3dc;color:#a36b12}.status-paid{background:#e3f8ed;color:#168255}.status-rejected{background:#ffeded;color:#b54141}.action-form{display:flex;gap:5px;align-items:center}.action-form select{padding:7px;border:1px solid #ddd;border-radius:7px}.action-form button{border:0;background:#eaf0ff;color:#315fc8;padding:7px 10px;border-radius:7px;font-weight:700}.month-filter{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;padding:18px;background:#fff;border:1px solid var(--line);border-radius:14px}.month-filter label{font-size:12px;font-weight:700}.month-filter select{display:block;margin-top:7px;padding:12px;border:1px solid #dfe5ef;border-radius:9px;min-width:190px}
</style></head><body class="dashboard-body">
<header class="site-header"><a class="brand" href="dashboard.php"><span class="brand-mark">A</span><span>ALGORITM<small>Administrator</small></span></a><nav><a href="dashboard.php">Panel</a><a href="courses.php">Kurslar</a><a class="nav-cta" href="logout.php">Chiqish</a></nav></header>
<main class="dashboard"><div class="dashboard-title"><div><span class="eyebrow">ADMINISTRATOR</span><h1>Oylik to‘lovlar</h1><p>Masalan, oktabr oyi uchun to‘lovlar ro‘yxatini alohida ko‘ring.</p></div><a class="button primary" href="../payment.php">To‘lov sahifasi ↗</a></div>
<?php if(isset($_GET['updated'])): ?><div class="alert success">To‘lov holati yangilandi.</div><?php endif; ?>
<form method="get" class="month-filter"><label>Oyni tanlang<select name="month"><?php for($i=0;$i<24;$i++): $m=date('Y-m',strtotime(date('Y-m-01')." -$i months")); $mLabel=($monthNames[date('F',strtotime($m.'-01'))]??date('F',strtotime($m.'-01'))).' '.date('Y',strtotime($m.'-01')); ?><option value="<?= htmlspecialchars($m) ?>" <?= $month===$m?'selected':'' ?>><?= htmlspecialchars($mLabel) ?></option><?php endfor; ?></select></label><button class="button primary" type="submit">Ro‘yxatni ko‘rsatish</button></form>
<section class="table-card" style="margin-bottom:18px"><div class="table-heading"><div><h2>Oylar bo‘yicha alohida ro‘yxatlar</h2><p>Kerakli oy nomini bosing — faqat shu oy to‘lovlari ochiladi.</p></div></div><div style="display:flex;flex-wrap:wrap;gap:8px;padding:16px"><?php for($i=0;$i<12;$i++): $am=date('Y-m',strtotime(date('Y-m-01')." -$i months")); $an=($monthNames[date('F',strtotime($am.'-01'))]??date('F',strtotime($am.'-01'))).' '.date('Y',strtotime($am.'-01')); ?><a class="button <?= $month===$am?'primary':'secondary' ?>" href="payments.php?month=<?= htmlspecialchars($am) ?>"><?= htmlspecialchars($an) ?></a><?php endfor; ?></div></section>
<div class="stats-grid"><article class="stat-card"><span><?= htmlspecialchars($monthLabel) ?> so‘rovlar soni</span><strong><?= count($rows) ?></strong><small>Tanlangan oy</small></article><article class="stat-card"><span>Jami so‘ralgan summa</span><strong><?= number_format($requested,0,'.',' ') ?> so‘m</strong><small><?= htmlspecialchars($monthLabel) ?></small></article><article class="stat-card"><span>Tasdiqlangan to‘lovlar</span><strong><?= number_format($paid,0,'.',' ') ?> so‘m</strong><small>Faqat “To‘langan” deb belgilangan</small></article><article class="stat-card"><span>Kutilayotgan</span><strong><?= count(array_filter($rows,fn($r)=>$r['status']==='pending')) ?></strong><small>Tekshirish talab etiladi</small></article></div>
<section class="table-card"><div class="table-heading"><div><h2><?= htmlspecialchars($monthLabel) ?> oylik to‘lovlar ro‘yxati</h2><p>Tanlangan oyda yuborilgan to‘lov so‘rovlari va cheklarni ko‘ring.</p></div></div><div class="table-scroll"><table><thead><tr><th>O‘quvchi</th><th>Telefon</th><th>Kurs</th><th>Summa</th><th>Usul</th><th>Chek</th><th>Karta oxiri</th><th>Sana</th><th>Holat</th><th>Yangilash</th></tr></thead><tbody>
<?php foreach($rows as $r): ?><tr><td><strong><?= htmlspecialchars($r['full_name']) ?></strong></td><td><?= htmlspecialchars($r['phone']) ?></td><td><?= htmlspecialchars($r['course_name']) ?></td><td><?= number_format((float)$r['amount'],0,'.',' ') ?> so‘m</td><td><?= htmlspecialchars(['click'=>'Click','payme'=>'Payme','bank'=>'Bank/administrator'][$r['provider']]??$r['provider']) ?></td><td><?php if(!empty($r['receipt_path'])): ?><a target="_blank" rel="noopener" href="../<?= htmlspecialchars($r['receipt_path']) ?>">Chekni ko‘rish ↗</a><?php else: ?>—<?php endif; ?></td><td><?= htmlspecialchars($r['payer_card_last4']??'—') ?></td><td><?= htmlspecialchars($r['created_at']) ?></td><td><span class="status status-<?= htmlspecialchars($r['status']) ?>"><?= $labels[$r['status']]??$r['status'] ?></span></td><td><form class="action-form" method="post"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><input type="hidden" name="month" value="<?= htmlspecialchars($month) ?>"><select name="status"><option value="pending" <?= $r['status']==='pending'?'selected':'' ?>>Kutilmoqda</option><option value="paid" <?= $r['status']==='paid'?'selected':'' ?>>To‘langan</option><option value="rejected" <?= $r['status']==='rejected'?'selected':'' ?>>Rad etish</option></select><button type="submit">Saqlash</button></form></td></tr><?php endforeach; ?>
<?php if(!$rows): ?><tr><td colspan="10" class="empty-state"><?= htmlspecialchars($monthLabel) ?> oyida to‘lov so‘rovlari yo‘q.</td></tr><?php endif; ?></tbody></table></div></section><p class="phase-note">To‘lovni “To‘langan” deb belgilashdan oldin pul tushganini tekshiring. Ro‘yxat to‘lov so‘rovi yuborilgan oy bo‘yicha filtrlanadi.</p></main><script src="../assets/js/theme.js?v=8"></script></body></html>
