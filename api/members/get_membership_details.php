<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

// Get member ID from query parameter
$memberId = isset($_GET['id']) ? $_GET['id'] : null;

if (!$memberId) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Member ID is required"
    ]);
    exit();
}

try {
    // Get member basic info and join date
    $memberQuery = "SELECT 
                        id,
                        created_at as join_date,
                        status
                    FROM members
                    WHERE id = :member_id";
    
    $memberStmt = $db->prepare($memberQuery);
    $memberStmt->bindParam(':member_id', $memberId);
    $memberStmt->execute();
    $member = $memberStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$member) {
        http_response_code(404);
        echo json_encode([
            "error" => true,
            "message" => "Member not found"
        ]);
        exit();
    }
    
    $totalVisits = 0;
    $lastAttended = null;
    $thisMonthCount = 0;

    // ── Source 1: new attendance table (manager QR scans) ────────────────
    try {
        $attQuery = "SELECT 
                         COUNT(*) AS total_visits,
                         MAX(DATE_ADD(check_in_time, INTERVAL 8 HOUR)) AS last_attended
                     FROM attendance
                     WHERE member_id = :member_id";
        $attStmt = $db->prepare($attQuery);
        $attStmt->bindParam(':member_id', $memberId);
        $attStmt->execute();
        $attResult = $attStmt->fetch(PDO::FETCH_ASSOC);
        if ($attResult) {
            $totalVisits += (int)($attResult['total_visits'] ?? 0);
            if (!empty($attResult['last_attended'])) {
                $lastAttended = $attResult['last_attended'];
            }
        }
    } catch (Exception $attEx) { /* ignore */ }

    // Month visits from attendance table
    try {
        $attMonthQuery = "SELECT COUNT(*) AS month_visits
                          FROM attendance
                          WHERE member_id = :member_id
                            AND YEAR(DATE_ADD(check_in_time, INTERVAL 8 HOUR)) = YEAR(DATE_ADD(NOW(), INTERVAL 8 HOUR))
                            AND MONTH(DATE_ADD(check_in_time, INTERVAL 8 HOUR)) = MONTH(DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $attMonthStmt = $db->prepare($attMonthQuery);
        $attMonthStmt->bindParam(':member_id', $memberId);
        $attMonthStmt->execute();
        $attMonthResult = $attMonthStmt->fetch(PDO::FETCH_ASSOC);
        if ($attMonthResult) {
            $thisMonthCount += (int)($attMonthResult['month_visits'] ?? 0);
        }
    } catch (Exception $e) { /* ignore */ }

    // ── Source 2: legacy qr_attendance table ─────────────────────────────
    try {
        $qrAttendanceQuery = "SELECT 
                                COUNT(*) AS total_visits,
                                MAX(DATE_ADD(checkin_datetime, INTERVAL 8 HOUR)) AS last_attended
                              FROM qr_attendance
                              WHERE member_id = :member_id";
        $qrStmt = $db->prepare($qrAttendanceQuery);
        $qrStmt->bindParam(':member_id', $memberId);
        $qrStmt->execute();
        $qrResult = $qrStmt->fetch(PDO::FETCH_ASSOC);
        if ($qrResult) {
            $totalVisits += (int)($qrResult['total_visits'] ?? 0);
            if (!empty($qrResult['last_attended'])) {
                if (empty($lastAttended) || strtotime($qrResult['last_attended']) > strtotime($lastAttended)) {
                    $lastAttended = $qrResult['last_attended'];
                }
            }
        }
    } catch (Exception $qrEx) { /* ignore */ }

    // Month visits from qr_attendance
    try {
        $thisMonthQuery = "SELECT COUNT(*) AS month_visits
                            FROM qr_attendance
                            WHERE member_id = :member_id
                              AND YEAR(DATE_ADD(checkin_datetime, INTERVAL 8 HOUR)) = YEAR(DATE_ADD(NOW(), INTERVAL 8 HOUR))
                              AND MONTH(DATE_ADD(checkin_datetime, INTERVAL 8 HOUR)) = MONTH(DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $monthStmt = $db->prepare($thisMonthQuery);
        $monthStmt->bindParam(':member_id', $memberId);
        $monthStmt->execute();
        $monthResult = $monthStmt->fetch(PDO::FETCH_ASSOC);
        if ($monthResult) {
            $thisMonthCount += (int)($monthResult['month_visits'] ?? 0);
        }
    } catch (Exception $monthEx) { /* ignore */ }

    // Calculate attendance rate
    // Get total number of Sundays since join date
    $joinDate = new DateTime($member['join_date']);
    $today = new DateTime();
    $interval = $joinDate->diff($today);
    $daysSinceJoin = $interval->days;
    $weeksSinceJoin = floor($daysSinceJoin / 7);
    
    // Approximate total Sundays (assuming 1 Sunday per week)
    $totalSundays = $weeksSinceJoin > 0 ? $weeksSinceJoin : 1;
    
    // Calculate attendance rate percentage
    $attendanceRate = $totalSundays > 0 ? round(($totalVisits / $totalSundays) * 100, 1) : 0;
    
    // Cap at 100%
    if ($attendanceRate > 100) {
        $attendanceRate = 100;
    }
    
    // Calculate attendance streak (consecutive days with attendance)
    $currentStreak = 0;
    $lastDate = null;
    $recentScans = [];

    try {
        $streakQuery = "
            SELECT DATE(DATE_ADD(check_in_time, INTERVAL 8 HOUR)) AS attendance_date
            FROM attendance WHERE member_id = :member_id1
            UNION
            SELECT DATE(checkin_datetime) AS attendance_date
            FROM qr_attendance WHERE member_id = :member_id2
            ORDER BY attendance_date DESC";

        $streakStmt = $db->prepare($streakQuery);
        $streakStmt->bindParam(':member_id1', $memberId);
        $streakStmt->bindParam(':member_id2', $memberId);
        $streakStmt->execute();
        $dates = $streakStmt->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($dates)) {
            $today = new DateTime();
            foreach ($dates as $index => $dateValue) {
                $date = new DateTime($dateValue);

                if ($index === 0) {
                    // Only count streak starting if attendance was today or yesterday
                    $daysDiff = (int)$today->diff($date)->format('%a');
                    if ($daysDiff === 0 || $daysDiff === 1) {
                        $currentStreak = 1;
                        $lastDate = $date;
                    } else {
                        break; // Streak only counts consecutive days ending today/yesterday
                    }
                } else {
                    if ($lastDate) {
                        $diff = (int)$lastDate->diff($date)->format('%a');
                        if ($diff === 1) {
                            $currentStreak++;
                            $lastDate = $date;
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    } catch (Exception $streakEx) {
        $currentStreak = 0;
    }

    // Recent scans (latest check-ins)
    try {
        $recentQuery = "
            SELECT id, service_name, checkin_datetime
            FROM (
                SELECT a.id,
                       COALESCE(CONVERT(e.title USING utf8mb4), 'Service') AS service_name,
                       DATE_ADD(a.check_in_time, INTERVAL 8 HOUR) AS checkin_datetime
                FROM attendance a
                LEFT JOIN events e ON e.id = a.event_id
                WHERE a.member_id = :member_id1

                UNION ALL

                SELECT qa.id,
                       COALESCE(CONVERT(qs.service_name USING utf8mb4), 'QR Attendance') AS service_name,
                       qa.checkin_datetime
                FROM qr_attendance qa
                LEFT JOIN qr_sessions qs ON qs.id = qa.session_id
                WHERE qa.member_id = :member_id2
            ) combined
            ORDER BY checkin_datetime DESC
            LIMIT 5";

        $recentStmt = $db->prepare($recentQuery);
        $recentStmt->bindParam(':member_id1', $memberId, PDO::PARAM_INT);
        $recentStmt->bindParam(':member_id2', $memberId, PDO::PARAM_INT);
        $recentStmt->execute();

        while ($row = $recentStmt->fetch(PDO::FETCH_ASSOC)) {
            $recentScans[] = [
                'id' => isset($row['id']) ? (int)$row['id'] : null,
                'service_name' => $row['service_name'] ?? 'QR Attendance',
                'checkin_datetime' => $row['checkin_datetime'] ?? null
            ];
        }
    } catch (Exception $recentEx) {
        $recentScans = [];
    }

    $attendanceRecords = [];
    $attendanceSummaryTotals = [
        'total_present' => 0,
        'total_absent' => 0,
        'dates' => []
    ];
    $recordsError = null;

    try {
        // Combine records from both attendance sources
        // Use DATE_ADD for timezone offset instead of CONVERT_TZ (avoids missing tz tables)
        $recordsQuery = "
            SELECT 
                a.id,
                COALESCE(CONVERT(e.title USING utf8mb4), 'Service') AS service_name,
                DATE_ADD(a.check_in_time, INTERVAL 8 HOUR) AS checkin_datetime,
                NULL AS session_id,
                NULL AS member_contact,
                CONVERT(a.status USING utf8mb4) AS status
            FROM attendance a
            LEFT JOIN events e ON e.id = a.event_id
            WHERE a.member_id = :member_id1

            UNION ALL

            SELECT
                qa.id,
                COALESCE(CONVERT(qs.service_name USING utf8mb4), 'QR Attendance') AS service_name,
                qa.checkin_datetime,
                qa.session_id,
                CONVERT(qa.member_contact USING utf8mb4) AS member_contact,
                CONVERT('present' USING utf8mb4) AS status
            FROM qr_attendance qa
            LEFT JOIN qr_sessions qs ON qs.id = qa.session_id
            WHERE qa.member_id = :member_id2

            ORDER BY checkin_datetime DESC";

        $recordsStmt = $db->prepare($recordsQuery);
        $recordsStmt->bindParam(':member_id1', $memberId, PDO::PARAM_INT);
        $recordsStmt->bindParam(':member_id2', $memberId, PDO::PARAM_INT);
        $recordsStmt->execute();

        while ($row = $recordsStmt->fetch(PDO::FETCH_ASSOC)) {
            $attendanceRecords[] = [
                'id'               => isset($row['id']) ? (int)$row['id'] : null,
                'service_name'     => $row['service_name'] ?? 'QR Attendance',
                'checkin_datetime' => $row['checkin_datetime'] ?? null,
                'session_id'       => isset($row['session_id']) ? (int)$row['session_id'] : null,
                'member_contact'   => $row['member_contact'] ?? null,
                'status'           => ucfirst(strtolower($row['status'] ?? 'present'))
            ];

            if (!empty($row['checkin_datetime'])) {
                $attendanceSummaryTotals['total_present']++;
                $attendanceSummaryTotals['dates'][] = $row['checkin_datetime'];
            }
        }
    } catch (Exception $recordsEx) {
        $attendanceRecords = [];
        $recordsError = $recordsEx->getMessage();
        error_log('get_membership_details records error: ' . $recordsEx->getMessage());
    }

    // Prepare response
    $response = [
        "member_id" => $member['id'],
        "join_date" => $member['join_date'],
        "last_attended" => $lastAttended,
        "total_visits" => (int)$totalVisits,
        "month_visits" => (int)$thisMonthCount,
        "attendance_rate" => $attendanceRate,
        "status" => $member['status'],
        "weeks_since_join" => $weeksSinceJoin,
        "attendance_streak" => $currentStreak,
        "recent_scans" => $recentScans,
        "attendance_records" => $attendanceRecords,
        "attendance_totals" => $attendanceSummaryTotals,
        "_debug" => [
            "records_count" => count($attendanceRecords),
            "total_visits_raw" => $totalVisits,
            "records_error" => $recordsError,
        ]
    ];
    
    http_response_code(200);
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error fetching membership details: " . $e->getMessage()
    ]);
}
?>
