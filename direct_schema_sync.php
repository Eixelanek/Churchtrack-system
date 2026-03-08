<?php
echo "=== DIRECT SCHEMA SYNC: LOCAL TO AIVEN ===\n\n";

// Local connection
$localConn = new PDO("mysql:host=localhost;dbname=faithtrack;charset=utf8mb4", "root", "");
$localConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Aiven connection
$aivenConn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb;charset=utf8mb4','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$aivenConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    // Disable foreign key checks
    echo "Disabling foreign key checks...\n";
    $aivenConn->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Get list of tables from local
    echo "Getting tables from local database...\n";
    $stmt = $localConn->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Found " . count($tables) . " tables\n\n";
    
    foreach ($tables as $table) {
        echo "Processing table: $table\n";
        
        try {
            // Get CREATE TABLE statement from local
            $stmt = $localConn->query("SHOW CREATE TABLE `$table`");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $createStatement = $row['Create Table'];
            
            // Drop table in Aiven if exists
            $aivenConn->exec("DROP TABLE IF EXISTS `$table`");
            echo "  - Dropped existing table\n";
            
            // Create table in Aiven
            $aivenConn->exec($createStatement);
            echo "  ✓ Created successfully\n\n";
            
        } catch (PDOException $e) {
            echo "  ✗ Error: " . $e->getMessage() . "\n\n";
        }
    }
    
    // Re-enable foreign key checks
    echo "Re-enabling foreign key checks...\n";
    $aivenConn->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    echo "=== SYNC COMPLETE ===\n";
    echo "All tables synced from local to Aiven\n";
    
} catch (Exception $e) {
    echo "Fatal error: " . $e->getMessage() . "\n";
}
?>
