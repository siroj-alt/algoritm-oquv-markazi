<?php
function site_settings(PDO $pdo): array { try { $rows=$pdo->query('SELECT setting_key,setting_value FROM site_settings')->fetchAll(PDO::FETCH_KEY_PAIR); return is_array($rows)?$rows:[]; } catch(Throwable $e){return [];} }
function setting(array $s,string $key,string $default=''): string { return (string)($s[$key]??$default); }
