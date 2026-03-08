<?php
// Fix relationship_to_guardian column in Aiven database
// Change from ENUM to VARCHAR to avoid truncation errors

require_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    echo "Fixing relationship_to_guardian column...\n";
    
    // Change column type from ENUM to VARCHAR(100)
    $alterQuery = "ALTER TABLE members MODIFY COLUMN relationship_to_guardian VARCHAR(100) DEFAULT NULL";
    
    $stmt = $db->prepare($alterQuery);
    $stmt->execute();
    
    echo "✓ Successfully changed relationship_to_guardian to VARCHAR(100)\n";
    echo "✓ Column can now accept any text value without truncation\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
