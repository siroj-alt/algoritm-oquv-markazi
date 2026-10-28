<?php
require_once __DIR__ . '/config/db.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !$pdo) {
    header('Location: index.php?error=1#royxat'); exit;
}
$name = trim($_POST['full_name'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$courseId = filter_input(INPUT_POST, 'course_id', FILTER_VALIDATE_INT);
$note = trim($_POST['note'] ?? '');
if ($name === '' || mb_strlen($name) > 120 || $phone === '' || mb_strlen($phone) > 25 || !$courseId || mb_strlen($note) > 1000) {
    header('Location: index.php?error=1#royxat'); exit;
}
try {
    $check = $pdo->prepare('SELECT id FROM courses WHERE id = ? AND is_active = 1');
    $check->execute([$courseId]);
    if (!$check->fetch()) { header('Location: index.php?error=1#royxat'); exit; }
    $stmt = $pdo->prepare('INSERT INTO students (full_name, phone, course_id, note, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
    $stmt->execute([$name, $phone, $courseId, $note, 'new']);
    header('Location: index.php?sent=1#royxat'); exit;
} catch (Throwable $e) {
    header('Location: index.php?error=1#royxat'); exit;
}
