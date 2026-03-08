<?php
// Add CORS headers for cross-origin requests
// CORS handled by Apache (apache-cors.conf)
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

    // Validate required fields
    if (empty($data['session_token'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Session token is required'
        ]);
        exit();
    }

    $sessionToken = trim($data['session_token']);
    $memberId = isset($data['member_id']) ? intval($data['member_id']) : null;
    $memberName = isset($data['member_name']) ? trim($data['member_name']) : null;
    $memberContact = isset($data['member_contact']) ? trim($data['member_contact']) : null;

    // Validate that either member_id or member_name is provided
    if (!$memberId && !$memberName) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Either member_id or member_name is required'
        ]);
        exit();
    }

    // Get session details
    $query = "SELECT id, status, session_type, service_name, event_id FROM qr_sessions WHERE session_token = :session_token LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':session_token', $sessionToken);
    $stmt->execute();
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid QR code session'
        ]);
        exit();
    }

    if ($session['status'] !== 'active') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This QR code session is no longer active'
        ]);
        exit();
    }

    // Unified QR - accept both member and guest check-ins
    // No session_type restriction needed

    $sessionId = $session['id'];
    $contextEventId = !empty($session['event_id']) ? (int) $session['event_id'] : null;
    $serviceNameRaw = $session['service_name'] ?? '';
    $isSundayService = labelIndicatesSunday($serviceNameRaw);
    $serviceName = strtolower(trim($serviceNameRaw));

    // Check for duplicate check-in
    $duplicateMessage = 'You have already checked in for this event';
    $shouldEvaluateInactive = $isSundayService;

    if ($memberId) {
        $checkQuery = "SELECT id FROM qr_attendance WHERE session_id = :session_id AND member_id = :member_id LIMIT 1";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->bindParam(':session_id', $sessionId);
        $checkStmt->bindParam(':member_id', $memberId);
        $checkStmt->execute();

        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $duplicateMessage,
                'data' => [
                    'duplicate' => true,
                    'basis' => 'member_id'
                ]
            ]);
            exit();
        }
    } elseif ($memberName) {
        $normalizedName = mb_strtolower(trim($memberName));

        $checkQuery = "SELECT id FROM qr_attendance \
                        WHERE session_id = :session_id \
                          AND member_id IS NULL \
                          AND LOWER(TRIM(member_name)) = :normalized_name \
                        LIMIT 1";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->bindParam(':session_id', $sessionId);
        $checkStmt->bindParam(':normalized_name', $normalizedName);
        $checkStmt->execute();

        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $duplicateMessage,
                'data' => [
                    'duplicate' => true,
                    'basis' => 'member_name'
                ]
            ]);
            exit();
        }
    } else {
        // This should not happen because we already validated inputs, but guard anyway
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Member information missing - cannot proceed'
        ]);
        exit();
    }

    // Get client info
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

    // Insert attendance record
    $insertQuery = "INSERT INTO qr_attendance 
                    (session_id, member_id, member_name, member_contact, ip_address, user_agent) 
                    VALUES 
                    (:session_id, :member_id, :member_name, :member_contact, :ip_address, :user_agent)";

    $insertStmt = $db->prepare($insertQuery);
    $insertStmt->bindParam(':session_id', $sessionId);
    $insertStmt->bindParam(':member_id', $memberId);
    $insertStmt->bindParam(':member_name', $memberName);
    $insertStmt->bindParam(':member_contact', $memberContact);
    $insertStmt->bindParam(':ip_address', $ipAddress);
    $insertStmt->bindParam(':user_agent', $userAgent);

    if ($insertStmt->execute()) {
        // Update scan count
        $updateQuery = "UPDATE qr_sessions SET scan_count = scan_count + 1 WHERE id = :session_id";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->bindParam(':session_id', $sessionId);
        $updateStmt->execute();

        if ($shouldEvaluateInactive) {
            try {
                evaluateInactiveMembers($db);
            } catch (Throwable $e) {
                error_log('Failed to evaluate inactive members after Sunday check-in: ' . $e->getMessage());
            }
        }

        // Auto-reactivate inactive members who attend Sunday Service
        if ($memberId && $isSundayService) {
            $statusQuery = "SELECT status FROM members WHERE id = :member_id LIMIT 1";
            $statusStmt = $db->prepare($statusQuery);
            $statusStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
            $statusStmt->execute();
            $memberStatus = $statusStmt->fetchColumn();

            if ($memberStatus && strtolower($memberStatus) === 'inactive') {
                $reactivateQuery = "UPDATE members SET status = 'active', updated_at = NOW() WHERE id = :member_id";
                $reactivateStmt = $db->prepare($reactivateQuery);
                $reactivateStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
                $reactivateStmt->execute();
            }
        }

        // Check if this is a family check-in (someone checking in on behalf of another member)
        if ($memberId) {
            $checkedInBy = isset($data['checked_in_by']) ? intval($data['checked_in_by']) : null;
            
            // Debug logging
            error_log("Family check-in debug - memberId: {$memberId}, checkedInBy: " . ($checkedInBy ?? 'null'));
            
            if ($checkedInBy && $checkedInBy !== $memberId) {
                // Verify they are family members
                $familyCheckQuery = "SELECT COUNT(*) as is_family 
                                     FROM family_relationships 
                                     WHERE status = 'accepted'
                                     AND ((member_id = :member1 AND relative_id = :member2)
                                          OR (member_id = :member2 AND relative_id = :member1))";
                $familyCheckStmt = $db->prepare($familyCheckQuery);
                $familyCheckStmt->bindParam(':member1', $memberId);
                $familyCheckStmt->bindParam(':member2', $checkedInBy);
                $familyCheckStmt->execute();
                $familyResult = $familyCheckStmt->fetch(PDO::FETCH_ASSOC);
                
                error_log("Family relationship check - is_family: " . ($familyResult['is_family'] ?? 0));
                
                if ($familyResult['is_family'] > 0) {
                    // Get the name of the person who checked them in
                    $nameQuery = "SELECT first_name, surname FROM members WHERE id = :id";
                    $nameStmt = $db->prepare($nameQuery);
                    $nameStmt->bindParam(':id', $checkedInBy);
                    $nameStmt->execute();
                    $checkerName = $nameStmt->fetch(PDO::FETCH_ASSOC);
                    
                    error_log("Checker name retrieved: " . ($checkerName ? 'yes' : 'no'));
                    
                    if ($checkerName) {
                        $checkerFullName = $checkerName['first_name'] . ' ' . $checkerName['surname'];
                        $notifMessage = "{$checkerFullName} checked you in for this event.";
                        
                        // Insert notification
                        $notifQuery = "INSERT INTO member_notifications (member_id, type, message, event_id, related_member_id) 
                                       VALUES (:member_id, 'family_checkin', :message, :event_id, :related_member_id)";
                        $notifStmt = $db->prepare($notifQuery);
                        $notifStmt->bindParam(':member_id', $memberId);
                        $notifStmt->bindParam(':message', $notifMessage);
                        $notifStmt->bindParam(':event_id', $contextEventId);
                        $notifStmt->bindParam(':related_member_id', $checkedInBy);
                        
                        if ($notifStmt->execute()) {
                            error_log("Family check-in notification created successfully for member {$memberId}");
                        } else {
                            error_log("Failed to create family check-in notification for member {$memberId}");
                        }
                    }
                }
            }
        }

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Check-in successful! Thank you for attending.',
            'data' => [
                'attendance_id' => $db->lastInsertId(),
                'session_id' => $sessionId,
                'checkin_time' => date('Y-m-d H:i:s')
            ]
        ]);
    } else {
        throw new Exception('Failed to record attendance');
    }

} catch (PDOException $e) {
    // Handle duplicate entry error (in case of race condition)
    if ($e->getCode() == 23000) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'You have already checked in for this event'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
