<?php
// Check admin profile data in Aiven database

require_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    echo "Checking admin profile data...\n\n";
    
    $query = "SELECT id, username, first_name, last_name, birthday, email, profile_picture, role, created_at FROM admin WHERE id = 1";
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo "Admin ID: " . $admin['id'] . "\n";
        echo "Username: " . $admin['username'] . "\n";
        echo "First Name: " . ($admin['first_name'] ?: 'NULL') . "\n";
        echo "Last Name: " . ($admin['last_name'] ?: 'NULL') . "\n";
        echo "Birthday: " . ($admin['birthday'] ?: 'NULL') . "\n";
        echo "Email: " . ($admin['email'] ?: 'NULL') . "\n";
        echo "Profile Picture: " . ($admin['profile_picture'] ? substr($admin['profile_picture'], 0, 50) . '... (length: ' . strlen($admin['profile_picture']) . ')' : 'NULL') . "\n";
        echo "Role: " . ($admin['role'] ?: 'NULL') . "\n";
        echo "Created: " . $admin['created_at'] . "\n";
    } else {
        echo "No admin found with ID 1\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
