<?php
// Test database connection
$host = "sql113.infinityfree.com";
$db_name = "if0_41276444_ChurchTrack";
$username = "if0_41276444";
$password = "FQdKr0jjkK";

echo "Testing connection...<br>";
echo "Host: $host<br>";
echo "Database: $db_name<br>";
echo "Username: $username<br>";
echo "Password: " . str_repeat("*", strlen($password)) . "<br><br>";

try {
    $conn = new PDO(
        "mysql:host=$host;dbname=$db_name",
        $username,
        $password
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "<strong style='color:green;'>✓ Connection successful!</strong><br>";
    
    // Test query
    $stmt = $conn->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "<br>Tables found: " . count($tables) . "<br>";
    echo "<pre>";
    print_r($tables);
    echo "</pre>";
    
} catch(PDOException $e) {
    echo "<strong style='color:red;'>✗ Connection failed!</strong><br>";
    echo "Error: " . $e->getMessage();
}
?>
