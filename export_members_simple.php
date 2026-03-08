<?php
// Export members data in simple INSERT format

$host = "churchtrack-db-churchtrack.a.aivencloud.com";
$port = "17629";
$db = "defaultdb";
$user = "avnadmin";
$pass = "AVNS_YXyhc87L5iDG6SRQ4cg";

$conn = new PDO("mysql:host=$host;port=$port;dbname=$db", $user, $pass);
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$output = "-- Members Data\n";
$output .= "INSERT INTO `members` (`id`, `first_name`, `middle_name`, `surname`, `suffix`, `birthday`, `age`, `gender`, `address`, `contact_number`, `email`, `username`, `password`, `profile_picture`, `status`, `is_manager`, `referred_by`, `referrer_name`, `guardian_name`, `relationship_to_guardian`, `inactive_reason`, `inactive_date`, `created_at`, `updated_at`) VALUES\n";

$members = $conn->query("SELECT * FROM members")->fetchAll(PDO::FETCH_ASSOC);

$values = [];
foreach ($members as $m) {
    $vals = [
        $m['id'],
        "'" . addslashes($m['first_name']) . "'",
        $m['middle_name'] ? "'" . addslashes($m['middle_name']) . "'" : 'NULL',
        "'" . addslashes($m['surname']) . "'",
        $m['suffix'] ? "'" . addslashes($m['suffix']) . "'" : 'NULL',
        "'" . $m['birthday'] . "'",
        $m['age'] ?? 'NULL',
        "'" . $m['gender'] . "'",
        "'" . addslashes($m['address']) . "'",
        "'" . $m['contact_number'] . "'",
        $m['email'] ? "'" . addslashes($m['email']) . "'" : 'NULL',
        "'" . $m['username'] . "'",
        "'" . $m['password'] . "'",
        $m['profile_picture'] ? "'" . addslashes($m['profile_picture']) . "'" : 'NULL',
        "'" . $m['status'] . "'",
        $m['is_manager'],
        $m['referred_by'] ?? 'NULL',
        $m['referrer_name'] ? "'" . addslashes($m['referrer_name']) . "'" : 'NULL',
        $m['guardian_name'] ? "'" . addslashes($m['guardian_name']) . "'" : 'NULL',
        $m['relationship_to_guardian'] ? "'" . addslashes($m['relationship_to_guardian']) . "'" : 'NULL',
        $m['inactive_reason'] ? "'" . addslashes($m['inactive_reason']) . "'" : 'NULL',
        $m['inactive_date'] ? "'" . $m['inactive_date'] . "'" : 'NULL',
        "'" . $m['created_at'] . "'",
        "'" . $m['updated_at'] . "'"
    ];
    $values[] = '(' . implode(', ', $vals) . ')';
}

$output .= implode(",\n", $values) . ";\n\n";

// Events
$output .= "-- Events Data\n";
$events = $conn->query("SELECT * FROM events")->fetchAll(PDO::FETCH_ASSOC);
if (!empty($events)) {
    $output .= "INSERT INTO `events` (`id`, `title`, `date`, `time`, `location`, `description`, `type`, `status`, `created_at`, `updated_at`) VALUES\n";
    $values = [];
    foreach ($events as $e) {
        $vals = [
            $e['id'],
            "'" . addslashes($e['title']) . "'",
            "'" . $e['date'] . "'",
            "'" . $e['time'] . "'",
            "'" . addslashes($e['location']) . "'",
            $e['description'] ? "'" . addslashes($e['description']) . "'" : 'NULL',
            "'" . $e['type'] . "'",
            "'" . $e['status'] . "'",
            "'" . $e['created_at'] . "'",
            "'" . $e['updated_at'] . "'"
        ];
        $values[] = '(' . implode(', ', $vals) . ')';
    }
    $output .= implode(",\n", $values) . ";\n\n";
}

// QR Sessions
$output .= "-- QR Sessions Data\n";
$sessions = $conn->query("SELECT * FROM qr_sessions")->fetchAll(PDO::FETCH_ASSOC);
if (!empty($sessions)) {
    $output .= "INSERT INTO `qr_sessions` (`id`, `session_code`, `service_name`, `event_type`, `session_type`, `event_datetime`, `location`, `description`, `status`, `created_by`, `created_at`, `ended_at`) VALUES\n";
    $values = [];
    foreach ($sessions as $s) {
        $vals = [
            $s['id'],
            "'" . $s['session_code'] . "'",
            $s['service_name'] ? "'" . addslashes($s['service_name']) . "'" : 'NULL',
            $s['event_type'] ? "'" . addslashes($s['event_type']) . "'" : 'NULL',
            "'" . $s['session_type'] . "'",
            "'" . $s['event_datetime'] . "'",
            $s['location'] ? "'" . addslashes($s['location']) . "'" : 'NULL',
            $s['description'] ? "'" . addslashes($s['description']) . "'" : 'NULL',
            "'" . $s['status'] . "'",
            $s['created_by'] ?? 'NULL',
            "'" . $s['created_at'] . "'",
            $s['ended_at'] ? "'" . $s['ended_at'] . "'" : 'NULL'
        ];
        $values[] = '(' . implode(', ', $vals) . ')';
    }
    $output .= implode(",\n", $values) . ";\n\n";
}

file_put_contents('infinityfree_members_data.sql', $output);
echo "✓ Exported members data to: infinityfree_members_data.sql\n";
echo "Members exported: " . count($members) . "\n";
echo "Events exported: " . count($events) . "\n";
echo "QR Sessions exported: " . count($sessions) . "\n";
?>
