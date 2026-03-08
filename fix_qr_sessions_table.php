<?php
echo "=== FIXING QR_SESSIONS TABLE IN AIVEN ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function addColumnIfNotExists($conn, $table, $column, $definition) {
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
        if ($stmt->rowCount() == 0) {
            $conn->exec("ALTER TABLE `$table` ADD COLUMN $column $definition");
            echo "  + Added column: $column\n";
        } else {
            echo "  - Column exists: $column\n";
        }
    } catch (PDOException $e) {
        echo "  ! Error with $column: " . $e->getMessage() . "\n";
    }
}

try {
    echo "Adding missing columns to qr_sessions table...\n";
    
    addColumnIfNotExists($conn, 'qr_sessions', 'service_name', "VARCHAR(255) NOT NULL AFTER session_token");
    addColumnIfNotExists($conn, 'qr_sessions', 'event_datetime', "DATETIME NOT NULL AFTER service_name");
    addColumnIfNotExists($conn, 'qr_sessions', 'event_type', "ENUM('preset','custom') DEFAULT 'preset' AFTER event_datetime");
    addColumnIfNotExists($conn, 'qr_sessions', 'session_type', "ENUM('member','guest') DEFAULT 'member' AFTER event_type");
    addColumnIfNotExists($conn, 'qr_sessions', 'created_by', "INT AFTER session_type");
    addColumnIfNotExists($conn, 'qr_sessions', 'status', "ENUM('active','expired','completed') DEFAULT 'active' AFTER created_by");
    addColumnIfNotExists($conn, 'qr_sessions', 'scan_count', "INT DEFAULT 0 AFTER status");
    addColumnIfNotExists($conn, 'qr_sessions', 'updated_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
    
    // Remove old columns that don't exist in local
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM qr_sessions LIKE 'session_code'");
        if ($stmt->rowCount() > 0) {
            $conn->exec("ALTER TABLE qr_sessions DROP COLUMN session_code");
            echo "  - Removed old column: session_code\n";
        }
    } catch (PDOException $e) {
        echo "  ! Error removing session_code: " . $e->getMessage() . "\n";
    }
    
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM qr_sessions LIKE 'is_active'");
        if ($stmt->rowCount() > 0) {
            $conn->exec("ALTER TABLE qr_sessions DROP COLUMN is_active");
            echo "  - Removed old column: is_active\n";
        }
    } catch (PDOException $e) {
        echo "  ! Error removing is_active: " . $e->getMessage() . "\n";
    }
    
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM qr_sessions LIKE 'expires_at'");
        if ($stmt->rowCount() > 0) {
            $conn->exec("ALTER TABLE qr_sessions DROP COLUMN expires_at");
            echo "  - Removed old column: expires_at\n";
        }
    } catch (PDOException $e) {
        echo "  ! Error removing expires_at: " . $e->getMessage() . "\n";
    }
    
    echo "\n✓ qr_sessions table fixed!\n\n";
    
    echo "=== TABLE FIXED ===\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
