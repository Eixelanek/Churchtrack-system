<?php
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$adminId = isset($_GET['admin_id']) ? intval($_GET['admin_id']) : 0;

if ($adminId <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Admin ID is required.'
    ]);
    exit();
}

try {
    $query = "SELECT session_id, admin_id, device, ip_address, last_activity, user_agent, location, is_active, created_at
              FROM admin_sessions
              WHERE admin_id = :admin_id
              ORDER BY is_active DESC, last_activity DESC";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':admin_id', $adminId, PDO::PARAM_INT);
    $stmt->execute();

    $sessions = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $sessions[] = [
            'sessionId' => $row['session_id'],
            'adminId' => (int)$row['admin_id'],
            'device' => $row['device'] ?: 'Unknown Device',
            'ipAddress' => $row['ip_address'] ?: 'Unknown',
            'lastActivity' => $row['last_activity'],
            'userAgent' => $row['user_agent'] ?: '',
            'location' => $row['location'] ?: 'Unknown',
            'isActive' => (bool)$row['is_active'],
            'createdAt' => $row['created_at']
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $sessions
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
