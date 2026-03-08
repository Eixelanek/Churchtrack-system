<?php
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

    // Ensure schema updates have been applied for new guest flow columns/tables
    try {
        $columnCheck = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_sessions' AND COLUMN_NAME = 'session_type'");
        $columnCheck->execute();
        $sessionTypeExists = (int) $columnCheck->fetchColumn() > 0;

        if (!$sessionTypeExists) {
            $db->exec("ALTER TABLE qr_sessions ADD COLUMN session_type ENUM('member','guest') DEFAULT 'member' AFTER event_type");
            $db->exec("CREATE INDEX idx_session_type ON qr_sessions(session_type)");
        }

        $guestTableCheck = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guests'");
        $guestTableCheck->execute();
        $guestsExists = (int) $guestTableCheck->fetchColumn() > 0;
        if (!$guestsExists) {
            $db->exec("CREATE TABLE IF NOT EXISTS guests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                middle_name VARCHAR(100) NULL,
                surname VARCHAR(100) NOT NULL,
                suffix VARCHAR(20) NULL,
                full_name VARCHAR(255) NOT NULL,
                contact_number VARCHAR(50) NULL,
                email VARCHAR(150) NULL,
                invited_by_member_id INT NULL,
                invited_by_text VARCHAR(255) NULL,
                notes TEXT NULL,
                first_visit_date DATE NULL,
                last_visit_date DATE NULL,
                status ENUM('active','converted','archived') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_guest_contact (contact_number, email),
                INDEX idx_guest_name (full_name),
                INDEX idx_guest_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        $guestAttendanceCheck = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guest_attendance'");
        $guestAttendanceCheck->execute();
        $guestAttendanceExists = (int) $guestAttendanceCheck->fetchColumn() > 0;
        if (!$guestAttendanceExists) {
            $db->exec("CREATE TABLE IF NOT EXISTS guest_attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guest_id INT NOT NULL,
                session_id INT NOT NULL,
                event_id INT NULL,
                status ENUM('present','late') DEFAULT 'present',
                checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source ENUM('qr','manual') DEFAULT 'qr',
                notes TEXT NULL,
                UNIQUE KEY unique_guest_session (guest_id, session_id),
                INDEX idx_guest_id (guest_id),
                INDEX idx_session_id_guest (session_id),
                INDEX idx_event_id_guest (event_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    } catch (Exception $schemaException) {
        // If schema adjustment fails, continue so the actual error can bubble up below
    }

    // Auto-complete sessions that are past event time + 2 hours and mark linked events completed
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

    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $status = isset($_GET['status']) ? trim($_GET['status']) : '';
    // Unified QR - no longer filter by session_type, get all sessions
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
    $limit = $limit > 0 ? min($limit, 500) : 100;

    // Build query - use simpler approach that's more compatible
    $queryLimit = min($limit * 3, 300); // Get more to account for duplicates, but cap at 300
    $query = "SELECT id, session_token, service_name, event_datetime, event_type, session_type, status, scan_count, event_id, created_at
              FROM qr_sessions";
    
    $params = [];
    $whereParts = [];
    
    if ($status !== '') {
        $whereParts[] = "status = :status";
        $params[':status'] = $status;
    }
    
    if ($search !== '') {
        $whereParts[] = "service_name LIKE :search";
        $params[':search'] = "%$search%";
    }
    
    if (!empty($whereParts)) {
        $query .= " WHERE " . implode(" AND ", $whereParts);
    }
    
    $query .= " ORDER BY event_datetime DESC, id ASC LIMIT " . intval($queryLimit);

    try {
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->execute();
    } catch (PDOException $e) {
        error_log("QR Sessions List Query Error: " . $e->getMessage() . " | Query: " . $query);
        throw new Exception("Database query failed: " . $e->getMessage());
    }
    
    $allSessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Deduplicate by event_id - keep first session per event
    $eventsSeen = [];
    $sessions = [];
    foreach ($allSessions as $session) {
        $eventId = !empty($session['event_id']) ? (int)$session['event_id'] : null;
        if (!$eventId || !isset($eventsSeen[$eventId])) {
            $sessions[] = $session;
            if ($eventId) {
                $eventsSeen[$eventId] = true;
            }
        }
        if (count($sessions) >= $limit) {
            break;
        }
    }

    // For unified QR, update scan counts to include both members and guests
    $eventIds = array_values(array_filter(array_map(function($s) { 
        return !empty($s['event_id']) ? (int)$s['event_id'] : null; 
    }, $sessions), function($id) { 
        return $id !== null; 
    }));
    
    $memberCounts = [];
    $guestCounts = [];
    
    if (!empty($eventIds)) {
        try {
            $placeholders = implode(',', array_fill(0, count($eventIds), '?'));
            
            // Get member scan counts per event
            $memberCountsQuery = "SELECT qs.event_id, COUNT(DISTINCT qa.id) as member_count
                                 FROM qr_sessions qs
                                 LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
                                 WHERE qs.event_id IN ($placeholders)
                                 GROUP BY qs.event_id";
            $memberCountsStmt = $db->prepare($memberCountsQuery);
            foreach ($eventIds as $idx => $eventId) {
                $memberCountsStmt->bindValue($idx + 1, $eventId, PDO::PARAM_INT);
            }
            $memberCountsStmt->execute();
            while ($row = $memberCountsStmt->fetch(PDO::FETCH_ASSOC)) {
                $memberCounts[(int)$row['event_id']] = (int)$row['member_count'];
            }
            
            // Get guest scan counts per event (direct event_id)
            $guestCountsQuery1 = "SELECT event_id, COUNT(DISTINCT id) as guest_count
                                 FROM guest_attendance
                                 WHERE event_id IN ($placeholders)
                                 GROUP BY event_id";
            $guestCountsStmt1 = $db->prepare($guestCountsQuery1);
            foreach ($eventIds as $idx => $eventId) {
                $guestCountsStmt1->bindValue($idx + 1, $eventId, PDO::PARAM_INT);
            }
            $guestCountsStmt1->execute();
            while ($row = $guestCountsStmt1->fetch(PDO::FETCH_ASSOC)) {
                $eventId = (int)$row['event_id'];
                $guestCounts[$eventId] = (int)$row['guest_count'];
            }
            
            // Get guest scan counts per event (via session, where event_id is NULL)
            $guestCountsQuery2 = "SELECT qs.event_id, COUNT(DISTINCT ga.id) as guest_count
                                 FROM qr_sessions qs
                                 INNER JOIN guest_attendance ga ON ga.session_id = qs.id
                                 WHERE qs.event_id IN ($placeholders) AND ga.event_id IS NULL
                                 GROUP BY qs.event_id";
            $guestCountsStmt2 = $db->prepare($guestCountsQuery2);
            foreach ($eventIds as $idx => $eventId) {
                $guestCountsStmt2->bindValue($idx + 1, $eventId, PDO::PARAM_INT);
            }
            $guestCountsStmt2->execute();
            while ($row = $guestCountsStmt2->fetch(PDO::FETCH_ASSOC)) {
                $eventId = (int)$row['event_id'];
                $guestCounts[$eventId] = ($guestCounts[$eventId] ?? 0) + (int)$row['guest_count'];
            }
        } catch (Exception $e) {
            // If scan count calculation fails, use existing scan_count from session
            error_log("Error calculating scan counts: " . $e->getMessage());
        }
    }
    
    // Update session scan counts
    foreach ($sessions as &$session) {
        $eventId = !empty($session['event_id']) ? (int)$session['event_id'] : null;
        if ($eventId) {
            $memberCount = $memberCounts[$eventId] ?? 0;
            $guestCount = $guestCounts[$eventId] ?? 0;
            $session['scan_count'] = $memberCount + $guestCount;
        }
    }
    unset($session);

    $normalizeExpiration = static function (&$row) {
        if (!isset($row['service_name'])) {
            return;
        }

        $expirationHours = strcasecmp(trim($row['service_name'] ?? ''), 'Sunday Service') === 0 ? 4 : 2;
        $row['expiration_hours'] = $expirationHours;

        $eventDateTime = strtotime($row['event_datetime'] ?? '');
        if ($eventDateTime !== false) {
            $row['expires_at'] = date('Y-m-d H:i:s', strtotime("+{$expirationHours} hours", $eventDateTime));
        }
    };

    foreach ($sessions as &$session) {
        $normalizeExpiration($session);
    }
    unset($session);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => array_values($sessions) // Remove any duplicates by re-indexing
    ]);

} catch (Exception $e) {
    http_response_code(500);
    error_log("QR Sessions List Error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
        'error' => $e->getMessage()
    ]);
}
?>
