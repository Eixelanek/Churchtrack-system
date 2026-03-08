<?php
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

    // Try to pull data from qr_attendance table (primary source for member scans)
    try {
        $qrAttendanceQuery = "SELECT 
                                COUNT(*) AS total_visits,
                                MAX(checkin_datetime) AS last_attended
                              FROM qr_attendance
                              WHERE member_id = :member_id";

        $qrStmt = $db->prepare($qrAttendanceQuery);
        $qrStmt->bindParam(':member_id', $memberId);
        $qrStmt->execute();
        $qrResult = $qrStmt->fetch(PDO::FETCH_ASSOC);

        if ($qrResult) {
            $totalVisits = max($totalVisits, (int)($qrResult['total_visits'] ?? 0));
            if (!empty($qrResult['last_attended'])) {
                $lastAttended = $qrResult['last_attended'];
            }
        }
    } catch (Exception $qrEx) {
        // Table might not exist yet; ignore and fall back to other sources
    }

    // Count attendance for current month from qr_attendance
    try {
        $thisMonthQuery = "SELECT COUNT(*) AS month_visits
                            FROM qr_attendance
                            WHERE member_id = :member_id
                              AND YEAR(checkin_datetime) = YEAR(CURRENT_DATE)
                              AND MONTH(checkin_datetime) = MONTH(CURRENT_DATE)";

        $monthStmt = $db->prepare($thisMonthQuery);
        $monthStmt->bindParam(':member_id', $memberId);
        $monthStmt->execute();
        $monthResult = $monthStmt->fetch(PDO::FETCH_ASSOC);
        if ($monthResult) {
            $thisMonthCount = (int)($monthResult['month_visits'] ?? 0);
        }
    } catch (Exception $monthEx) {
        // Ignore if table not present
    }

    // Optional legacy attendance_records table (if exists)
    try {
        $legacyTotalQuery = "SELECT COUNT(*) as total_visits,
                                     MAX(attendance_date) as last_attended
                             FROM attendance_records
                              WHERE member_id = :member_id";

        $legacyStmt = $db->prepare($legacyTotalQuery);
        $legacyStmt->bindParam(':member_id', $memberId);
        $legacyStmt->execute();
        $legacyResult = $legacyStmt->fetch(PDO::FETCH_ASSOC);

        if ($legacyResult) {
            $legacyVisits = (int)($legacyResult['total_visits'] ?? 0);
            $totalVisits = max($totalVisits, $legacyVisits);

            if (!empty($legacyResult['last_attended'])) {
                $legacyLast = $legacyResult['last_attended'];
                if (empty($lastAttended) || strtotime($legacyLast) > strtotime($lastAttended)) {
                    $lastAttended = $legacyLast;
                }
            }
        }
    } catch (Exception $legacyEx) {
        // Ignore if legacy table is not present
    }

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
        $streakQuery = "SELECT DATE(checkin_datetime) as attendance_date
                         FROM qr_attendance
                         WHERE member_id = :member_id
                         GROUP BY DATE(checkin_datetime)
                         ORDER BY DATE(checkin_datetime) DESC";

        $streakStmt = $db->prepare($streakQuery);
        $streakStmt->bindParam(':member_id', $memberId);
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
        $recentQuery = "SELECT 
                            qa.id,
                            COALESCE(qs.service_name, 'QR Attendance') AS service_name,
                            qa.checkin_datetime
                        FROM qr_attendance qa
                        LEFT JOIN qr_sessions qs ON qs.id = qa.session_id
                        WHERE qa.member_id = :member_id
                        ORDER BY qa.checkin_datetime DESC
                        LIMIT 5";

        $recentStmt = $db->prepare($recentQuery);
        $recentStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
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

    try {
        $recordsQuery = "SELECT 
                                qa.id,
                                COALESCE(qs.service_name, 'QR Attendance') AS service_name,
                                qa.checkin_datetime,
                                qa.session_id,
                                qa.member_contact
                           FROM qr_attendance qa
                           LEFT JOIN qr_sessions qs ON qs.id = qa.session_id
                           WHERE qa.member_id = :member_id
                           ORDER BY qa.checkin_datetime DESC";

        $recordsStmt = $db->prepare($recordsQuery);
        $recordsStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $recordsStmt->execute();

        while ($row = $recordsStmt->fetch(PDO::FETCH_ASSOC)) {
            $attendanceRecords[] = [
                'id' => isset($row['id']) ? (int)$row['id'] : null,
                'service_name' => $row['service_name'] ?? 'QR Attendance',
                'checkin_datetime' => $row['checkin_datetime'] ?? null,
                'session_id' => isset($row['session_id']) ? (int)$row['session_id'] : null,
                'member_contact' => $row['member_contact'] ?? null,
                'status' => 'Present'
            ];

            if (!empty($row['checkin_datetime'])) {
                $attendanceSummaryTotals['total_present']++;
                $attendanceSummaryTotals['dates'][] = $row['checkin_datetime'];
            }
        }
    } catch (Exception $recordsEx) {
        $attendanceRecords = [];
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
        "attendance_totals" => $attendanceSummaryTotals
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
