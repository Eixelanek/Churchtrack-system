<?php
// Check Aiven Database Contents
$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$db_name = "defaultdb";
$username = "avnadmin";
$password = "AVNS_YXyhc87L5iDG6SRQ4cg";

echo "=== AIVEN DATABASE CHECK ===\n\n";
echo "Host: $host:$port\n";
echo "Database: $db_name\n";
echo "Username: $username\n\n";

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db_name;charset=utf8mb4";
    $conn = new PDO($dsn, $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✓ Connection successful!\n\n";
    
    // List all tables
    echo "=== TABLES ===\n";
    $stmt = $conn->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($tables)) {
        echo "⚠️  NO TABLES FOUND! Database is empty.\n\n";
    } else {
        echo "Found " . count($tables) . " tables:\n";
        foreach ($tables as $table) {
            echo "  - $table\n";
        }
        echo "\n";
        
        // Check row counts for important tables
        echo "=== ROW COUNTS ===\n";
        $importantTables = ['admin', 'members', 'attendance_records', 'events', 'qr_sessions'];
        
        foreach ($importantTables as $table) {
            if (in_array($table, $tables)) {
                $stmt = $conn->query("SELECT COUNT(*) FROM `$table`");
                $count = $stmt->fetchColumn();
                echo "  $table: $count rows\n";
            } else {
                echo "  $table: ⚠️  TABLE NOT FOUND\n";
            }
        }
        
        // Check admin user
        if (in_array('admin', $tables)) {
            echo "\n=== ADMIN USERS ===\n";
            $stmt = $conn->query("SELECT id, username FROM admin LIMIT 5");
            $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($admins as $admin) {
                echo "  ID: {$admin['id']}, Username: {$admin['username']}\n";
            }
        }
        
        // Check members
        if (in_array('members', $tables)) {
            echo "\n=== MEMBERS (First 5) ===\n";
            $stmt = $conn->query("SELECT id, CONCAT(first_name, ' ', surname) as name, status FROM members LIMIT 5");
            $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($members as $member) {
                echo "  ID: {$member['id']}, Name: {$member['name']}, Status: {$member['status']}\n";
            }
        }
    }
    
    echo "\n✓ Database check complete!\n";
    
} catch(PDOException $e) {
    echo "✗ Connection failed!\n";
    echo "Error: " . $e->getMessage() . "\n";
}
?>
