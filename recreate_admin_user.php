<?php
echo "=== RECREATING ADMIN USER ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    // Check if admin exists
    $stmt = $conn->query("SELECT COUNT(*) FROM admin WHERE username = 'admin'");
    $count = $stmt->fetchColumn();
    
    if ($count > 0) {
        echo "Admin user already exists\n";
    } else {
        echo "Creating admin user...\n";
        
        // Create admin user with password 'admin123'
        $password = password_hash('admin123', PASSWORD_DEFAULT);
        
        $stmt = $conn->prepare("INSERT INTO admin (username, password, email, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
        $stmt->execute(['admin', $password, 'admin@churchtrack.com']);
        
        echo "✓ Admin user created successfully!\n";
        echo "  Username: admin\n";
        echo "  Password: admin123\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
