<?php
// Temporary debug endpoint — remove after fixing
header("Content-Type: application/json; charset=UTF-8");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

include_once '../config/database.php';

$memberId = isset($_GET['id']) ? intval($_GET['id']) : 0;
if (!$memberId) {
    echo json_encode(['error' => 'id param required']);
    exit();
}

$database = new Database();
$db = $database->getConnection();

$result = ['member_id' => $memberId, 'tests' => []];

// Test 1: direct attendance query — no UNION
try {
    $s = $db->prepare("SELECT id, event_id, member_id, status, check_in_time FROM attendance WHERE member_id = :mid LIMIT 10");
    $s->bindValue(':mid', $memberId, PDO::PARAM_INT);
    $s->execute();
    $rows = $s->fetchAll(PDO::FETCH_ASSOC);
    $result['tests']['attendance_direct'] = ['count' => count($rows), 'rows' => $rows];
} catch (Exception $e) {
    $result['tests']['attendance_direct'] = ['error' => $e->getMessage()];
}

// Test 2: direct qr_attendance query — no UNION
try {
    $s = $db->prepare("SELECT id, session_id, member_id, checkin_datetime FROM qr_attendance WHERE member_id = :mid LIMIT 10");
    $s->bindValue(':mid', $memberId, PDO::PARAM_INT);
    $s->execute();
    $rows = $s->fetchAll(PDO::FETCH_ASSOC);
    $result['tests']['qr_attendance_direct'] = ['count' => count($rows), 'rows' => $rows];
} catch (Exception $e) {
    $result['tests']['qr_attendance_direct'] = ['error' => $e->getMessage()];
}

// Test 3: UNION query with unique params
try {
    $s = $db->prepare("
        SELECT 
            a.id,
            COALESCE(e.title, 'Service') AS service_name,
            DATE_ADD(a.check_in_time, INTERVAL 8 HOUR) AS checkin_datetime,
            a.status
        FROM attendance a
        LEFT JOIN events e ON e.id = a.event_id
        WHERE a.member_id = :mid1
        UNION ALL
        SELECT
            qa.id,
            COALESCE(qs.service_name, 'QR Attendance') AS service_name,
            DATE_ADD(qa.checkin_datetime, INTERVAL 8 HOUR) AS checkin_datetime,
            'present' AS status
        FROM qr_attendance qa
        LEFT JOIN qr_sessions qs ON qs.id = qa.session_id
        WHERE qa.member_id = :mid2
        ORDER BY checkin_datetime DESC
    ");
    $s->bindValue(':mid1', $memberId, PDO::PARAM_INT);
    $s->bindValue(':mid2', $memberId, PDO::PARAM_INT);
    $s->execute();
    $rows = $s->fetchAll(PDO::FETCH_ASSOC);
    $result['tests']['union_query'] = ['count' => count($rows), 'rows' => $rows];
} catch (Exception $e) {
    $result['tests']['union_query'] = ['error' => $e->getMessage()];
}

// Test 4: check what version of get_membership_details is running (look for DATE_ADD vs old query)
$result['tests']['php_version'] = PHP_VERSION;
$result['tests']['server_time'] = date('Y-m-d H:i:s');

echo json_encode($result, JSON_PRETTY_PRINT);
?>
