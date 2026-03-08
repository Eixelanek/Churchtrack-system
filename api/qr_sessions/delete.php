<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
// CORS handled by Apache (apache-cors.conf)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $data = json_decode(file_get_contents('php://input'), true);

    $sessionId = isset($data['session_id']) ? (int) $data['session_id'] : null;
    $sessionToken = isset($data['session_token']) ? trim($data['session_token']) : '';

    if (!$sessionId && $sessionToken === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Session ID or session token is required'
        ]);
        exit();
    }

    $identifier = $sessionToken !== '' ? $sessionToken : $sessionId;
    $useId = $sessionToken === '';

    $selectQuery = $useId
        ? 'SELECT id, event_id FROM qr_sessions WHERE id = :identifier LIMIT 1'
        : 'SELECT id, event_id FROM qr_sessions WHERE session_token = :identifier LIMIT 1';

    $selectStmt = $db->prepare($selectQuery);
    $paramType = $useId ? PDO::PARAM_INT : PDO::PARAM_STR;
    $selectStmt->bindValue(':identifier', $identifier, $paramType);
    $selectStmt->execute();

    $session = $selectStmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'QR session not found'
        ]);
        exit();
    }

    $db->beginTransaction();

    $deleteSessionQuery = $useId
        ? 'DELETE FROM qr_sessions WHERE id = :identifier LIMIT 1'
        : 'DELETE FROM qr_sessions WHERE session_token = :identifier LIMIT 1';

    $deleteSessionStmt = $db->prepare($deleteSessionQuery);
    $deleteSessionStmt->bindValue(':identifier', $identifier, $paramType);
    $deleteSessionStmt->execute();

    if ($deleteSessionStmt->rowCount() === 0) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to delete QR session'
        ]);
        exit();
    }

    if (!empty($session['event_id'])) {
        $deleteEventStmt = $db->prepare('DELETE FROM events WHERE id = :event_id');
        $deleteEventStmt->bindValue(':event_id', (int) $session['event_id'], PDO::PARAM_INT);
        $deleteEventStmt->execute();
    }

    $db->commit();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'QR session deleted successfully'
    ]);
} catch (Exception $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
