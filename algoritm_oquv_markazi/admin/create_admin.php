<?php
// Bir martalik foydalaning: admin yaratilgach ushbu faylni serverdan O‘CHIRING.
require_once __DIR__ . '/../config/db.php';
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $pdo) {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if (strlen($username) < 3 || strlen($password) < 12) {
        $message = 'Login kamida 3 ta belgi, parol esa kamida 12 ta belgidan iborat bo‘lsin.';
    } else {
        try {
            $stmt = $pdo->prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)');
            $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
            $message = 'Administrator yaratildi. Xavfsizlik uchun hozir bu faylni serverdan o‘chiring.';
        } catch (Throwable $e) { $message = 'Yaratilmadi. Login band bo‘lishi yoki baza sozlanmagan bo‘lishi mumkin.'; }
    }
}
?>
<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin yaratish</title><link rel="stylesheet" href="../assets/css/style.css?v=8"></head><body class="admin-body"><main class="login-wrap"><form class="registration-form login-form" method="post"><h2>Birinchi administrator</h2><p class="form-intro">Faqat bir marta ishlating va keyin faylni o‘chiring.</p><?php if ($message): ?><div class="alert"><?= htmlspecialchars($message) ?></div><?php endif; ?><label>Yangi login<input name="username" required minlength="3"></label><label>Kuchli parol (kamida 12 belgi)<input type="password" name="password" required minlength="12"></label><button class="button primary full">Administrator yaratish</button></form></main><script src="../assets/js/theme.js?v=8"></script></body></html>