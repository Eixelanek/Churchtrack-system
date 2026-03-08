<?php
echo "=== APPLYING LOCAL SCHEMA TO AIVEN ===\n\n";

$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    echo "Reading local schema...\n";
    $sql = file_get_contents('complete_local_schema.sql');
    echo "✓ Schema loaded\n\n";
    
    echo "Applying schema to Aiven (this may take a moment)...\n";
    $conn->exec($sql);
    echo "✓ Schema applied!\n\n";
    
    echo "=== SCHEMA APPLIED SUCCESSFULLY ===\n";
    echo "Now run: php export_local_to_aiven.php\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
