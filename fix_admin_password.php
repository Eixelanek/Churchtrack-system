<?php
// Fix Admin Password in Aiven Database
// This script updates the admin password to "admin123"

// Aiven Database Configuration
$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$dbname = "defaultdb";
$username = "avnadmin";
$password = "AVNS_YXyhc87L5iDG6SRQ4cg"; // Your Aiven password

try {
    // Connect to database
    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    
    $pdo = new PDO($dsn, $username, $password, $options);
    echo "✅ Connected to Aiven database\n";
    
    // Generate new password hash for "admin123"
    $newPassword = 'admin123';
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    
    echo "Generated hash for 'admin123': $hashedPassword\n\n";
    
    // Check current admin user
    $stmt = $pdo->query("SELECT id, username, email FROM admin WHERE username = 'admin'");
    $admin = $stmt->fetch();
    
    if ($admin) {
        echo "Found admin user:\n";
        echo "  ID: {$admin['id']}\n";
        echo "  Username: {$admin['username']}\n";
        echo "  Email: {$admin['email']}\n\n";
        
        // Update password
        $updateStmt = $pdo->prepare("UPDATE admin SET password = :password WHERE username = 'admin'");
        $updateStmt->execute(['password' => $hashedPassword]);
        
        echo "✅ Password updated successfully!\n";
        echo "New credentials:\n";
        echo "  Username: admin\n";
        echo "  Password: admin123\n\n";
        
        // Verify the update
        $verifyStmt = $pdo->query("SELECT password FROM admin WHERE username = 'admin'");
        $verify = $verifyStmt->fetch();
        
        if (password_verify($newPassword, $verify['password'])) {
            echo "✅ Password verification successful!\n";
            echo "You can now login with admin/admin123\n";
        } else {
            echo "❌ Password verification failed!\n";
        }
    } else {
        echo "❌ Admin user not found!\n";
        echo "Creating new admin user...\n";
        
        $insertStmt = $pdo->prepare("
            INSERT INTO admin (username, password, email, full_name) 
            VALUES ('admin', :password, 'admin@churchtrack.com', 'System Administrator')
        ");
        $insertStmt->execute(['password' => $hashedPassword]);
        
        echo "✅ Admin user created!\n";
        echo "Credentials:\n";
        echo "  Username: admin\n";
        echo "  Password: admin123\n";
    }
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
