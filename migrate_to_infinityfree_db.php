<?php
// Migrate data from Aiven to InfinityFree MySQL

// Source: Aiven
$sourceHost = "churchtrack-db-churchtrack.a.aivencloud.com";
$sourcePort = "17629";
$sourceDb = "defaultdb";
$sourceUser = "avnadmin";
$sourcePass = "AVNS_YXyhc87L5iDG6SRQ4cg";

// Destination: InfinityFree
$destHost = "sql110.infinityfree.com";
$destPort = "3306";
$destDb = "if0_41276444_ChurchTrack";
$destUser = "if0_41276444";
$destPass = "FQdKr0jjkK";

echo "Connecting to Aiven (source)...\n";
try {
    $sourceConn = new PDO(
        "mysql:host=$sourceHost;port=$sourcePort;dbname=$sourceDb",
        $sourceUser,
        $sourcePass
    );
    $sourceConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✓ Connected to Aiven\n";
} catch(PDOException $e) {
    die("✗ Aiven connection failed: " . $e->getMessage() . "\n");
}

echo "Connecting to InfinityFree (destination)...\n";
try {
    $destConn = new PDO(
        "mysql:host=$destHost;port=$destPort;dbname=$destDb",
        $destUser,
        $destPass
    );
    $destConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✓ Connected to InfinityFree\n\n";
} catch(PDOException $e) {
    die("✗ InfinityFree connection failed: " . $e->getMessage() . "\n");
}

// Get all tables from source
$tables = $sourceConn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

echo "Found " . count($tables) . " tables to migrate\n\n";

// Disable foreign key checks
$destConn->exec("SET FOREIGN_KEY_CHECKS = 0");

foreach ($tables as $table) {
    echo "Processing table: $table\n";
    
    // Get table structure
    $createTableStmt = $sourceConn->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
    $createTableSql = $createTableStmt['Create Table'];
    
    // Drop and recreate table
    try {
        $destConn->exec("DROP TABLE IF EXISTS `$table`");
        $destConn->exec($createTableSql);
        echo "  ✓ Table structure created\n";
    } catch(PDOException $e) {
        echo "  ✗ Failed to create table: " . $e->getMessage() . "\n";
        continue;
    }
    
    // Get row count
    $count = $sourceConn->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    
    if ($count > 0) {
        echo "  Copying $count rows...\n";
        
        // Get all data
        $data = $sourceConn->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($data)) {
            // Get column names
            $columns = array_keys($data[0]);
            $columnList = '`' . implode('`, `', $columns) . '`';
            $placeholders = implode(', ', array_fill(0, count($columns), '?'));
            
            $insertSql = "INSERT INTO `$table` ($columnList) VALUES ($placeholders)";
            $stmt = $destConn->prepare($insertSql);
            
            $inserted = 0;
            foreach ($data as $row) {
                try {
                    $stmt->execute(array_values($row));
                    $inserted++;
                } catch(PDOException $e) {
                    echo "  ✗ Failed to insert row: " . $e->getMessage() . "\n";
                }
            }
            
            echo "  ✓ Inserted $inserted rows\n";
        }
    } else {
        echo "  ✓ Table is empty\n";
    }
    
    echo "\n";
}

// Re-enable foreign key checks
$destConn->exec("SET FOREIGN_KEY_CHECKS = 1");

echo "✓ Migration complete!\n";
echo "\nDatabase migrated to InfinityFree MySQL\n";
echo "Database: $destDb\n";
echo "Host: $destHost\n";
?>
