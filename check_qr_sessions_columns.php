<?php
$conn = new PDO('mysql:host=churchtrack-db-churchtrack.a.aivencloud.com;port=17629;dbname=defaultdb','avnadmin','AVNS_YXyhc87L5iDG6SRQ4cg');

echo "QR_SESSIONS table columns:\n";
$stmt = $conn->query('DESCRIBE qr_sessions');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  - " . $row['Field'] . " (" . $row['Type'] . ")\n";
}
?>
