<?php
/**
 * QR Sessions list endpoint.
 * Returns qr_sessions records with optional status filter.
 */

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $status = isset($_GET['status']) ? trim($_GET['status']) : '';
    $limit  = isset($_GET['limit'])  ? min(200, max(1, (int)$_GET['limit'])) : 50;

    $where = '';
    $params = [];

    if ($status !== '') {
        $allowed = ['active', 'expired', 'completed'];
        if (in_array($status, $allowed, true)) {
            $where = 'WHERE qs.status = :status';
            $params[':status'] = $status;
        }
    }

    $sql = "SELECT 
                qs.id,
                qs.session_token,
                qs.service_name,
                qs.event_datetime,
                qs.event_type,
                qs.session_type,
                qs.status,
                qs.event_id,
                qs.created_at,
                qs.updated_at,
                (SELECT COUNT(*) FROM qr_attendance qa WHERE qa.session_id = qs.id) AS scan_count
            FROM qr_sessions qs
            $where
            ORDER BY qs.event_datetime DESC, qs.created_at DESC
            LIMIT :limit";

    $stmt = $db->prepare($sql);
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        $row['id']         = (int)$row['id'];
        $row['scan_count'] = (int)$row['scan_count'];
        $row['event_id']   = $row['event_id'] !== null ? (int)$row['event_id'] : null;
    }
    unset($row);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data'    => $rows
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
