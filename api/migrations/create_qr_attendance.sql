-- Run this in your database (Aiven/Render) if you get "Table qr_attendance doesn't exist"
-- Prerequisite: qr_sessions table must exist first (run api/qr_sessions/create_table.sql if needed)

CREATE TABLE IF NOT EXISTS qr_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    member_id INT NULL,
    member_name VARCHAR(255) NULL,
    member_contact VARCHAR(100) NULL,
    checkin_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    FOREIGN KEY (session_id) REFERENCES qr_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_member_id (member_id),
    INDEX idx_checkin_datetime (checkin_datetime),
    UNIQUE KEY unique_member_session (session_id, member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
