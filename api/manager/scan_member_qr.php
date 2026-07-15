<?php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';
require_once __DIR__ . '/../members/inactive_utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $data = json_decode(file_get_contents("php://input"), true);

    // --- Auth ---
    $sessionId = isset($data['session_id']) ? trim($data['session_id']) : '';
    $managerId = isset($data['manager_id']) ? intval($data['manager_id']) : 0;

    if ($sessionId === '' || $managerId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized. Session and manager ID required.']);
        exit();
    }

    $sessionStmt = $db->prepare(
        "SELECT is_active FROM admin_sessions 
         WHERE session_id = :session_id AND admin_id = :admin_id 
         LIMIT 1"
    );
    $sessionStmt->bindParam(':session_id', $sessionId);
    $sessionStmt->bindParam(':admin_id', $managerId, PDO::PARAM_INT);
    $sessionStmt->execute();
    $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

    if (!$session || !(bool)$session['is_active']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Session is invalid or expired.']);
        exit();
    }

    // --- Validate input ---
    $qrToken = isset($data['qr_token']) ? trim($data['qr_token']) : '';
    $eventId = isset($data['event_id']) ? intval($data['event_id']) : 0;

    if (empty($qrToken)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'QR token is required.']);
        exit();
    }

    if ($eventId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Event ID is required.']);
        exit();
    }

    // --- Look up member by qr_token ---
    $memberStmt = $db->prepare(
        "SELECT id, first_name, surname, status, profile_picture, birthday
         FROM members 
         WHERE qr_token = :qr_token 
         LIMIT 1"
    );
    $memberStmt->bindParam(':qr_token', $qrToken);
    $memberStmt->execute();
    $member = $memberStmt->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'QR code not recognized. This QR code does not belong to any member.'
        ]);
        exit();
    }

    $memberId   = (int)$member['id'];
    $memberName = trim($member['first_name'] . ' ' . $member['surname']);

    // --- Validate event ---
    $eventStmt = $db->prepare(
        "SELECT id, title, status, date FROM events WHERE id = :event_id LIMIT 1"
    );
    $eventStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
    $eventStmt->execute();
    $event = $eventStmt->fetch(PDO::FETCH_ASSOC);

    if (!$event) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Event not found.']);
        exit();
    }

    if ($event['status'] === 'completed') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Cannot record attendance for a completed event.']);
        exit();
    }

    // --- Check for duplicate attendance ---
    $dupStmt = $db->prepare(
        "SELECT id, status FROM attendance 
         WHERE event_id = :event_id AND member_id = :member_id 
         LIMIT 1"
    );
    $dupStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
    $dupStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $dupStmt->execute();
    $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        http_response_code(200);
        echo json_encode([
            'success'           => true,
            'already_checked_in' => true,
            'message'           => $memberName . ' is already checked in.',
            'member' => [
                'id'              => $memberId,
                'name'            => $memberName,
                'profile_picture' => $member['profile_picture'] ?? null,
                'status'          => $existing['status']
            ]
        ]);
        exit();
    }

    // --- Determine attendance status (present vs late) ---
    $statusValue = 'present';

    $timeStmt = $db->prepare("SELECT start_time FROM events WHERE id = :id LIMIT 1");
    $timeStmt->bindParam(':id', $eventId, PDO::PARAM_INT);
    $timeStmt->execute();
    $timeRow = $timeStmt->fetch(PDO::FETCH_ASSOC);

    if ($timeRow && !empty($timeRow['start_time']) && !empty($event['date'])) {
        $startDateTime = new DateTime($event['date'] . ' ' . $timeRow['start_time'], new DateTimeZone('+08:00'));
        $now           = new DateTime('now', new DateTimeZone('+08:00'));
        $diffMinutes   = ($now->getTimestamp() - $startDateTime->getTimestamp()) / 60;
        if ($diffMinutes > 15) {
            $statusValue = 'late';
        }
    }

    // --- Insert attendance using MySQL NOW() so timezone is correct ---
    $insertStmt = $db->prepare(
        "INSERT INTO attendance (event_id, member_id, status, check_in_time)
         VALUES (:event_id, :member_id, :status, NOW())"
    );
    $insertStmt->bindParam(':event_id',  $eventId,    PDO::PARAM_INT);
    $insertStmt->bindParam(':member_id', $memberId,   PDO::PARAM_INT);
    $insertStmt->bindParam(':status',    $statusValue);
    $insertStmt->execute();

    // --- Auto-reactivate inactive member ---
    if (strtolower($member['status']) === 'inactive') {
        $reactivateStmt = $db->prepare(
            "UPDATE members SET status = 'active', updated_at = NOW() WHERE id = :id"
        );
        $reactivateStmt->bindParam(':id', $memberId, PDO::PARAM_INT);
        $reactivateStmt->execute();
    }

    // --- Run inactive evaluation for Sunday events ---
    try {
        $eventTitleLower = strtolower($event['title']);
        if (strpos($eventTitleLower, 'sunday') !== false) {
            evaluateInactiveMembers($db);
        }
    } catch (Throwable $e) {
        error_log('Failed to evaluate inactive members: ' . $e->getMessage());
    }

    http_response_code(201);
    echo json_encode([
        'success'            => true,
        'already_checked_in' => false,
        'message'            => $memberName . ' checked in successfully.',
        'status'             => $statusValue,
        'check_in_time'      => (new DateTime('now', new DateTimeZone('+08:00')))->format('g:i A'),
        'member' => [
            'id'              => $memberId,
            'name'            => $memberName,
            'profile_picture' => $member['profile_picture'] ?? null,
            'status'          => $statusValue
        ]
    ]);

} catch (PDOException $e) {
    // Handle race condition duplicate
    if ($e->getCode() == 23000) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Member is already checked in for this event.'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
