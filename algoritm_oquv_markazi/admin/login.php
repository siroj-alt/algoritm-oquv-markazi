<?php
session_start();
require_once __DIR__ . '/../config/db.php';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if ($pdo && $username !== '' && $password !== '') {
        $stmt = $pdo->prepare('SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $admin = $stmt->fetch();
        if ($admin && password_verify($password, $admin['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['admin_id'] = (int)$admin['id'];
            $_SESSION['admin_name'] = $admin['username'];
            header('Location: dashboard.php'); exit;
        }
    }
    $error = 'Login yoki parol noto‘g‘ri, yoki baza sozlanmagan.';
}
?>
<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin kirish — Algoritm</title><link rel="stylesheet" href="../assets/css/style.css?v=8"></head>
<body class="admin-body"><main class="login-wrap"><a class="brand" href="../index.php"><span class="brand-mark">A</span><span>ALGORITM<small>Administrator paneli</small></span></a><form class="registration-form login-form" method="post"><h2>Administrator kirishi</h2><p class="form-intro">Davom etish uchun hisobingizga kiring.</p><?php if ($error): ?><div class="alert error"><?= htmlspecialchars($error) ?></div><?php endif; ?><label>Login<input name="username" required autocomplete="username"></label><label>Parol<input type="password" name="password" required autocomplete="current-password"></label><button class="button primary full" type="submit">Kirish →</button><a class="text-link" href="../index.php">← Bosh sahifaga qaytish</a></form></main><script src="../assets/js/theme.js?v=8"></script></body></html>