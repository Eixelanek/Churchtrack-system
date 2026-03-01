-- QR Sessions Table
-- Run this SQL to create the table for storing QR code sessions

CREATE TABLE IF NOT EXISTS qr_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(64) UNIQUE NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    event_datetime DATETIME NOT NULL,
    event_type ENUM('preset', 'custom') DEFAULT 'preset',
    session_type ENUM('member', 'guest') DEFAULT 'member',
    created_by INT NULL,
    status ENUM('active', 'expired', 'completed') DEFAULT 'active',
    scan_count INT DEFAULT 0,
    event_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_token (session_token),
    INDEX idx_status (status),
    INDEX idx_event_datetime (event_datetime),
    INDEX idx_event_id (event_id),
    INDEX idx_session_type (session_type),
    CONSTRAINT fk_qr_sessions_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- QR Attendance Records Table
-- Stores individual check-ins per session

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

-- Guests Table

CREATE TABLE IF NOT EXISTS guests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    surname VARCHAR(100) NOT NULL,
    suffix VARCHAR(20) NULL,
    full_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(50) NULL,
    email VARCHAR(150) NULL,
    invited_by_member_id INT NULL,
    invited_by_text VARCHAR(255) NULL,
    notes TEXT NULL,
    first_visit_date DATE NULL,
    last_visit_date DATE NULL,
    status ENUM('active', 'converted', 'archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_guest_contact (contact_number, email),
    INDEX idx_guest_name (full_name),
    INDEX idx_guest_status (status),
    CONSTRAINT fk_guests_invited_by_member FOREIGN KEY (invited_by_member_id) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guest Attendance Table

CREATE TABLE IF NOT EXISTS guest_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT NOT NULL,
    session_id INT NOT NULL,
    event_id INT NULL,
    status ENUM('present', 'late') DEFAULT 'present',
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source ENUM('qr', 'manual') DEFAULT 'qr',
    notes TEXT NULL,
    UNIQUE KEY unique_guest_session (guest_id, session_id),
    INDEX idx_guest_id (guest_id),
    INDEX idx_session_id_guest (session_id),
    INDEX idx_event_id_guest (event_id),
    CONSTRAINT fk_guest_attendance_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_attendance_session FOREIGN KEY (session_id) REFERENCES qr_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_guest_attendance_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
