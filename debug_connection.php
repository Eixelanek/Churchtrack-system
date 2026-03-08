<?php
// Debug connection issues
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Connection Debug</h2>";

// Test 1: Check if PDO MySQL is available
echo "<h3>1. PDO MySQL Extension</h3>";
if (extension_loaded('pdo_mysql')) {
    echo "✓ PDO MySQL is available<br>";
} else {
    echo "✗ PDO MySQL is NOT available<br>";
}

// Test 2: Try Aiven connection with detailed error
echo "<h3>2. Aiven Connection Test</h3>";
$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$db = "defaultdb";
$user = "avnadmin";
$pass = "AVNS_YXyhc87L5iDG6SRQ4cg";

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db";
    echo "DSN: $dsn<br>";
    echo "User: $user<br>";
    echo "Attempting connection...<br>";
    
    $conn = new PDO($dsn, $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✓ <strong style='color:green'>Successfully connected to Aiven!</strong><br>";
    
    // Test query
    $result = $conn->query("SELECT COUNT(*) as count FROM members")->fetch();
    echo "Members in database: " . $result['count'] . "<br>";
    
} catch(PDOException $e) {
    echo "✗ <strong style='color:red'>Connection failed:</strong><br>";
    echo "Error: " . $e->getMessage() . "<br>";
    echo "Code: " . $e->getCode() . "<br>";
}

// Test 3: Check if outbound connections are allowed
echo "<h3>3. Outbound Connection Test</h3>";
$socket = @fsockopen($host, $port, $errno, $errstr, 5);
if ($socket) {
    echo "✓ Can connect to $host:$port<br>";
    fclose($socket);
} else {
    echo "✗ Cannot connect to $host:$port<br>";
    echo "Error: $errstr ($errno)<br>";
    echo "<strong>InfinityFree might be blocking external database connections!</strong><br>";
}

// Test 4: Check database.php file
echo "<h3>4. Database Config File</h3>";
$configPath = __DIR__ . '/api/config/database.php';
if (file_exists($configPath)) {
    echo "✓ database.php exists<br>";
    echo "Path: $configPath<br>";
} else {
    echo "✗ database.php not found<br>";
}
?>
