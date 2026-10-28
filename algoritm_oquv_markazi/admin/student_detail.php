<?php
session_start();
if (empty($_SESSION['admin_id'])) { header('Location: login.php'); exit; }
require_once __DIR__ . '/../config/db.php';
if (!$pdo) die('Ma’lumotlar bazasi bilan ulanish yo‘q.');
require_once __DIR__ . '/../config/schema_compat.php';
$id=filter_input(INPUT_GET,'id',FILTER_VALIDATE_INT) ?: 0;
$q=$pdo->prepare('SELECT s.*,c.name AS course_name,c.price AS course_price FROM students s JOIN courses c ON c.id=s.course_id WHERE s.id=?');
$q->execute([$id]); $student=$q->fetch(); if(!$student){http_response_code(404);die('O‘quvchi topilmadi.');}
if($_SERVER['REQUEST_METHOD']==='POST'){
  $status=$_POST['status']??'new';
  if(in_array($status,['new','contacted','enrolled','rejected'],true)){
    if($status==='enrolled') $u=$pdo->prepare("UPDATE students SET status='enrolled', enrolled_at=COALESCE(enrolled_at,NOW()) WHERE id=?");
    else $u=$pdo->prepare('UPDATE students SET status=? WHERE id=?');
    $status==='enrolled' ? $u->execute([$id]) : $u->execute([$status,$id]);
  }
  header('Location: student_detail.php?id='.$id.'&saved=1');exit;
}
$q=$pdo->prepare('SELECT paid_at,amount,payment_method,note FROM payments WHERE student_id=? ORDER BY paid_at DESC');$q->execute([$id]);$manualPayments=$q->fetchAll();
// To‘lov so‘rovlari o‘quvchining telefon raqami va kursi bilan bog‘lanadi.
$q=$pdo->prepare('SELECT created_at,amount,status,receipt_path,phone FROM online_payment_requests WHERE course_id=? ORDER BY created_at DESC');
$q->execute([(int)$student['course_id']]); $allOnlineRows=$q->fetchAll();
$normalizePhone=static fn($v)=>preg_replace('/\D+/','',(string)$v);
$studentPhone=$normalizePhone($student['phone']);
$onlineRows=array_values(array_filter($allOnlineRows,static fn($r)=>$normalizePhone($r['phone'])===$studentPhone));
$months=[]; $start=$student['enrolled_at'] ?: $student['created_at']; $startMonth=strtotime(date('Y-m-01',strtotime($start))); $current=strtotime(date('Y-m-01')); $cursor=$startMonth; $guard=0;
while($cursor <= $current && $guard < 60){$key=date('Y-m',$cursor);$months[$key]=['label'=>date('F Y',$cursor),'paid'=>false,'amount'=>0,'sources'=>[]];$cursor=strtotime('+1 month',$cursor);$guard++;}
$monthNames=['January'=>'Yanvar','February'=>'Fevral','March'=>'Mart','April'=>'Aprel','May'=>'May','June'=>'Iyun','July'=>'Iyul','August'=>'Avgust','September'=>'Sentabr','October'=>'Oktabr','November'=>'Noyabr','December'=>'Dekabr'];
foreach($months as $k=>$v){$months[$k]['label']=($monthNames[date('F',strtotime($k.'-01'))]??date('F',strtotime($k.'-01'))).' '.date('Y',strtotime($k.'-01'));}
foreach($manualPayments as $p){$k=date('Y-m',strtotime($p['paid_at']));if(isset($months[$k])){$months[$k]['paid']=true;$months[$k]['amount']+=(float)$p['amount'];$months[$k]['sources'][]='Admin kiritgan to‘lov';}}
foreach($onlineRows as $p){$k=date('Y-m',strtotime($p['created_at']));if(isset($months[$k]) && $p['status']==='paid'){$months[$k]['paid']=true;$months[$k]['amount']+=(float)$p['amount'];$months[$k]['sources'][]='Chek tasdiqlangan';}}
$labels=['new'=>'Yangi ariza','contacted'=>'Bog‘lanildi','enrolled'=>'Qabul qilindi','rejected'=>'Rad etildi'];
?>
<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= htmlspecialchars($student['full_name']) ?> — Algoritm</title><link rel="stylesheet" href="../assets/css/style.css?v=9"><style>.detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:18px 0}.detail-box{padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.month-paid{color:#168255;font-weight:800}.month-unpaid{color:#b54141;font-weight:800}</style></head><body class="dashboard-body"><header class="site-header"><a class="brand" href="dashboard.php"><span class="brand-mark">A</span><span>ALGORITM<small>Administrator</small></span></a><nav><a href="participants.php">Qatnashchilar</a><a href="payments.php">To‘lovlar</a><a href="dashboard.php">Panel</a><a class="nav-cta" href="logout.php">Chiqish</a></nav></header>
<main class="dashboard"><div class="dashboard-title"><div><span class="eyebrow">O‘QUVCHI MA’LUMOTI</span><h1><?= htmlspecialchars($student['full_name']) ?></h1><p><?= htmlspecialchars($student['course_name']) ?> · <?= htmlspecialchars($student['phone']) ?></p></div><a class="button secondary" href="participants.php?course_id=<?= (int)$student['course_id'] ?>">← Ro‘yxatga qaytish</a></div>
<?php if(isset($_GET['saved'])): ?><div class="alert success">O‘quvchi holati saqlandi.</div><?php endif; ?>
<div class="detail-grid"><div class="detail-box"><small>Ariza topshirilgan</small><h3><?= htmlspecialchars($student['created_at']) ?></h3></div><div class="detail-box"><small>Kursga qabul qilingan sana</small><h3><?= $student['enrolled_at']?htmlspecialchars($student['enrolled_at']):'Hali belgilanmagan' ?></h3></div><div class="detail-box"><small>Kurs narxi</small><h3><?= number_format((float)$student['course_price'],0,'.',' ') ?> so‘m / oy</h3></div></div>
<section class="table-card" style="margin-bottom:20px"><div class="table-heading"><div><h2>Qabul holatini boshqarish</h2><p>“Qabul qilindi” deb belgilaganda qabul sanasi avtomatik saqlanadi.</p></div></div><form method="post" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;padding:18px"><label>Holati<select name="status" style="display:block;padding:12px;border-radius:9px;margin-top:6px"><option value="new" <?= $student['status']==='new'?'selected':'' ?>>Yangi ariza</option><option value="contacted" <?= $student['status']==='contacted'?'selected':'' ?>>Bog‘lanildi</option><option value="enrolled" <?= $student['status']==='enrolled'?'selected':'' ?>>Qabul qilindi</option><option value="rejected" <?= $student['status']==='rejected'?'selected':'' ?>>Rad etildi</option></select></label><button class="button primary" type="submit">Saqlash</button></form></section>
<section class="table-card" style="margin-bottom:20px"><div class="table-heading"><div><h2>Oyma-oy to‘lov holati</h2><p>Faqat administrator tasdiqlagan chek yoki administrator kiritgan to‘lov “To‘langan” deb ko‘rsatiladi.</p></div></div><div class="table-scroll"><table><thead><tr><th>Oy</th><th>Holat</th><th>Qayd etilgan summa</th><th>Manba</th></tr></thead><tbody><?php foreach(array_reverse($months,true) as $m): ?><tr><td><strong><?= htmlspecialchars($m['label']) ?></strong></td><td class="<?= $m['paid']?'month-paid':'month-unpaid' ?>"><?= $m['paid']?'✓ To‘langan':'To‘lanmagan' ?></td><td><?= number_format($m['amount'],0,'.',' ') ?> so‘m</td><td><?= htmlspecialchars($m['sources']?implode(', ',array_unique($m['sources'])):'To‘lov qaydi topilmadi') ?></td></tr><?php endforeach; ?><?php if(!$months): ?><tr><td colspan="4">Oylik ma’lumot mavjud emas.</td></tr><?php endif; ?></tbody></table></div></section>
<section class="table-card"><div class="table-heading"><div><h2>To‘lov so‘rovlari tarixi</h2><p>Chek yuborilgan sanalar va tasdiqlash holati.</p></div></div><div class="table-scroll"><table><thead><tr><th>Sana</th><th>Summa</th><th>Holat</th><th>Chek</th></tr></thead><tbody><?php foreach($onlineRows as $p): ?><tr><td><?= htmlspecialchars($p['created_at']) ?></td><td><?= number_format((float)$p['amount'],0,'.',' ') ?> so‘m</td><td><?= htmlspecialchars(['pending'=>'Kutilmoqda','paid'=>'To‘langan','rejected'=>'Rad etilgan'][$p['status']]??$p['status']) ?></td><td><?php if($p['receipt_path']): ?><a href="../<?= htmlspecialchars($p['receipt_path']) ?>" target="_blank" rel="noopener">Ko‘rish ↗</a><?php else: ?>—<?php endif; ?></td></tr><?php endforeach; ?><?php if(!$onlineRows): ?><tr><td colspan="4">To‘lov so‘rovlari topilmadi.</td></tr><?php endif; ?></tbody></table></div></section></main><script src="../assets/js/theme.js?v=9"></script></body></html>
