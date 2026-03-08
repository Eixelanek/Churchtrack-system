<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/database.php';

// Set timezone to Asia/Manila (Philippines)
date_default_timezone_set('Asia/Manila');

$database = new Database();
$db = $database->getConnection();

// Check if member_notifications table exists, create if not
try {
    $checkTable = "SHOW TABLES LIKE 'member_notifications'";
    $stmt = $db->query($checkTable);
    
    if ($stmt->rowCount() == 0) {
        // Create the table
        $createTable = "CREATE TABLE IF NOT EXISTS `member_notifications` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `member_id` int(11) NOT NULL,
          `type` varchar(50) NOT NULL,
          `message` text NOT NULL,
          `event_id` int(11) DEFAULT NULL,
          `related_member_id` int(11) DEFAULT NULL,
          `is_read` tinyint(1) DEFAULT 0,
          `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `member_id` (`member_id`),
          KEY `event_id` (`event_id`),
          KEY `related_member_id` (`related_member_id`),
          KEY `type` (`type`),
          KEY `is_read` (`is_read`),
          KEY `created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        
        $db->exec($createTable);
    }
} catch (Exception $e) {
    error_log("Error checking/creating member_notifications table: " . $e->getMessage());
}

// Get member_id from query parameter
$memberId = isset($_GET['member_id']) ? intval($_GET['member_id']) : null;

if (!$memberId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Member ID is required']);
    exit();
}

// Function to insert notification into database
function insertMemberNotification($db, $member_id, $type, $message, $event_id = null, $related_member_id = null) {
    // Check for existing notification based on type and context
    $check_query = "SELECT id FROM member_notifications 
                    WHERE member_id = :member_id
                    AND type = :type 
                    AND DATE(created_at) = CURDATE()";
    
    // Add specific conditions for different notification types
    if ($type === 'event_reminder' && $event_id) {
        $check_query .= " AND event_id = :event_id";
    } elseif ($type === 'family_checkin' && $related_member_id) {
        $check_query .= " AND related_member_id = :related_member_id";
    }
    
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(":member_id", $member_id);
    $check_stmt->bindParam(":type", $type);
    
    if ($type === 'event_reminder' && $event_id) {
        $check_stmt->bindParam(":event_id", $event_id);
    } elseif ($type === 'family_checkin' && $related_member_id) {
        $check_stmt->bindParam(":related_member_id", $related_member_id);
    }
    
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() == 0) {
        $insert_query = "INSERT INTO member_notifications (member_id, type, message, event_id, related_member_id) 
                         VALUES (:member_id, :type, :message, :event_id, :related_member_id)";
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->bindParam(":member_id", $member_id);
        $insert_stmt->bindParam(":type", $type);
        $insert_stmt->bindParam(":message", $message);
        $insert_stmt->bindParam(":event_id", $event_id);
        $insert_stmt->bindParam(":related_member_id", $related_member_id);
        $insert_stmt->execute();
    }
}

$notifications = [];

// 1. Birthday notifications
// 1a. Member's own birthday
$query = "SELECT id, full_name AS name, birthday FROM members 
          WHERE id = :member_id
          AND status = 'active'";

$stmt = $db->prepare($query);
$stmt->bindParam(':member_id', $memberId);
$stmt->execute();

if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if (!empty($row['birthday'])) {
        $birthday = new DateTime($row['birthday']);
        $today = new DateTime();
        
        // Check if today is their birthday (same month and day)
        if ($birthday->format('m-d') === $today->format('m-d')) {
            insertMemberNotification($db, $memberId, 'birthday', "Happy Birthday! 🎉 May God bless you abundantly today and always.", null, null);
        }
    }
}

// 1b. Other members' birthdays (notify this member about others celebrating today)
$query = "SELECT id, first_name, surname, birthday FROM members 
          WHERE id != :member_id
          AND status = 'active'
          AND MONTH(birthday) = MONTH(NOW()) 
          AND DAY(birthday) = DAY(NOW())";

$stmt = $db->prepare($query);
$stmt->bindParam(':member_id', $memberId);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $celebrantName = $row['first_name'] . ' ' . $row['surname'];
    insertMemberNotification($db, $memberId, 'birthday_other', "🎂 {$celebrantName} is celebrating a birthday today! Send them your greetings.", null, $row['id']);
}

// 2. Event reminders (1 hour and 30 minutes before start)
$query = "SELECT id, title, start_time, location, date FROM events 
          WHERE status IN ('active', 'upcoming') 
          AND date >= CURDATE() 
          AND date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          AND (
              TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(date, ' ', start_time)) BETWEEN 60 AND 61
              OR TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(date, ' ', start_time)) BETWEEN 30 AND 31
          )
          ORDER BY date ASC, start_time ASC";

$stmt = $db->prepare($query);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $minutesUntil = round((strtotime($row['date'] . ' ' . $row['start_time']) - time()) / 60);
    $timeLabel = $minutesUntil >= 60 ? '1 hour' : '30 minutes';
    insertMemberNotification($db, $memberId, 'event_reminder', "Event '{$row['title']}' starts in {$timeLabel} at {$row['location']}", $row['id'], null);
}

// 3. Profile completion reminder (check if REQUIRED fields are missing - only those with asterisk in registration)
// Required fields: surname, firstName, username, password, birthday, contactNumber, gender, street, barangay, city, province, zipCode
$query = "SELECT id, first_name, surname, contact_number, gender, birthday, 
                 street, barangay, city, province, zip_code 
          FROM members 
          WHERE id = :member_id";

$stmt = $db->prepare($query);
$stmt->bindParam(':member_id', $memberId);
$stmt->execute();

if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $missingFields = [];
    
    // Only check REQUIRED fields (those with asterisk in registration form)
    if (empty($row['first_name'])) $missingFields[] = 'first name';
    if (empty($row['surname'])) $missingFields[] = 'surname';
    if (empty($row['contact_number'])) $missingFields[] = 'contact number';
    if (empty($row['gender'])) $missingFields[] = 'gender';
    if (empty($row['birthday'])) $missingFields[] = 'birthday';
    if (empty($row['street'])) $missingFields[] = 'street';
    if (empty($row['barangay'])) $missingFields[] = 'barangay';
    if (empty($row['city'])) $missingFields[] = 'city';
    if (empty($row['province'])) $missingFields[] = 'province';
    if (empty($row['zip_code'])) $missingFields[] = 'zip code';
    
    if (count($missingFields) > 0) {
        $fieldList = implode(', ', $missingFields);
        insertMemberNotification($db, $memberId, 'profile_incomplete', "Please complete your profile. Missing required fields: {$fieldList}. Go to Profile Settings to update.", null, null);
    }
}

// Ensure attendance_streak column exists
try {
    $streakColumnCheck = $db->query("SHOW COLUMNS FROM members LIKE 'attendance_streak'");
    if ($streakColumnCheck->rowCount() === 0) {
        $db->exec("ALTER TABLE members ADD COLUMN attendance_streak INT DEFAULT 0");
    }
} catch (Exception $e) {
    error_log("Error ensuring attendance_streak column: " . $e->getMessage());
}

// 4. Attendance streak notification (check for notable milestones)
$query = "SELECT attendance_streak FROM members WHERE id = :member_id";
$stmt = $db->prepare($query);
$stmt->bindParam(':member_id', $memberId);
$stmt->execute();

if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $streak = (int)$row['attendance_streak'];
    
    // Notify on milestone streaks (5, 10, 15, 20, 25, 30, etc.)
    if ($streak > 0 && $streak % 5 === 0) {
        insertMemberNotification($db, $memberId, 'streak_milestone', "🔥 Amazing! You've maintained a {$streak}-week attendance streak! Keep it up!", null, null);
    }
}

// 5. Family check-in notifications (when family member checks them in)
// This will be triggered from the check-in API, not here
// We'll just fetch existing family_checkin notifications

// Get all notifications for this member from database
$query = "SELECT id, type, message, event_id, related_member_id, created_at, is_read 
          FROM member_notifications 
          WHERE member_id = :member_id
          ORDER BY created_at DESC 
          LIMIT 50";

$stmt = $db->prepare($query);
$stmt->bindParam(':member_id', $memberId);
$stmt->execute();

// Clean up old notifications (keep only the 50 most recent per member)
$cleanup_query = "DELETE FROM member_notifications 
                  WHERE member_id = :member_id
                  AND id NOT IN (
                      SELECT id FROM (
                          SELECT id FROM member_notifications 
                          WHERE member_id = :member_id
                          ORDER BY created_at DESC 
                          LIMIT 50
                      ) as recent_notifications
                  )";

$cleanup_stmt = $db->prepare($cleanup_query);
$cleanup_stmt->bindParam(':member_id', $memberId);
$cleanup_stmt->execute();

// Re-fetch after cleanup
$stmt = $db->prepare($query);
$stmt->bindParam(':member_id', $memberId);
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $notifications[] = [
        'id' => $row['id'],
        'type' => $row['type'],
        'message' => $row['message'],
        'event_id' => $row['event_id'],
        'related_member_id' => $row['related_member_id'],
        'timestamp' => $row['created_at'],
        'is_read' => (bool)$row['is_read']
    ];
}

echo json_encode($notifications);
?>
