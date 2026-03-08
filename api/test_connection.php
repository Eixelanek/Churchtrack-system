<?php
// Add CORS headers for cross-origin requests
// Test database connection using the Database class
require_once 'config/database.php';

echo "Testing connection using Database class...<br><br>";

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    if ($conn) {
        echo "<strong style='color:green;'>✓ Connection successful!</strong><br>";
        
        // Test query
        $stmt = $conn->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "<br>Tables found: " . count($tables) . "<br>";
        echo "<pre>";
        print_r($tables);
        echo "</pre>";
    } else {
        echo "<strong style='color:red;'>✗ Connection failed!</strong><br>";
    }
    
} catch(PDOException $e) {
    echo "<strong style='color:red;'>✗ Connection failed!</strong><br>";
    echo "Error: " . $e->getMessage();
}
?>
