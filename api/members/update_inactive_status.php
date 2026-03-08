<?php
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';
include_once __DIR__ . '/inactive_utils.php';

$database = new Database();
$db = $database->getConnection();

try {
    $summary = evaluateInactiveMembers($db);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Inactive status updated successfully',
        'checked_members' => $summary['checked_members'],
        'marked_inactive' => $summary['marked_inactive'],
        'marked_details' => $summary['details'],
        'sunday_service_count' => $summary['sunday_service_count'],
        'has_sunday_services' => $summary['has_sunday_services'],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error updating inactive status: ' . $e->getMessage(),
    ]);
}
?>
