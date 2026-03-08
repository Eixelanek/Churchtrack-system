<?php
echo "=== MIGRATING MEMBERS DATA ===\n\n";

$localConn = new PDO("mysql:host=localhost;dbname=faithtrack;charset=utf8mb4", "root", "");
$localConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$aivenConn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb;charset=utf8mb4','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$aivenConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    // Get members from local
    echo "Fetching members from local database...\n";
    $stmt = $localConn->query("SELECT * FROM members");
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Found " . count($members) . " members\n\n";
    
    $inserted = 0;
    foreach ($members as $member) {
        try {
            // Remove generated columns
            unset($member['full_name']);
            unset($member['full_address']);
            
            // Get column names
            $columns = array_keys($member);
            $columnList = '`' . implode('`, `', $columns) . '`';
            $placeholders = ':' . implode(', :', $columns);
            
            // Insert into Aiven
            $insertSQL = "INSERT INTO members ($columnList) VALUES ($placeholders)";
            $insertStmt = $aivenConn->prepare($insertSQL);
            $insertStmt->execute($member);
            
            $inserted++;
            echo "  ✓ Inserted member ID: " . $member['id'] . "\n";
            
        } catch (PDOException $e) {
            echo "  ✗ Error inserting member ID " . $member['id'] . ": " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n=== MIGRATION COMPLETE ===\n";
    echo "Successfully migrated $inserted out of " . count($members) . " members\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
