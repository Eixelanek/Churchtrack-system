<?php
// Simple test to check guest data
header('Content-Type: application/json; charset=UTF-8');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Count guests
    $countStmt = $db->query("SELECT COUNT(*) as count FROM guests");
    $count = $countStmt->fetch(PDO::FETCH_ASSOC)['count'];

    // Get all guests (simple query)
    $stmt = $db->query("SELECT * FROM guests ORDER BY created_at DESC LIMIT 10");
    $guests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'total_guests' => $count,
        'sample_guests' => $guests,
        'message' => "Found $count guests in database"
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
