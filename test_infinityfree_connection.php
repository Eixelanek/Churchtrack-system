<?php
// Test InfinityFree database connection
// Upload this file to your InfinityFree hosting and access it via browser

$host = "sql110.infinityfree.com";
$port = "3306";
$db_name = "if0_41276444_ChurchTrack";
$username = "if0_41276444";
$password = "FQdKr0jjkK";

echo "<h2>Testing InfinityFree Database Connection</h2>";

try {
    $conn = new PDO(
        "mysql:host=$host;port=$port;dbname=$db_name",
        $username,
        $password
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<p style='color: green;'>✓ Successfully connected to database!</p>";
    echo "<p>Database: $db_name</p>";
    echo "<p>Host: $host</p>";
    
    // Test query
    $tables = $conn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "<p>Tables found: " . count($tables) . "</p>";
    
    if (count($tables) > 0) {
        echo "<ul>";
        foreach ($tables as $table) {
            echo "<li>$table</li>";
        }
        echo "</ul>";
    }
    
} catch(PDOException $e) {
    echo "<p style='color: red;'>✗ Connection failed: " . $e->getMessage() . "</p>";
}
?>
