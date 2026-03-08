<?php
$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');

echo "ADMIN table columns:\n";
$stmt = $conn->query('DESCRIBE admin');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  - " . $row['Field'] . "\n";
}

echo "\nMEMBERS table columns:\n";
$stmt = $conn->query('DESCRIBE members');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  - " . $row['Field'] . "\n";
}

echo "\nEVENTS table columns:\n";
$stmt = $conn->query('DESCRIBE events');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  - " . $row['Field'] . "\n";
}
?>
