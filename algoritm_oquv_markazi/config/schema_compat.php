<?php
/**
 * Compatibility migration for databases created by older Algoritm versions.
 * Adds optional columns used by current pages without deleting existing data.
 */
if (!isset($pdo) || !($pdo instanceof PDO)) {
    return;
}

function algoritmEnsureColumn(PDO $pdo, string $table, string $column, string $definition): void
{
    // Table/column identifiers below are internal constants, never user input.
    $existing = $pdo->query("SHOW COLUMNS FROM `{$table}`")->fetchAll(PDO::FETCH_COLUMN, 0);
    if (!in_array($column, $existing, true)) {
        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    }
}

try {
    // Old installations may have only name/price/duration columns in courses.
    foreach ([
        'duration' => 'VARCHAR(100) NULL',
        'description' => 'TEXT NULL',
        'teacher_name' => 'VARCHAR(120) NULL',
        'teacher_bio' => 'TEXT NULL',
        'image_path' => 'VARCHAR(255) NULL',
        'teacher_image' => 'VARCHAR(255) NULL',
        'is_active' => 'TINYINT(1) NOT NULL DEFAULT 1',
    ] as $column => $definition) {
        algoritmEnsureColumn($pdo, 'courses', $column, $definition);
    }

    // Older student tables did not track the date the student was accepted.
    algoritmEnsureColumn($pdo, 'students', 'enrolled_at', 'DATETIME NULL DEFAULT NULL');
} catch (Throwable $e) {
    // Do not expose database details publicly; the affected page can show a useful message.
    error_log('Algoritm schema compatibility check failed: ' . $e->getMessage());
}
