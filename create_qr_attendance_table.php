<?php
echo "=== CREATING QR_ATTENDANCE TABLE IN AIVEN ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    echo "Creating qr_attendance table...\n";
    
    $sql = "CREATE TABLE IF NOT EXISTS qr_attendance (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $conn->exec($sql);
    echo "✓ qr_attendance table created successfully!\n\n";
    
    echo "=== TABLE CREATED ===\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
