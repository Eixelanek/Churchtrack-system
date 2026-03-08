<?php
// Add CORS headers for cross-origin requests
// CORS handled by Apache (apache-cors.conf)
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

    $sessionToken = isset($_GET['token']) ? trim($_GET['token']) : '';

    if (empty($sessionToken)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Session token is required'
        ]);
        exit();
    }

    // Auto-complete expired guest sessions
    $completeQuery = "UPDATE qr_sessions qs
                      LEFT JOIN events e ON qs.event_id = e.id
                      SET qs.status = 'completed',
                          qs.updated_at = NOW(),
                          e.status = CASE WHEN e.id IS NULL THEN e.status ELSE 'completed' END,
                          e.updated_at = CASE WHEN e.id IS NULL THEN e.updated_at ELSE NOW() END,
                          e.auto_ended = CASE WHEN e.id IS NULL THEN e.auto_ended ELSE 1 END
                      WHERE qs.status = 'active'
                        AND qs.session_type = 'guest'
                        AND qs.event_datetime <= DATE_SUB(NOW(), INTERVAL CASE
                            WHEN LOWER(TRIM(qs.service_name)) = 'sunday service' THEN 4
                            ELSE 2
                          END HOUR)";
    $db->exec($completeQuery);

    $query = "SELECT id, session_token, service_name, event_datetime, event_type, session_type, status, scan_count, event_id
              FROM qr_sessions
              WHERE session_token = :session_token
              LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':session_token', $sessionToken);
    $stmt->execute();

    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or expired QR code'
        ]);
        exit();
    }

    if (strtolower($session['session_type'] ?? '') !== 'guest') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This QR code is for members. Please use the member check-in page.'
        ]);
        exit();
    }

    if ($session['status'] !== 'active') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This guest QR code session is no longer active',
            'data' => [
                'status' => $session['status']
            ]
        ]);
        exit();
    }

    $expirationHours = strcasecmp(trim($session['service_name'] ?? ''), 'Sunday Service') === 0 ? 4 : 2;

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Session found',
        'data' => [
            'session_id' => (int)$session['id'],
            'service_name' => $session['service_name'],
            'event_datetime' => $session['event_datetime'],
            'event_type' => $session['event_type'],
            'session_type' => $session['session_type'],
            'status' => $session['status'],
            'scan_count' => (int)$session['scan_count'],
            'event_id' => $session['event_id'] ? (int)$session['event_id'] : null,
            'expiration_hours' => $expirationHours
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
