<?php
echo "=== RESETTING MEMBER PASSWORD ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    $username = 'carlossantiago';
    $newPassword = '12345678';
    
    // Hash the password
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // Update the password
    $stmt = $conn->prepare("UPDATE members SET password = :password WHERE username = :username");
    $stmt->bindParam(':password', $hashedPassword);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        echo "✓ Password reset successfully!\n";
        echo "  Username: $username\n";
        echo "  New Password: $newPassword\n";
    } else {
        echo "✗ User not found: $username\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
