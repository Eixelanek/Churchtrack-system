<?php
// Export data from local MySQL and import to Aiven

echo "=== CHURCHTRACK DATA MIGRATION ===\n";
echo "From: Local MySQL → To: Aiven Cloud\n\n";

// Local database connection
$localHost = "localhost";
$localDb = "faithtrack";
$localUser = "root";
$localPass = "";

// Aiven database connection
$aivenHost = "churchtrack-db-churchtrack.a.aivencloud.com";
$aivenPort = "17629";
$aivenDb = "defaultdb";
$aivenUser = "avnadmin";
$aivenPass = "AVNS_YXyhc87L5iDG6SRQ4cg";

try {
    // Connect to local database
    echo "Connecting to local database...\n";
    $localConn = new PDO("mysql:host=$localHost;dbname=$localDb;charset=utf8mb4", $localUser, $localPass);
    $localConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✓ Connected to local database\n\n";
    
    // Connect to Aiven database
    echo "Connecting to Aiven database...\n";
    $aivenConn = new PDO("mysql:host=$aivenHost;port=$aivenPort;dbname=$aivenDb;charset=utf8mb4", $aivenUser, $aivenPass);
    $aivenConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✓ Connected to Aiven database\n\n";
    
    // Tables to migrate (in order to respect foreign keys)
    $tables = [
        'admin',
        'members',
        'events',
        'attendance',
        'qr_sessions',
        'guests',
        'guest_attendance',
        'family_relationships',
        'event_links',
        'church_settings',
        'admin_sessions',
        'login_history',
        'admin_notifications',
        'member_notifications',
        'notification_reads',
        'password_reset_requests'
    ];
    
    $totalRows = 0;
    
    foreach ($tables as $table) {
        echo "Processing table: $table\n";
        
        // Check if table exists in local database
        try {
            $stmt = $localConn->query("SELECT COUNT(*) FROM `$table`");
            $count = $stmt->fetchColumn();
            
            if ($count == 0) {
                echo "  → Skipped (empty)\n\n";
                continue;
            }
            
            echo "  → Found $count rows\n";
            
            // Get all data from local table
            $stmt = $localConn->query("SELECT * FROM `$table`");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($rows)) {
                echo "  → Skipped (no data)\n\n";
                continue;
            }
            
            // Get column names
            $columns = array_keys($rows[0]);
            $columnList = '`' . implode('`, `', $columns) . '`';
            $placeholders = ':' . implode(', :', $columns);
            
            // Prepare insert statement for Aiven
            $insertSQL = "INSERT INTO `$table` ($columnList) VALUES ($placeholders)";
            $insertStmt = $aivenConn->prepare($insertSQL);
            
            // Insert each row
            $inserted = 0;
            foreach ($rows as $row) {
                try {
                    $insertStmt->execute($row);
                    $inserted++;
                } catch (PDOException $e) {
                    // Skip duplicates or errors
                    if (strpos($e->getMessage(), 'Duplicate entry') === false) {
                        echo "  ⚠️  Error inserting row: " . $e->getMessage() . "\n";
                    }
                }
            }
            
            echo "  ✓ Inserted $inserted rows\n\n";
            $totalRows += $inserted;
            
        } catch (PDOException $e) {
            echo "  ⚠️  Table not found or error: " . $e->getMessage() . "\n\n";
        }
    }
    
    echo "=== MIGRATION COMPLETE ===\n";
    echo "Total rows migrated: $totalRows\n";
    echo "\n✓ Your local data is now in Aiven!\n";
    
} catch (PDOException $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
}
?>
