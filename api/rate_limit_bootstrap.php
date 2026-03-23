<?php

/**
 * Selective rate limit: Only applies to security-critical endpoints.
 * Loaded via auto_prepend_file (Docker) for API scripts under /api/.
 * Set RATE_LIMIT_DISABLED=1 to bypass. Fails open if the database is unavailable.
 * 
 * RATE LIMITED ENDPOINTS (100 req/hour per IP):
 * 1. Login: /api/admin/login.php, /api/members/login.php, /api/manager/login.php
 * 2. Registration: /api/members/register.php, /api/members/register_mobile.php
 * 3. Password Reset: /api/members/request_password_reset.php, /api/admin/reset_member_password.php
 * 4. Guest endpoints: /api/guest/*
 * 
 * ALL OTHER ENDPOINTS: No rate limiting (dashboard, get operations, etc.)
 */

if (defined('CHURCHTRACK_RATE_LIMIT_RAN')) {
    return;
}
define('CHURCHTRACK_RATE_LIMIT_RAN', true);

if (php_sapi_name() === 'cli') {
    return;
}

$scriptPath = $_SERVER['SCRIPT_FILENAME'] ?? '';
if ($scriptPath !== '' && ! preg_match('#[/\\\\]api[/\\\\]#', $scriptPath)) {
    return;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    return;
}

if (getenv('RATE_LIMIT_DISABLED') === '1') {
    return;
}

// ONLY apply rate limiting to these specific endpoints
$basename = basename($scriptPath);
$shouldRateLimit = false;

// 1. Login endpoints
if (in_array($basename, ['login.php'], true)) {
    $shouldRateLimit = true;
}

// 2. Registration endpoints
if (in_array($basename, ['register.php', 'register_mobile.php'], true)) {
    $shouldRateLimit = true;
}

// 3. Password reset endpoints
if (in_array($basename, ['request_password_reset.php', 'reset_member_password.php'], true)) {
    $shouldRateLimit = true;
}

// 4. Guest endpoints
if (strpos($scriptPath, '/api/guest/') !== false) {
    $shouldRateLimit = true;
}

// If this endpoint doesn't need rate limiting, skip it
if (!$shouldRateLimit) {
    return;
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
if ($ip !== '') {
    $ip = trim(explode(',', $ip)[0]);
} else {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
if (strlen($ip) > 45) {
    $ip = substr($ip, 0, 45);
}

$windowStart = (int) (floor(time() / 3600) * 3600);
$maxPerHour = (int) (getenv('RATE_LIMIT_PER_HOUR') ?: 100);
if ($maxPerHour <= 0) {
    return;
}
$cap = $maxPerHour + 1;

$configPath = __DIR__ . '/config/database.php';
if (! is_readable($configPath)) {
    return;
}

require_once $configPath;

try {
    $database = new Database();
    $db = $database->getConnection();

    $db->exec(
        'CREATE TABLE IF NOT EXISTS api_rate_limits (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(45) NOT NULL,
            window_start INT UNSIGNED NOT NULL,
            hit_count INT UNSIGNED NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_ip_window (ip, window_start),
            KEY idx_window_cleanup (window_start)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $stmt = $db->prepare(
        'INSERT INTO api_rate_limits (ip, window_start, hit_count) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE hit_count = LEAST(hit_count + 1, ' . (int) $cap . ')'
    );
    $stmt->execute([$ip, $windowStart]);

    $chk = $db->prepare('SELECT hit_count FROM api_rate_limits WHERE ip = ? AND window_start = ?');
    $chk->execute([$ip, $windowStart]);
    $row = $chk->fetch(PDO::FETCH_ASSOC);
    $hits = (int) ($row['hit_count'] ?? 0);

    if ($hits > $maxPerHour) {
        $retry = 3600 - (time() % 3600);
        if ($retry <= 0) {
            $retry = 60;
        }
        http_response_code(429);
        header('Content-Type: application/json; charset=UTF-8');
        header('Retry-After: ' . $retry);
        header('X-RateLimit-Limit: ' . $maxPerHour);
        header('X-RateLimit-Remaining: 0');
        echo json_encode([
            'success' => false,
            'error' => true,
            'message' => 'Too many requests. Limit is ' . $maxPerHour . ' requests per hour. Try again later.',
        ]);
        exit;
    }

    $remaining = max(0, $maxPerHour - $hits);
    header('X-RateLimit-Limit: ' . $maxPerHour);
    header('X-RateLimit-Remaining: ' . $remaining);

    if (random_int(1, 200) === 1) {
        $cutoff = $windowStart - 172800;
        $del = $db->prepare('DELETE FROM api_rate_limits WHERE window_start < ?');
        $del->execute([$cutoff]);
    }
} catch (Throwable $e) {
    error_log('rate_limit_bootstrap: ' . $e->getMessage());
}
