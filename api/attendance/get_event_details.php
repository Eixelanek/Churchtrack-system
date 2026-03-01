<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Get event_id from query parameter
    $eventId = isset($_GET['event_id']) ? $_GET['event_id'] : null;
    
    if (!$eventId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Event ID is required'
        ]);
        exit;
    }
    
    // Get event details
    $query = "SELECT 
                id,
                title,
                event_type,
                date,
                start_time,
                end_time,
                location,
                status
              FROM events
              WHERE id = :event_id";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
    $stmt->execute();
    
    $event = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$event) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Event not found'
        ]);
        exit;
    }
    
    // Determine if event has any QR sessions
    $sessionQuery = "SELECT id, session_token, status, event_datetime
                     FROM qr_sessions
                     WHERE event_id = :event_id";
    $sessionStmt = $db->prepare($sessionQuery);
    $sessionStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
    $sessionStmt->execute();
    $sessions = $sessionStmt->fetchAll(PDO::FETCH_ASSOC);

    $formattedAttendees = [];
    $formattedAbsentees = [];

    if (!empty($sessions)) {
        // Get QR attendees (people who scanned)
        $attendeesQuery = "SELECT 
                                qa.member_id,
                                qa.member_name,
                                MIN(qa.checkin_datetime) AS first_checkin,
                                MAX(qa.checkin_datetime) AS last_checkin,
                                m.first_name,
                                m.middle_name,
                                m.surname,
                                m.suffix,
                                m.profile_picture
                           FROM qr_attendance qa
                           INNER JOIN qr_sessions qs ON qa.session_id = qs.id
                           LEFT JOIN members m ON qa.member_id = m.id
                           WHERE qs.event_id = :event_id
                           GROUP BY qa.member_id, qa.member_name, m.first_name, m.middle_name, m.surname, m.suffix, m.profile_picture
                           ORDER BY first_checkin ASC";

        $attendeesStmt = $db->prepare($attendeesQuery);
        $attendeesStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
        $attendeesStmt->execute();
        $qrAttendees = $attendeesStmt->fetchAll(PDO::FETCH_ASSOC);

        // Helper to derive display name and initials
        $formatAttendee = function ($row) {
            if (!empty($row['first_name']) && !empty($row['surname'])) {
                $name = trim($row['first_name'] . ' ' . $row['surname']);
                if (!empty($row['middle_name'])) {
                    $name = trim($row['first_name'] . ' ' . substr($row['middle_name'], 0, 1) . '. ' . $row['surname']);
                }
                if (!empty($row['suffix']) && strtolower($row['suffix']) !== 'none') {
                    $name .= ' ' . $row['suffix'];
                }
                $firstInitial = substr($row['first_name'], 0, 1);
                $lastInitial = substr($row['surname'], 0, 1);
                $initials = strtoupper($firstInitial . $lastInitial);
            } else {
                $name = $row['member_name'] ?: 'Guest';
                $parts = preg_split('/\s+/', trim($name));
                $firstInitial = substr($parts[0] ?? 'G', 0, 1);
                $lastInitial = substr(end($parts) ?: 'T', 0, 1);
                $initials = strtoupper($firstInitial . $lastInitial);
            }

            return [
                'id' => $row['member_id'] ? (int)$row['member_id'] : 0,
                'memberId' => $row['member_id'] ? (int)$row['member_id'] : null,
                'name' => $name,
                'initials' => $initials,
                'status' => 'Checked in',
                'checkInTime' => $row['first_checkin'],
                'profile_picture' => $row['profile_picture'] ?? null
            ];
        };

        $formattedAttendees = array_map($formatAttendee, $qrAttendees);

        // Fetch guest attendees linked to this event (directly or via QR session)
        $guestQuery = "SELECT 
                            ga.guest_id,
                            ga.checkin_time,
                            ga.status,
                            COALESCE(g.full_name, CONCAT_WS(' ', g.first_name, g.surname)) AS name
                       FROM guest_attendance ga
                       LEFT JOIN guests g ON ga.guest_id = g.id
                       LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
                       WHERE ga.event_id = :event_id
                          OR (ga.event_id IS NULL AND qs.event_id = :event_id)
                       ORDER BY ga.checkin_time ASC";

        $guestStmt = $db->prepare($guestQuery);
        $guestStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
        $guestStmt->execute();
        $guestRows = $guestStmt->fetchAll(PDO::FETCH_ASSOC);

        $formatGuestAttendee = function ($row) {
            $name = trim($row['name'] ?? 'Guest Attendee');
            if ($name === '') {
                $name = 'Guest Attendee';
            }

            $parts = preg_split('/\s+/', $name);
            $firstInitial = substr($parts[0] ?? 'G', 0, 1);
            $lastInitial = substr(end($parts) ?: 'T', 0, 1);
            $initials = strtoupper($firstInitial . $lastInitial);

            $status = strtolower($row['status'] ?? 'present');
            $statusLabel = match ($status) {
                'present' => 'Checked in',
                'late' => 'Checked in',
                'absent' => 'Absent',
                default => ucfirst($status)
            };

            $checkInTime = $row['checkin_time'] ?? null;
            if (!empty($checkInTime)) {
                $checkInTime = date('H:i', strtotime($checkInTime));
            }

            return [
                'id' => 'guest-' . ($row['guest_id'] ?? uniqid()),
                'memberId' => null,
                'name' => $name,
                'initials' => $initials,
                'status' => $statusLabel,
                'checkInTime' => $checkInTime,
                'isGuest' => true
            ];
        };

        $guestAttendees = array_map($formatGuestAttendee, $guestRows);
        $formattedAttendees = array_merge($formattedAttendees, $guestAttendees);

        usort($formattedAttendees, function ($a, $b) {
            $timeA = $a['checkInTime'] ?? '';
            $timeB = $b['checkInTime'] ?? '';

            if ($timeA === $timeB) {
                return strcmp($a['name'], $b['name']);
            }

            if (empty($timeA)) {
                return 1;
            }

            if (empty($timeB)) {
                return -1;
            }

            return strcmp($timeA, $timeB);
        });

        // Compute absentees = active members who did not scan
        $absenteesQuery = "SELECT 
                                m.id,
                                m.first_name,
                                m.middle_name,
                                m.surname,
                                m.suffix,
                                m.profile_picture
                           FROM members m
                           WHERE m.status = 'active'
                             AND NOT EXISTS (
                                 SELECT 1
                                 FROM qr_attendance qa
                                 INNER JOIN qr_sessions qs ON qa.session_id = qs.id
                                 WHERE qs.event_id = :abs_event_id
                                   AND qa.member_id = m.id
                             )
                           ORDER BY m.surname ASC, m.first_name ASC";

        $absenteesStmt = $db->prepare($absenteesQuery);
        $absenteesStmt->bindParam(':abs_event_id', $eventId, PDO::PARAM_INT);
        $absenteesStmt->execute();
        $absentees = $absenteesStmt->fetchAll(PDO::FETCH_ASSOC);

        $formatAbsentee = function ($row) {
            $nameParts = [];
            if (!empty($row['first_name'])) {
                $nameParts[] = $row['first_name'];
            }
            if (!empty($row['middle_name'])) {
                $nameParts[] = substr($row['middle_name'], 0, 1) . '.';
            }
            if (!empty($row['surname'])) {
                $nameParts[] = $row['surname'];
            }
            if (!empty($row['suffix']) && strtolower($row['suffix']) !== 'none') {
                $nameParts[] = $row['suffix'];
            }
            $name = trim(implode(' ', $nameParts)) ?: 'Unknown Member';

            $firstInitial = substr($row['first_name'] ?? 'U', 0, 1);
            $lastInitial = substr($row['surname'] ?? 'M', 0, 1);
            $initials = strtoupper($firstInitial . $lastInitial);

            return [
                'id' => (int)$row['id'],
                'name' => $name,
                'initials' => $initials,
                'status' => 'Absent',
                'profile_picture' => $row['profile_picture'] ?? null
            ];
        };

        $formattedAbsentees = array_map($formatAbsentee, $absentees);
    }

    echo json_encode([
        'success' => true,
        'event' => [
            'id' => (int)$event['id'],
            'title' => $event['title'],
            'type' => $event['event_type'],
            'date' => $event['date'],
            'startTime' => $event['start_time'],
            'endTime' => $event['end_time'],
            'location' => $event['location'],
            'status' => $event['status'],
            'totalAttendees' => count($formattedAttendees),
            'absentCount' => count($formattedAbsentees),
            'qrSessionCount' => count($sessions)
        ],
        'attendees' => $formattedAttendees,
        'absentees' => $formattedAbsentees
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
