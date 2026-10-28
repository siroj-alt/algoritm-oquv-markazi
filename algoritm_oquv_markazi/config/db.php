<?php
// 1) schema.sql faylini MySQL bazangizga import qiling.
// 2) Quyidagi qiymatlarni hostingingizdagi baza ma'lumotlariga almashtiring.
$DB_HOST = getenv('DB_HOST') ?: 'localhost';
$DB_NAME = getenv('DB_NAME') ?: 'algoritm_center';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') ?: '';
try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
         PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
         PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (PDOException $e) {
    // Public pages can show demo content if DB is not configured.
    $pdo = null;
}
