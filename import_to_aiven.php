<?php
// Import database to Aiven
// Run this file locally: php import_to_aiven.php

echo "Connecting to Aiven MySQL...\n";

$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$dbname = "defaultdb";
$username = "avnadmin";
$password = "AVNS_YXyhc87L5iDG6SRQ4cg"; // Replace with your actual password

try {
    $pdo = new PDO(
        "mysql:host=$host;port=$port;dbname=$dbname",
        $username,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    echo "✓ Connected successfully!\n\n";
    
    // Read SQL file
    $sql = file_get_contents('database_schema_complete.sql');
    
    if ($sql === false) {
        die("Error: Could not read database_schema_complete.sql\n");
    }
    
    echo "Importing database schema...\n";
    
    // Execute SQL
    $pdo->exec($sql);
    
    echo "✓ Database imported successfully!\n";
    echo "\nTables created:\n";
    
    // List tables
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    foreach ($tables as $table) {
        echo "  - $table\n";
    }
    
    echo "\n✓ All done! Your database is ready.\n";
    
} catch(PDOException $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
}
?>
