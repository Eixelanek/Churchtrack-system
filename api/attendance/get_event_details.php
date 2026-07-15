<?php
// Add CORS headers for cross-origin requests
header('Content-Type: application/json');

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
            $lastInitial  = substr($row['surname'], 0, 1);
            $initials      = strtoupper($firstInitial . $lastInitial);
        } else {
            $name  = $row['member_name'] ?: 'Member';
            $parts = preg_split('/\s+/', trim($name));
            $firstInitial = substr($parts[0] ?? 'M', 0, 1);
            $lastInitial  = substr(end($parts) ?: 'M', 0, 1);
            $initials      = strtoupper($firstInitial . $lastInitial);
        }

        $statusRaw   = strtolower($row['att_status'] ?? 'present');
        $statusLabel = match ($statusRaw) {
            'late'    => 'Late',
            'present' => 'Checked in',
            default   => 'Checked in',
        };

        // Display check_in_time as-is — stored in PHT via MySQL connection +08:00
        $timeFormatted = '';
        if (!empty($row['check_in_time'])) {
            try {
                $dt = new DateTime($row['check_in_time']);
                $timeFormatted = $dt->format('g:i A');
            } catch (Exception $e) {
                $timeFormatted = '';
            }
        }

        return [
            'id'              => $row['member_id'] ? (int)$row['member_id'] : 0,
            'memberId'        => $row['member_id'] ? (int)$row['member_id'] : null,
            'name'            => $name,
            'initials'        => $initials,
            'status'          => $statusLabel,
            'checkInTime'     => $timeFormatted,
            'profile_picture' => $row['profile_picture'] ?? null,
        ];
    };

    // ── Source 1: new attendance table (member QR scans via manager) ─────
    $directAttStmt = $db->prepare(
        "SELECT
             a.member_id,
             a.status       AS att_status,
             a.check_in_time,
             m.first_name,
             m.middle_name,
             m.surname,
             m.suffix,
             m.profile_picture,
             NULL           AS member_name
         FROM attendance a
         LEFT JOIN members m ON a.member_id = m.id
         WHERE a.event_id = :event_id
         ORDER BY a.check_in_time ASC"
    );
    $directAttStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
    $directAttStmt->execute();
    $directRows = $directAttStmt->fetchAll(PDO::FETCH_ASSOC);

    // Track member IDs already counted from attendance table
    $seenMemberIds = [];
    foreach ($directRows as $row) {
        $formattedAttendees[] = $formatAttendee($row);
        if ($row['member_id']) {
            $seenMemberIds[(int)$row['member_id']] = true;
        }
    }

    // ── Source 2: legacy qr_attendance (backward compat only) ────────────
    if (!empty($sessions)) {
        $attendeesStmt = $db->prepare(
            "SELECT qa.member_id, qa.member_name, MIN(qa.checkin_datetime) AS check_in_time,
                    'present' AS att_status, m.first_name, m.middle_name, m.surname, m.suffix, m.profile_picture
             FROM qr_attendance qa
             INNER JOIN qr_sessions qs ON qa.session_id = qs.id
             LEFT JOIN members m ON qa.member_id = m.id
             WHERE qs.event_id = :event_id
             GROUP BY qa.member_id, qa.member_name, m.first_name, m.middle_name, m.surname, m.suffix, m.profile_picture
             ORDER BY check_in_time ASC"
        );
        $attendeesStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
        $attendeesStmt->execute();
        foreach ($attendeesStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($row['member_id'] && isset($seenMemberIds[(int)$row['member_id']])) continue;
            $formattedAttendees[] = $formatAttendee($row);
            if ($row['member_id']) $seenMemberIds[(int)$row['member_id']] = true;
        }
    }

    // ── Guests — always fetch regardless of QR sessions ──────────────────
    $guestStmt = $db->prepare(
        "SELECT ga.guest_id, ga.checkin_time, ga.status,
                COALESCE(g.full_name, CONCAT_WS(' ', g.first_name, g.surname)) AS name
         FROM guest_attendance ga
         LEFT JOIN guests g ON ga.guest_id = g.id
         LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
         WHERE ga.event_id = :event_id
            OR (ga.event_id IS NULL AND qs.event_id = :event_id)
         ORDER BY ga.checkin_time ASC"
    );
    $guestStmt->bindParam(':event_id', $eventId, PDO::PARAM_INT);
    $guestStmt->execute();

    foreach ($guestStmt->fetchAll(PDO::FETCH_ASSOC) as $gr) {
        $name = trim($gr['name'] ?? 'Guest Attendee') ?: 'Guest Attendee';
        $parts = preg_split('/\s+/', $name);
        $initials = strtoupper(substr($parts[0] ?? 'G', 0, 1) . substr(end($parts) ?: 'T', 0, 1));
        $status = strtolower($gr['status'] ?? 'present');
        $statusLabel = match ($status) {
            'present' => 'Checked in', 'late' => 'Late', 'absent' => 'Absent',
            default   => ucfirst($status),
        };
        $timeFormatted = '';
        if (!empty($gr['checkin_time'])) {
            try {
                $timeFormatted = (new DateTime($gr['checkin_time']))->format('g:i A');
            } catch (Exception $e) {}
        }
        $formattedAttendees[] = [
            'id'          => 'guest-' . ($gr['guest_id'] ?? uniqid()),
            'memberId'    => null,
            'name'        => $name,
            'initials'    => $initials,
            'status'      => $statusLabel,
            'checkInTime' => $timeFormatted,
            'isGuest'     => true,
        ];
    }

    // Sort all attendees by check-in time (already formatted strings — sort by order added, which is chronological)
    // No re-sort needed since both queries use ORDER BY check_in_time ASC

    // Absentees = active members not in either attendance source
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
                             SELECT 1 FROM attendance a
                             WHERE a.event_id = :abs_event_id AND a.member_id = m.id
                         )
                         AND NOT EXISTS (
                             SELECT 1 FROM qr_attendance qa
                             INNER JOIN qr_sessions qs ON qa.session_id = qs.id
                             WHERE qs.event_id = :abs_event_id AND qa.member_id = m.id
                         )
                       ORDER BY m.surname ASC, m.first_name ASC";

    $absenteesStmt = $db->prepare($absenteesQuery);
    $absenteesStmt->bindParam(':abs_event_id', $eventId, PDO::PARAM_INT);
    $absenteesStmt->execute();
    $absentees = $absenteesStmt->fetchAll(PDO::FETCH_ASSOC);

    $formatAbsentee = function ($row) {
        $nameParts = [];
        if (!empty($row['first_name'])) $nameParts[] = $row['first_name'];
        if (!empty($row['middle_name'])) $nameParts[] = substr($row['middle_name'], 0, 1) . '.';
        if (!empty($row['surname'])) $nameParts[] = $row['surname'];
        if (!empty($row['suffix']) && strtolower($row['suffix']) !== 'none') $nameParts[] = $row['suffix'];
        $name = trim(implode(' ', $nameParts)) ?: 'Unknown Member';

        $firstInitial = substr($row['first_name'] ?? 'U', 0, 1);
        $lastInitial  = substr($row['surname'] ?? 'M', 0, 1);
        $initials      = strtoupper($firstInitial . $lastInitial);

        return [
            'id'              => (int)$row['id'],
            'name'            => $name,
            'initials'        => $initials,
            'status'          => 'Absent',
            'profile_picture' => $row['profile_picture'] ?? null,
        ];
    };

    $formattedAbsentees = array_map($formatAbsentee, $absentees);

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
