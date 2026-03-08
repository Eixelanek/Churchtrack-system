<?php
// CORS handled by Apache (apache-cors.conf)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

require_once '../config/database.php';

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
    if (empty($data['service_name']) || empty($data['event_date']) || empty($data['event_time'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing required fields: service_name, event_date, event_time'
        ]);
        exit();
    }

    $serviceName = trim($data['service_name']);
    $eventDate = trim($data['event_date']);
    $eventTime = trim($data['event_time']);
    $createdBy = isset($data['created_by']) ? intval($data['created_by']) : null;
    $eventType = isset($data['event_type']) ? trim($data['event_type']) : 'preset';

    // Generate unified session token (one QR for both members and guests)
    $unifiedSessionToken = bin2hex(random_bytes(16));

    // Combine date and time
    $eventDateTime = $eventDate . ' ' . $eventTime;

    $db->beginTransaction();

    try {
        $eventTypeLabel = $eventType === 'preset' ? 'Service' : 'Custom';

        // Attempt to align with allowed ENUM values (if any) on the events.event_type column
        $allowedEventTypes = [];
        try {
            $columnInfoStmt = $db->prepare("SHOW COLUMNS FROM events LIKE 'event_type'");
            if ($columnInfoStmt->execute()) {
                $columnInfo = $columnInfoStmt->fetch(PDO::FETCH_ASSOC);
                if ($columnInfo && isset($columnInfo['Type']) && stripos($columnInfo['Type'], 'enum(') === 0) {
                    if (preg_match_all("/'([^']+)'/", $columnInfo['Type'], $matches)) {
                        $allowedEventTypes = $matches[1] ?? [];
                    }
                }
            }
        } catch (Exception $columnCheckError) {
            // Ignore schema inspection failures and fall back to defaults
        }

        $candidateEventTypes = [];
        $normalizedServiceName = strtolower($serviceName);

        if ($eventType === 'preset') {
            // Prefer exact service name (e.g., Sunday Service) if allowed
            if ($serviceName !== '') {
                $candidateEventTypes[] = $serviceName;
            }
            // Common fallbacks for preset services
            if ($normalizedServiceName !== '') {
                if (strpos($normalizedServiceName, 'sunday') !== false) {
                    $candidateEventTypes[] = 'Sunday Service';
                }
                if (strpos($normalizedServiceName, 'prayer') !== false) {
                    $candidateEventTypes[] = 'Prayer Meeting';
                }
            }
            $candidateEventTypes[] = 'Service';
            $candidateEventTypes[] = 'Worship Service';
        } else {
            // Custom event fallbacks
            if ($serviceName !== '') {
                $candidateEventTypes[] = $serviceName;
            }
            $candidateEventTypes[] = 'Custom';
            $candidateEventTypes[] = 'Custom Event';
            $candidateEventTypes[] = 'Special Event';
            $candidateEventTypes[] = 'Event';
            $candidateEventTypes[] = 'Service';
        }

        if (!empty($allowedEventTypes)) {
            $foundMatch = false;
            foreach ($candidateEventTypes as $candidateType) {
                if ($candidateType !== '' && in_array($candidateType, $allowedEventTypes, true)) {
                    $eventTypeLabel = $candidateType;
                    $foundMatch = true;
                    break;
                }
            }
            if (!$foundMatch) {
                // Fall back to the first allowed value to avoid ENUM violations
                $eventTypeLabel = $allowedEventTypes[0];
            }
        } else {
            // No ENUM restriction detected; keep sensible defaults
            $eventTypeLabel = $candidateEventTypes[0] ?? $eventTypeLabel;
        }

        $startTime = $eventTime;
        $endTime = $eventTime;

        $timeObject = DateTime::createFromFormat('H:i', $eventTime) ?: DateTime::createFromFormat('H:i:s', $eventTime);
        if ($timeObject) {
            $startTime = $timeObject->format('H:i:s');
            $endTime = (clone $timeObject)->modify('+1 hour')->format('H:i:s');
        }

        $eventLocation = 'QR Session';

        $eventQuery = "INSERT INTO events (title, event_type, date, start_time, end_time, location, status, auto_ended, manually_ended)
                        VALUES (:title, :event_type, :date, :start_time, :end_time, :location, 'active', 0, 0)";
        $eventStmt = $db->prepare($eventQuery);
        $eventStmt->bindParam(':title', $serviceName);
        $eventStmt->bindParam(':event_type', $eventTypeLabel);
        $eventStmt->bindParam(':date', $eventDate);
        $eventStmt->bindParam(':start_time', $startTime);
        $eventStmt->bindParam(':end_time', $endTime);
        $eventStmt->bindParam(':location', $eventLocation);
        $eventStmt->execute();

        $eventId = $db->lastInsertId();

        // Create single unified QR session (works for both members and guests)
        $sessionInsert = "INSERT INTO qr_sessions 
                            (session_token, service_name, event_datetime, event_type, session_type, created_by, status, created_at, event_id) 
                          VALUES 
                            (:session_token, :service_name, :event_datetime, :event_type, :session_type, :created_by, 'active', NOW(), :event_id)";

        $unifiedStmt = $db->prepare($sessionInsert);
        // Use 'member' as default session_type for backwards compatibility, but it will accept both
        $sessionType = 'member';
        $unifiedStmt->bindParam(':session_token', $unifiedSessionToken);
        $unifiedStmt->bindParam(':service_name', $serviceName);
        $unifiedStmt->bindParam(':event_datetime', $eventDateTime);
        $unifiedStmt->bindParam(':event_type', $eventType);
        $unifiedStmt->bindParam(':session_type', $sessionType);
        $unifiedStmt->bindParam(':created_by', $createdBy);
        $unifiedStmt->bindParam(':event_id', $eventId);
        $unifiedStmt->execute();

        $sessionId = (int) $db->lastInsertId();

        $db->commit();

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:3000';
        $frontendBase = $scheme . $host;
        if (!empty($_SERVER['HTTP_ORIGIN'])) {
            $frontendBase = $_SERVER['HTTP_ORIGIN'];
        }

        $frontendBase = rtrim($frontendBase, '/');

        // Unified QR URL - automatically detects member or guest
        $unifiedQrUrl = $frontendBase . '/checkin?session=' . $unifiedSessionToken;

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Unified QR session created successfully',
            'data' => [
                'session_id' => $sessionId,
                'session_token' => $unifiedSessionToken,
                'qr_url' => $unifiedQrUrl,
                'service_name' => $serviceName,
                'event_datetime' => $eventDateTime,
                'status' => 'active',
                'event_id' => $eventId,
                'session_type' => 'unified',
                'event_type' => $eventType,
                'event_type_label' => $eventTypeLabel
            ]
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
