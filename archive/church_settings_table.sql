-- Church Settings Table
CREATE TABLE IF NOT EXISTS church_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    church_name VARCHAR(255) NOT NULL DEFAULT 'Christ-Like Christian Church',
    church_logo LONGTEXT,
    date_format VARCHAR(20) NOT NULL DEFAULT 'mm/dd/yyyy',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default church settings
INSERT INTO church_settings (church_name, church_logo, date_format) 
VALUES ('Christ-Like Christian Church', NULL, 'mm/dd/yyyy');

