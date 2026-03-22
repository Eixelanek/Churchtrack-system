-- Optional: table is auto-created by api/rate_limit_bootstrap.php on first request.
-- 100 requests per client IP per UTC hour bucket.

CREATE TABLE IF NOT EXISTS api_rate_limits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    window_start INT UNSIGNED NOT NULL,
    hit_count INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_ip_window (ip, window_start),
    KEY idx_window_cleanup (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
