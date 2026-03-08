<?php
// Update Aiven database schema to match local database

echo "=== UPDATING AIVEN DATABASE SCHEMA ===\n\n";

$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$db = "defaultdb";
$user = "avnadmin";
$pass = "AVNS_YXyhc87L5iDG6SRQ4cg";

try {
    echo "Connecting to Aiven database...\n";
    $conn = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✓ Connected\n\n";
    
    echo "Reading schema file...\n";
    $sql = file_get_contents('database_schema_complete.sql');
    echo "✓ Schema file loaded\n\n";
    
    echo "Applying schema to Aiven...\n";
    $conn->exec($sql);
    echo "✓ Schema applied successfully!\n\n";
    
    echo "=== SCHEMA UPDATE COMPLETE ===\n";
    echo "Now you can run export_local_to_aiven.php to migrate data\n";
    
} catch (PDOException $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
}
?>
