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

    // Get session token from query parameter
    $sessionToken = isset($_GET['token']) ? trim($_GET['token']) : '';

    if (empty($sessionToken)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Session token is required'
        ]);
        exit();
    }

    $memberId = isset($_GET['member_id']) ? intval($_GET['member_id']) : null;
    $memberName = isset($_GET['member_name']) ? trim($_GET['member_name']) : null;

    // Auto-complete sessions past their allowed duration and mark linked events completed
    $completeQuery = "UPDATE qr_sessions qs
                      LEFT JOIN events e ON qs.event_id = e.id
                      SET qs.status = 'completed',
                          qs.updated_at = NOW(),
                          e.status = CASE WHEN e.id IS NULL THEN e.status ELSE 'completed' END,
                          e.updated_at = CASE WHEN e.id IS NULL THEN e.updated_at ELSE NOW() END,
                          e.auto_ended = CASE WHEN e.id IS NULL THEN e.auto_ended ELSE 1 END
                      WHERE qs.status = 'active'
                        AND qs.event_datetime <= DATE_SUB(NOW(), INTERVAL CASE
                            WHEN LOWER(TRIM(qs.service_name)) = 'sunday service' THEN 4
                            ELSE 2
                          END HOUR)";
    $db->exec($completeQuery);

    // Fetch session details
    $query = "SELECT id, session_token, service_name, event_datetime, event_type, session_type, event_id, status, scan_count, created_at 
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

    $timezone = new DateTimeZone('Asia/Manila');
    $now = new DateTime('now', $timezone);
    $eventDateTime = !empty($session['event_datetime'])
        ? new DateTime($session['event_datetime'], $timezone)
        : null;

    // Check if session is still active
    if ($session['status'] !== 'active') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This QR code session is no longer active',
            'data' => [
                'status' => $session['status']
            ]
        ]);
        exit();
    }

    // Enforce 30-minute unlock window before event start
    $secondsUntilOpen = 0;
    if ($eventDateTime) {
        $secondsUntilStart = $eventDateTime->getTimestamp() - $now->getTimestamp();
        if ($secondsUntilStart > 1800) {
            $secondsUntilOpen = $secondsUntilStart - 1800;
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Check-in opens 30 minutes before the event start time.',
                'data' => [
                    'status' => 'not_open',
                    'seconds_until_open' => $secondsUntilOpen,
                    'event_datetime' => $eventDateTime->format('Y-m-d H:i:s')
                ]
            ]);
            exit();
        }
    }

    $sessionType = strtolower($session['session_type'] ?? 'member');
    $alreadyCheckedIn = false;
    $isMember = false;
    $isGuest = false;

    // Auto-detect if this is a member or guest based on request
    if ($memberId || $memberName) {
        // Member check-in attempt
        $isMember = true;
        if ($memberId) {
            $dupQuery = "SELECT 1 FROM qr_attendance WHERE session_id = :session_id AND member_id = :member_id LIMIT 1";
            $dupStmt = $db->prepare($dupQuery);
            $dupStmt->bindParam(':session_id', $session['id']);
            $dupStmt->bindParam(':member_id', $memberId);
            $dupStmt->execute();
            $alreadyCheckedIn = (bool) $dupStmt->fetchColumn();
        } elseif ($memberName) {
            $normalizedName = mb_strtolower($memberName);
            $dupQuery = "SELECT 1 FROM qr_attendance WHERE session_id = :session_id AND member_id IS NULL AND LOWER(TRIM(member_name)) = :normalized_name LIMIT 1";
            $dupStmt = $db->prepare($dupQuery);
            $dupStmt->bindParam(':session_id', $session['id']);
            $dupStmt->bindParam(':normalized_name', $normalizedName);
            $dupStmt->execute();
            $alreadyCheckedIn = (bool) $dupStmt->fetchColumn();
        }
    } else {
        // No member info provided - assume guest check-in
        $isGuest = true;
    }

    $expirationHours = strcasecmp(trim($session['service_name'] ?? ''), 'Sunday Service') === 0 ? 4 : 2;
    $secondsUntilEvent = $eventDateTime ? max(0, $eventDateTime->getTimestamp() - $now->getTimestamp()) : null;

    // Return session details
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Session found',
        'data' => [
            'session_id' => $session['id'],
            'service_name' => $session['service_name'],
            'event_datetime' => $session['event_datetime'],
            'event_type' => $session['event_type'],
            'session_type' => $sessionType,
            'event_id' => $session['event_id'],
            'status' => $session['status'],
            'scan_count' => $session['scan_count'],
            'expiration_hours' => $expirationHours,
            'already_checked_in' => $alreadyCheckedIn,
            'is_member' => $isMember,
            'is_guest' => $isGuest,
            'checkin_type' => $isMember ? 'member' : 'guest', // Indicates what type of check-in to show
            'seconds_until_event' => $secondsUntilEvent
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
