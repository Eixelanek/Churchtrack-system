<?php
/**
 * Manual Check-In endpoint
 * Used by Manager's manual check-in panel.
 * Accepts member_id + event_id directly (no QR token needed).
 */

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
    $memberId = isset($data['member_id']) ? intval($data['member_id']) : 0;
    $eventId  = isset($data['event_id'])  ? intval($data['event_id'])  : 0;

    if ($memberId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Member ID is required.']);
        exit();
    }

    if ($eventId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Event ID is required.']);
        exit();
    }

    // --- Look up member ---
    $memberStmt = $db->prepare(
        "SELECT id, first_name, surname, status, profile_picture, birthday
         FROM members 
         WHERE id = :member_id AND status IN ('active', 'inactive')
         LIMIT 1"
    );
    $memberStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
    $memberStmt->execute();
    $member = $memberStmt->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Member not found.']);
        exit();
    }

    $memberName = trim($member['first_name'] . ' ' . $member['surname']);

    // --- Validate event ---
    $eventStmt = $db->prepare(
        "SELECT id, title, status, date, start_time FROM events WHERE id = :event_id LIMIT 1"
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
            'success'            => true,
            'already_checked_in' => true,
            'message'            => $memberName . ' is already checked in.',
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
    $checkInTime = date('Y-m-d H:i:s');

    if (!empty($event['start_time']) && !empty($event['date'])) {
        try {
            $startDateTime = new DateTime($event['date'] . ' ' . $event['start_time']);
            $now           = new DateTime();
            $diffMinutes   = ($now->getTimestamp() - $startDateTime->getTimestamp()) / 60;
            if ($diffMinutes > 15) {
                $statusValue = 'late';
            }
        } catch (Exception $e) {
            // keep 'present' if time parsing fails
        }
    }

    // --- Insert attendance ---
    $insertStmt = $db->prepare(
        "INSERT INTO attendance (event_id, member_id, status, check_in_time)
         VALUES (:event_id, :member_id, :status, :check_in_time)"
    );
    $insertStmt->bindParam(':event_id',      $eventId,      PDO::PARAM_INT);
    $insertStmt->bindParam(':member_id',     $memberId,     PDO::PARAM_INT);
    $insertStmt->bindParam(':status',        $statusValue);
    $insertStmt->bindParam(':check_in_time', $checkInTime);
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
        'check_in_time'      => $checkInTime,
        'member' => [
            'id'              => $memberId,
            'name'            => $memberName,
            'profile_picture' => $member['profile_picture'] ?? null,
            'status'          => $statusValue
        ]
    ]);

} catch (PDOException $e) {
    // Handle race-condition duplicate
    if ($e->getCode() == 23000) {
        http_response_code(200);
        echo json_encode([
            'success'            => true,
            'already_checked_in' => true,
            'message'            => 'Member is already checked in for this event.'
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
