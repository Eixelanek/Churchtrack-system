-- Family Relationships Table
-- Stores member-to-member family connections with approval workflow

CREATE TABLE IF NOT EXISTS family_relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    relative_id INT NOT NULL,
    relationship_type ENUM('Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other') NOT NULL,
    status ENUM('pending', 'accepted', 'declined', 'removed') DEFAULT 'pending',
    initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    notes VARCHAR(255) NULL,
    created_by INT NULL,
    
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (relative_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_relationship (member_id, relative_id),
    INDEX idx_member_id (member_id),
    INDEX idx_relative_id (relative_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
