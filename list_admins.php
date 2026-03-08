<?php
// List all admins in Aiven database

require_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    echo "Listing all admins...\n\n";
    
    $query = "SELECT id, username, first_name, last_name, email, role FROM admin ORDER BY id";
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        while ($admin = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "ID: " . $admin['id'] . "\n";
            echo "  Username: " . $admin['username'] . "\n";
            echo "  Name: " . ($admin['first_name'] ?: 'NULL') . " " . ($admin['last_name'] ?: 'NULL') . "\n";
            echo "  Email: " . ($admin['email'] ?: 'NULL') . "\n";
            echo "  Role: " . ($admin['role'] ?: 'NULL') . "\n";
            echo "\n";
        }
    } else {
        echo "No admins found\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
