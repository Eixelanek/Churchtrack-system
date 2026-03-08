<?php
echo "=== FIXING AIVEN DATABASE COLUMNS ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Helper function to add column if not exists
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
    // Fix admin table
    echo "Fixing admin table...\n";
    addColumnIfNotExists($conn, 'admin', 'first_name', 'VARCHAR(100) AFTER username');
    addColumnIfNotExists($conn, 'admin', 'last_name', 'VARCHAR(100) AFTER first_name');
    addColumnIfNotExists($conn, 'admin', 'birthday', 'DATE AFTER last_name');
    addColumnIfNotExists($conn, 'admin', 'profile_picture', 'LONGTEXT AFTER birthday');
    addColumnIfNotExists($conn, 'admin', 'role', "VARCHAR(32) DEFAULT 'admin' AFTER updated_at");
    echo "✓ Admin table fixed\n\n";
    
    // Fix members table
    echo "Fixing members table...\n";
    try {
        $conn->exec("ALTER TABLE members CHANGE COLUMN last_name surname VARCHAR(100)");
        echo "  + Renamed last_name to surname\n";
    } catch (PDOException $e) {
        echo "  - Column already named surname or error: " . $e->getMessage() . "\n";
    }
    addColumnIfNotExists($conn, 'members', 'middle_name', 'VARCHAR(100) AFTER first_name');
    addColumnIfNotExists($conn, 'members', 'suffix', 'VARCHAR(20) AFTER surname');
    echo "✓ Members table fixed\n\n";
    
    // Fix events table
    echo "Fixing events table...\n";
    try {
        $conn->exec("ALTER TABLE events CHANGE COLUMN name title VARCHAR(255)");
        echo "  + Renamed name to title\n";
    } catch (PDOException $e) {
        echo "  - Column already named title or error: " . $e->getMessage() . "\n";
    }
    echo "✓ Events table fixed\n\n";
    
    // Fix qr_sessions table
    echo "Fixing qr_sessions table...\n";
    addColumnIfNotExists($conn, 'qr_sessions', 'session_token', 'VARCHAR(255) AFTER id');
    echo "✓ QR sessions table fixed\n\n";
    
    // Fix family_relationships table
    echo "Fixing family_relationships table...\n";
    addColumnIfNotExists($conn, 'family_relationships', 'relative_id', 'INT AFTER member_id');
    echo "✓ Family relationships table fixed\n\n";
    
    // Fix admin_sessions table
    echo "Fixing admin_sessions table...\n";
    addColumnIfNotExists($conn, 'admin_sessions', 'device', 'VARCHAR(255) AFTER ip_address');
    echo "✓ Admin sessions table fixed\n\n";
    
    // Fix login_history table
    echo "Fixing login_history table...\n";
    addColumnIfNotExists($conn, 'login_history', 'device', 'VARCHAR(255) AFTER ip_address');
    echo "✓ Login history table fixed\n\n";
    
    // Fix member_notifications table
    echo "Fixing member_notifications table...\n";
    addColumnIfNotExists($conn, 'member_notifications', 'event_id', 'INT AFTER member_id');
    echo "✓ Member notifications table fixed\n\n";
    
    echo "=== ALL TABLES FIXED ===\n";
    echo "Now you can run export_local_to_aiven.php to migrate data\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
