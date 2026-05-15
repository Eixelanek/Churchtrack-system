<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$sessionId = isset($_GET['id']) ? intval($_GET['id']) : 0;
if (!$sessionId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Session ID is required']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $stmt = $db->prepare(
        "SELECT qs.id, qs.service_name, qs.event_datetime, qs.event_type, qs.session_type,
                qs.status, qs.scan_count, qs.event_id, qs.created_at,
                e.title AS event_title, e.description AS event_description,
                e.location AS event_location
         FROM qr_sessions qs
         LEFT JOIN events e ON e.id = qs.event_id
         WHERE qs.id = :id
         LIMIT 1"
    );
    $stmt->bindParam(':id', $sessionId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Session not found']);
        exit();
    }

    // Total attendees for this session
    $countStmt = $db->prepare("SELECT COUNT(*) FROM qr_attendance WHERE session_id = :id");
    $countStmt->bindParam(':id', $sessionId, PDO::PARAM_INT);
    $countStmt->execute();
    $totalAttendees = (int) $countStmt->fetchColumn();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'session_id'        => (int) $row['id'],
            'service_name'      => $row['service_name'] ?? 'QR Attendance',
            'event_datetime'    => $row['event_datetime'],
            'event_type'        => $row['event_type'],
            'session_type'      => $row['session_type'],
            'status'            => $row['status'],
            'scan_count'        => $totalAttendees,
            'event_id'          => $row['event_id'] ? (int) $row['event_id'] : null,
            'event_title'       => $row['event_title'],
            'event_description' => $row['event_description'],
            'event_location'    => $row['event_location'],
            'created_at'        => $row['created_at'],
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
