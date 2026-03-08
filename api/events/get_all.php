<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Auto-complete events that have passed 2 hours from start time
    $auto_complete_query = "UPDATE events 
                           SET status = 'completed', 
                               auto_ended = 1, 
                               manually_ended = 0,
                               updated_at = NOW()
                           WHERE status != 'completed' 
                           AND TIMESTAMPADD(HOUR, 2, CONCAT(date, ' ', start_time)) <= NOW()";
    $db->exec($auto_complete_query);

    // Get all events with attendance data
    $query = "SELECT 
                e.id,
                e.title,
                e.date,
                e.start_time,
                e.end_time,
                e.location,
                e.status,
                e.auto_ended,
                e.manually_ended,
                e.created_at,
                e.updated_at,
                COUNT(a.id) as attendee_count
              FROM events e
              LEFT JOIN attendance a ON e.id = a.event_id
              GROUP BY e.id
              ORDER BY e.date DESC, e.start_time DESC";

    $stmt = $db->prepare($query);
    $stmt->execute();

    $events = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Validate and fix event status if needed
        if ($row['status'] === 'completed' && ($row['auto_ended'] === null || $row['manually_ended'] === null)) {
            // Fix inconsistent completed events
            $fix_query = "UPDATE events SET auto_ended = 0, manually_ended = 1 WHERE id = :id";
            $fix_stmt = $db->prepare($fix_query);
            $fix_stmt->bindParam(":id", $row['id']);
            $fix_stmt->execute();
            
            // Update the row data
            $row['auto_ended'] = 0;
            $row['manually_ended'] = 1;
        }
        
        // Get detailed attendance for this event
        $attendees = [];
        $guestAttendees = [];

        if ($row['status'] === 'completed') {
            // For completed events, show all attendance records (including deleted members for historical accuracy)
            // No need for backward compatibility logic since we preserve all attendance records
            
            // Now get all members with their attendance status (including deleted members for historical accuracy)
            $all_members_query = "SELECT 
                                   COALESCE(m.id, a.member_id) as id,
                                   COALESCE(m.full_name, 'Deleted Member') as name,
                                    COALESCE(m.username, 'deleted') as username,
                                    COALESCE(m.email, 'deleted@example.com') as email,
                                    a.status,
                                    a.check_in_time
                                  FROM attendance a
                                  LEFT JOIN members m ON a.member_id = m.id
                                  WHERE a.event_id = :event_id
                                  ORDER BY COALESCE(m.full_name, 'Deleted Member')";
            
            $all_members_stmt = $db->prepare($all_members_query);
            $all_members_stmt->bindParam(":event_id", $row['id']);
            $all_members_stmt->execute();
           
            while ($member = $all_members_stmt->fetch(PDO::FETCH_ASSOC)) {
                // Format check_in_time to show only hours and minutes
                $formatted_time = '';
                if ($member['check_in_time']) {
                     $formatted_time = date('H:i', strtotime($member['check_in_time']));
                 }
                 
                 $rawStatus = strtolower($member['status'] ?? 'present');
                 $displayStatus = 'Checked in';

                $attendees[] = [
                    'id' => $member['id'],
                    'name' => $member['name'],
                    'status' => $displayStatus,
                    'status_code' => $rawStatus,
                    'time' => $formatted_time
                ];
            }

            $guest_attendance_query = "SELECT 
                                            ga.id,
                                            ga.guest_id,
                                            ga.status,
                                            ga.checkin_time,
                                            COALESCE(g.full_name, CONCAT_WS(' ', g.first_name, g.surname)) AS name
                                       FROM guest_attendance ga
                                       LEFT JOIN guests g ON ga.guest_id = g.id
                                       LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
                                       WHERE ga.event_id = :guest_event_id
                                          OR (ga.event_id IS NULL AND qs.event_id = :guest_event_id)
                                       ORDER BY ga.checkin_time";

            $guest_attendance_stmt = $db->prepare($guest_attendance_query);
            $guest_attendance_stmt->bindParam(":guest_event_id", $row['id']);
            $guest_attendance_stmt->execute();

            while ($guest = $guest_attendance_stmt->fetch(PDO::FETCH_ASSOC)) {
                $formatted_time = '';
                if ($guest['checkin_time']) {
                    $formatted_time = date('H:i', strtotime($guest['checkin_time']));
                }

                $rawStatus = strtolower($guest['status'] ?? 'present');
                $displayStatus = in_array($rawStatus, ['present', 'late'], true)
                    ? 'Checked in'
                    : ucfirst($rawStatus);

                $guestAttendees[] = [
                    'id' => $guest['guest_id'],
                    'name' => $guest['name'] ?: 'Guest Attendee',
                    'status' => $displayStatus,
                    'status_code' => $rawStatus,
                    'time' => $formatted_time,
                    'is_guest' => true
                ];
            }


        } else {
            // For active/upcoming events, check if event has QR sessions
            $sessionCheckQuery = "SELECT id FROM qr_sessions WHERE event_id = :event_id LIMIT 1";
            $sessionCheckStmt = $db->prepare($sessionCheckQuery);
            $sessionCheckStmt->bindParam(":event_id", $row['id']);
            $sessionCheckStmt->execute();
            $hasQrSessions = $sessionCheckStmt->fetch() !== false;

            // Always fetch guests first (they can be linked via event_id or session)
            $guest_attendance_query = "SELECT 
                                              ga.id,
                                              ga.guest_id,
                                              ga.status,
                                              ga.checkin_time,
                                              COALESCE(g.full_name, CONCAT_WS(' ', g.first_name, g.surname)) AS name
                                         FROM guest_attendance ga
                                         LEFT JOIN guests g ON ga.guest_id = g.id
                                         LEFT JOIN qr_sessions qs ON ga.session_id = qs.id
                                         WHERE ga.event_id = :guest_event_id
                                            OR (ga.event_id IS NULL AND qs.event_id = :guest_event_id)
                                         ORDER BY ga.checkin_time";

            $guest_attendance_stmt = $db->prepare($guest_attendance_query);
            $guest_attendance_stmt->bindParam(":guest_event_id", $row['id']);
            $guest_attendance_stmt->execute();

            while ($guest = $guest_attendance_stmt->fetch(PDO::FETCH_ASSOC)) {
                $formatted_time = '';
                if ($guest['checkin_time']) {
                    $formatted_time = date('H:i', strtotime($guest['checkin_time']));
                }

                $rawStatus = strtolower($guest['status'] ?? 'present');
                $displayStatus = in_array($rawStatus, ['present', 'late'], true)
                    ? 'Checked in'
                    : ucfirst($rawStatus);

                $guestAttendees[] = [
                    'id' => $guest['guest_id'],
                    'name' => $guest['name'] ?: 'Guest Attendee',
                    'status' => $displayStatus,
                    'status_code' => $rawStatus,
                    'time' => $formatted_time,
                    'is_guest' => true
                ];
            }

            if ($hasQrSessions) {
                // Event has QR sessions - get attendees from QR attendance
                $qr_attendance_query = "SELECT 
                                          qa.member_id,
                                          qa.member_name,
                                          MIN(qa.checkin_datetime) AS first_checkin,
                                          m.full_name AS name
                                        FROM qr_attendance qa
                                        INNER JOIN qr_sessions qs ON qa.session_id = qs.id
                                        LEFT JOIN members m ON qa.member_id = m.id
                                        WHERE qs.event_id = :event_id
                                        GROUP BY qa.member_id, qa.member_name, m.full_name
                                        ORDER BY first_checkin ASC";

                $qr_attendance_stmt = $db->prepare($qr_attendance_query);
                $qr_attendance_stmt->bindParam(":event_id", $row['id']);
                $qr_attendance_stmt->execute();

                while ($qr_attendee = $qr_attendance_stmt->fetch(PDO::FETCH_ASSOC)) {
                    $formatted_time = '';
                    if ($qr_attendee['first_checkin']) {
                        $formatted_time = date('H:i', strtotime($qr_attendee['first_checkin']));
                    }

                    $attendees[] = [
                        'id' => $qr_attendee['member_id'] ?: 0,
                        'name' => $qr_attendee['name'] ?: $qr_attendee['member_name'] ?: 'Guest',
                        'status' => 'Checked in',
                        'status_code' => 'present',
                        'time' => $formatted_time
                    ];
                }
            } else {
                // No QR sessions - use traditional attendance table
                $attendance_query = "SELECT 
                                      a.id,
                                      a.member_id,
                                      a.status,
                                      a.check_in_time,
                                      m.full_name AS name,
                                      m.username,
                                      m.email
                                    FROM attendance a
                                    JOIN members m ON a.member_id = m.id
                                    WHERE a.event_id = :event_id
                                      ORDER BY a.check_in_time";

                $attendance_stmt = $db->prepare($attendance_query);
                $attendance_stmt->bindParam(":event_id", $row['id']);
                $attendance_stmt->execute();

                while ($attendee = $attendance_stmt->fetch(PDO::FETCH_ASSOC)) {
                    $formatted_time = '';
                    if ($attendee['check_in_time']) {
                        $formatted_time = date('H:i', strtotime($attendee['check_in_time']));
                    }

                    $rawStatus = strtolower($attendee['status'] ?? 'present');
                    $displayStatus = in_array($rawStatus, ['present', 'late'], true)
                        ? 'Checked in'
                        : ucfirst($rawStatus);

                    $attendees[] = [
                        'id' => $attendee['member_id'],
                        'name' => $attendee['name'],
                        'status' => $displayStatus,
                        'status_code' => $rawStatus,
                        'time' => $formatted_time
                    ];
                }

                // Guests already fetched above for all events
            }
        }

        // Format times for frontend compatibility
        $start_time_12hr = date('g:i A', strtotime($row['start_time']));
        $end_time_12hr = date('g:i A', strtotime($row['end_time']));

        // Calculate total attendees including guests
        $totalAttendeesCount = count($attendees) + count($guestAttendees);

        $events[] = [
            'id' => $row['id'],
            'title' => $row['title'],
            'date' => $row['date'],
            'time' => $start_time_12hr,
            'endTime' => $end_time_12hr,
            'location' => $row['location'],
            'status' => $row['status'],
            'attendees' => $attendees,
            'guests' => $guestAttendees,
            'totalAttendees' => $totalAttendeesCount,
            'autoEnded' => (bool)$row['auto_ended'],
            'manuallyEnded' => (bool)$row['manually_ended'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at']
        ];
    }

    http_response_code(200);
    echo json_encode($events);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 