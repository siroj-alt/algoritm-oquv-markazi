<?php
session_start(); if (empty($_SESSION['admin_id'])) { header('Location: login.php'); exit; }
require_once __DIR__ . '/../config/db.php'; if (!$pdo) die('Ma’lumotlar bazasi bilan ulanish yo‘q.');
try{$q=$pdo->prepare('DELETE FROM courses WHERE id=?');$q->execute([(int)($_POST['id'] ?? 0)]);header('Location: courses.php?msg=deleted');exit;}catch(Throwable $e){header('Location: courses.php?msg=error');exit;}
