<?php
$conn = new PDO(
    'mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb', 
    'avnadmin', 
    'AVNS_YXyhc87L5iDG6SRQ4cg'
);

echo "=== MEMBERS TABLE SCHEMA ===\n\n";
$stmt = $conn->query('DESCRIBE members');
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " - " . $row['Type'] . "\n";
}
?>
