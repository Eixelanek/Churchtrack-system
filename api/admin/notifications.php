<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

// Set timezone to Asia/Manila (Philippines)
date_default_timezone_set('Asia/Manila');

$database = new Database();
$db = $database->getConnection();

// Function to insert notification into database
function insertNotification($db, $type, $message, $event_id = null, $member_id = null, $reminder_type = null) {
    // Check for existing notification based on type and context
    $check_query = "SELECT id FROM notifications 
                    WHERE type = :type 
                    AND DATE(created_at) = CURDATE()";
    
    // Add specific conditions for different notification types
    if ($type === 'event_reminder' && $event_id) {
        $check_query .= " AND event_id = :event_id";
        if ($reminder_type) {
            $check_query .= " AND message LIKE :reminder_pattern";
        }
    } elseif ($type === 'birthday' && $member_id) {
        $check_query .= " AND member_id = :member_id";
    } elseif ($type === 'pending_request' && $member_id) {
        $check_query .= " AND member_id = :member_id";
    } elseif (in_array($type, ['attendance_needed', 'low_attendance']) && $event_id) {
        $check_query .= " AND event_id = :event_id";
    }
    
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(":type", $type);
    
    if ($type === 'event_reminder' && $event_id) {
        $check_stmt->bindParam(":event_id", $event_id);
        if ($reminder_type) {
            $reminder_pattern = "%{$reminder_type}%";
            $check_stmt->bindParam(":reminder_pattern", $reminder_pattern);
        }
    } elseif ($type === 'birthday' && $member_id) {
        $check_stmt->bindParam(":member_id", $member_id);
    } elseif ($type === 'pending_request' && $member_id) {
        $check_stmt->bindParam(":member_id", $member_id);
    } elseif (in_array($type, ['attendance_needed', 'low_attendance']) && $event_id) {
        $check_stmt->bindParam(":event_id", $event_id);
    }
    
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() == 0) {
        $insert_query = "INSERT INTO notifications (type, message, event_id, member_id) 
                         VALUES (:type, :message, :event_id, :member_id)";
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->bindParam(":type", $type);
        $insert_stmt->bindParam(":message", $message);
        $insert_stmt->bindParam(":event_id", $event_id);
        $insert_stmt->bindParam(":member_id", $member_id);
        $insert_stmt->execute();
    }
}

$notifications = [];

// Pending member requests
$query = "SELECT id, full_name AS name, created_at FROM members WHERE status = 'pending' ORDER BY created_at DESC";
$stmt = $db->prepare($query);
$stmt->execute();
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    insertNotification($db, 'pending_request', "{$row['name']} has requested to join the church.", null, $row['id']);
}

// Birthdays today
$query = "SELECT id, full_name AS name, birthday FROM members 
          WHERE MONTH(birthday) = MONTH(NOW()) 
          AND DAY(birthday) = DAY(NOW()) 
          AND status = 'active'";

$stmt = $db->prepare($query);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    insertNotification($db, 'birthday', "{$row['name']} is celebrating a birthday today!", null, $row['id']);
}

// Upcoming events today (1 hour before start)
$query = "SELECT id, title, start_time, location, date FROM events 
          WHERE status IN ('active', 'upcoming') 
          AND date >= CURDATE() 
          AND date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(date, ' ', start_time)) BETWEEN 60 AND 61 
          ORDER BY date ASC, start_time ASC";

$stmt = $db->prepare($query);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    insertNotification($db, 'event_reminder', "Event '{$row['title']}' starts in 1 hour at {$row['location']}", $row['id'], null, '1 hour');
}

// Upcoming events today (30 minutes before start)
$query = "SELECT id, title, start_time, location, date FROM events 
          WHERE status IN ('active', 'upcoming') 
          AND date >= CURDATE() 
          AND date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(date, ' ', start_time)) BETWEEN 30 AND 31 
          ORDER BY date ASC, start_time ASC";

$stmt = $db->prepare($query);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    insertNotification($db, 'event_reminder', "Event '{$row['title']}' starts in 30 minutes at {$row['location']}", $row['id'], null, '30 minutes');
}

// Events that need attendance marking (active events without attendance in the last 30 minutes)
$query = "SELECT e.id, e.title, e.start_time, e.location 
          FROM events e 
          LEFT JOIN (
              SELECT event_id, MAX(created_at) as last_attendance 
              FROM attendance 
              GROUP BY event_id
          ) a ON e.id = a.event_id 
          WHERE e.status = 'active' 
          AND e.date = CURDATE() 
          AND (a.last_attendance IS NULL OR TIMESTAMPDIFF(MINUTE, a.last_attendance, NOW()) > 30)
          AND TIME_TO_SEC(TIMEDIFF(CURTIME(), e.start_time)) BETWEEN -60 AND 180";
$stmt = $db->prepare($query);
$stmt->execute();
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    insertNotification($db, 'attendance_needed', "Attendance marking needed for '{$row['title']}' at {$row['location']}", $row['id']);
}

// Low attendance alerts (events with less than 5 attendees in the last hour)
$query = "SELECT e.id, e.title, e.location, COUNT(a.id) as attendee_count 
          FROM events e 
          LEFT JOIN attendance a ON e.id = a.event_id 
          WHERE e.status = 'active' 
          AND e.date = CURDATE() 
          AND a.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
          GROUP BY e.id 
          HAVING attendee_count < 5";
$stmt = $db->prepare($query);
$stmt->execute();
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    insertNotification($db, 'low_attendance', "Low attendance alert: '{$row['title']}' has only {$row['attendee_count']} attendees", $row['id']);
}

// Get user_id and user_type from query parameters for per-user read status
$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
$userType = isset($_GET['user_type']) ? $_GET['user_type'] : 'admin'; // default to admin

// Get all notifications from database with per-user read status
$query = "SELECT 
            n.id, 
            n.type, 
            n.message, 
            n.event_id, 
            n.member_id, 
            n.created_at,
            CASE 
              WHEN nr.id IS NOT NULL THEN 1 
              ELSE 0 
            END as is_read
          FROM notifications n
          LEFT JOIN notification_reads nr 
            ON n.id = nr.notification_id 
            AND nr.user_id = :user_id 
            AND nr.user_type = :user_type
          ORDER BY n.created_at DESC 
          LIMIT 50";

$stmt = $db->prepare($query);
$stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
$stmt->bindParam(':user_type', $userType, PDO::PARAM_STR);
$stmt->execute();

// Clean up old notifications (keep only the 50 most recent)
$cleanup_query = "DELETE FROM notifications 
                  WHERE id NOT IN (
                      SELECT id FROM (
                          SELECT id FROM notifications 
                          ORDER BY created_at DESC 
                          LIMIT 50
                      ) as recent_notifications
                  )";

$cleanup_stmt = $db->prepare($cleanup_query);
$cleanup_stmt->execute();

// Re-fetch after cleanup
$stmt = $db->prepare($query);
$stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
$stmt->bindParam(':user_type', $userType, PDO::PARAM_STR);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $notifications[] = [
        'id' => $row['id'],
        'type' => $row['type'],
        'message' => $row['message'],
        'event_id' => $row['event_id'],
        'member_id' => $row['member_id'],
        'timestamp' => $row['created_at'],
        'is_read' => (bool)$row['is_read']
    ];
}

echo json_encode($notifications);
?> 