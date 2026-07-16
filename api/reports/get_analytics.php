<?php
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Date range params — default: current month
    $startDate = isset($_GET['startDate']) ? $_GET['startDate'] : date('Y-m-01');
    $endDate   = isset($_GET['endDate'])   ? $_GET['endDate']   : date('Y-m-d');

    // ── 1. ATTENDANCE TREND ─────────────────────────────────────────────────
    // Group total check-ins by week within the date range
    $attendanceTrendQuery = "
        SELECT
            DATE_FORMAT(MIN(DATE(qs.event_datetime)), '%b %d') AS week_label,
            YEARWEEK(qs.event_datetime, 1) AS week_key,
            COUNT(qa.id) AS total,
            SUM(CASE WHEN qa.member_id IS NOT NULL THEN 1 ELSE 0 END) AS members,
            SUM(CASE WHEN qa.member_id IS NULL THEN 1 ELSE 0 END) AS guests
        FROM qr_sessions qs
        LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
        WHERE DATE(qs.event_datetime) BETWEEN :start1 AND :end1
        GROUP BY week_key
        ORDER BY week_key ASC
    ";
    $stmt = $db->prepare($attendanceTrendQuery);
    $stmt->bindParam(':start1', $startDate);
    $stmt->bindParam(':end1',   $endDate);
    $stmt->execute();
    $attendanceTrend = array_values(array_map(function ($r) {
        return [
            'week'    => $r['week_label'],
            'total'   => (int)$r['total'],
            'members' => (int)$r['members'],
            'guests'  => (int)$r['guests'],
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC)));

    // ── 2. MEMBER GROWTH (monthly, last 7 months) ───────────────────────────
    $growthData = [];
    for ($i = 6; $i >= 0; $i--) {
        $endOfMonth = date('Y-m-t', strtotime("-$i months"));
        $monthLabel = date('M Y', strtotime("-$i months"));
        $stmt = $db->prepare("SELECT COUNT(*) AS cnt FROM members WHERE created_at <= :eom AND status IN ('Active','Inactive')");
        $stmt->bindParam(':eom', $endOfMonth);
        $stmt->execute();
        $cnt = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);
        $growthData[] = ['month' => $monthLabel, 'count' => $cnt];
    }

    // ── 3. SERVICE BREAKDOWN (within date range) ────────────────────────────
    $serviceQuery = "
        SELECT
            COALESCE(NULLIF(qs.service_name,''), 'Unnamed Service') AS name,
            COUNT(qa.id) AS total
        FROM qr_sessions qs
        LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
        WHERE DATE(qs.event_datetime) BETWEEN :start2 AND :end2
        GROUP BY name
        ORDER BY total DESC
        LIMIT 8
    ";
    $stmt = $db->prepare($serviceQuery);
    $stmt->bindParam(':start2', $startDate);
    $stmt->bindParam(':end2',   $endDate);
    $stmt->execute();
    $rawServices = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $serviceTotal = array_sum(array_column($rawServices, 'total'));
    $serviceBreakdown = array_values(array_map(function ($r) use ($serviceTotal) {
        return [
            'name'       => $r['name'],
            'total'      => (int)$r['total'],
            'percentage' => $serviceTotal > 0 ? round(($r['total'] / $serviceTotal) * 100, 1) : 0,
        ];
    }, $rawServices));

    // ── 4. GENDER DEMOGRAPHICS ──────────────────────────────────────────────
    $genderQuery = "SELECT gender, COUNT(*) AS cnt FROM members WHERE status IN ('Active','Inactive') GROUP BY gender";
    $stmt = $db->query($genderQuery);
    $genderRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $genderTotal = array_sum(array_column($genderRows, 'cnt'));
    $genderBreakdown = array_values(array_map(function ($r) use ($genderTotal) {
        $label = ucfirst(strtolower($r['gender'] ?? 'Unknown'));
        if ($label === '') $label = 'Unknown';
        return [
            'name'       => $label,
            'value'      => (int)$r['cnt'],
            'percentage' => $genderTotal > 0 ? round(($r['cnt'] / $genderTotal) * 100, 1) : 0,
        ];
    }, $genderRows));

    // ── 5. ACTIVE vs INACTIVE ───────────────────────────────────────────────
    $statusQuery = "SELECT status, COUNT(*) AS cnt FROM members WHERE status IN ('Active','Inactive') GROUP BY status";
    $stmt = $db->query($statusQuery);
    $statusRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $statusTotal = array_sum(array_column($statusRows, 'cnt'));
    $statusBreakdown = array_values(array_map(function ($r) use ($statusTotal) {
        return [
            'name'       => ucfirst(strtolower($r['status'])),
            'value'      => (int)$r['cnt'],
            'percentage' => $statusTotal > 0 ? round(($r['cnt'] / $statusTotal) * 100, 1) : 0,
        ];
    }, $statusRows));

    // ── 6. GUEST-TO-MEMBER CONVERSION (within date range) ──────────────────
    $guestTotalQuery = "SELECT COUNT(*) AS cnt FROM guests WHERE created_at BETWEEN :gs AND :ge";
    $stmt = $db->prepare($guestTotalQuery);
    $stmt->bindParam(':gs', $startDate);
    $stmt->bindParam(':ge', $endDate . ' 23:59:59');
    $stmt->execute();
    $guestTotal = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);

    $convertedQuery = "SELECT COUNT(*) AS cnt FROM members WHERE converted_from_guest = 1 AND created_at BETWEEN :cs AND :ce";
    try {
        $stmt = $db->prepare($convertedQuery);
        $stmt->bindParam(':cs', $startDate);
        $stmt->bindParam(':ce', $endDate . ' 23:59:59');
        $stmt->execute();
        $convertedCount = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);
    } catch (Exception $e) {
        // column might not exist — fallback
        $convertedCount = 0;
    }

    // ── 7. TOP ACTIVE MEMBERS (within date range) ───────────────────────────
    $topMembersQuery = "
        SELECT
            m.id,
            CONCAT(m.first_name,' ',m.surname) AS name,
            COUNT(DISTINCT DATE(qa.checkin_datetime)) AS days
        FROM members m
        INNER JOIN qr_attendance qa ON qa.member_id = m.id
        INNER JOIN qr_sessions qs ON qa.session_id = qs.id
        WHERE m.status = 'Active'
          AND DATE(qs.event_datetime) BETWEEN :ts AND :te
        GROUP BY m.id, m.first_name, m.surname
        ORDER BY days DESC
        LIMIT 10
    ";
    $stmt = $db->prepare($topMembersQuery);
    $stmt->bindParam(':ts', $startDate);
    $stmt->bindParam(':te', $endDate);
    $stmt->execute();
    $topMembers = array_values(array_map(function ($r) {
        return ['name' => $r['name'], 'days' => (int)$r['days']];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC)));

    // ── 8. SUMMARY STATS ────────────────────────────────────────────────────
    $totalEvents = 0;
    $totalCheckins = 0;
    $avgPerEvent = 0;
    if (!empty($attendanceTrend)) {
        $evtStmt = $db->prepare("SELECT COUNT(DISTINCT qs.id) AS evts, COUNT(qa.id) AS chk FROM qr_sessions qs LEFT JOIN qr_attendance qa ON qa.session_id = qs.id WHERE DATE(qs.event_datetime) BETWEEN :s AND :e");
        $evtStmt->bindParam(':s', $startDate);
        $evtStmt->bindParam(':e', $endDate);
        $evtStmt->execute();
        $evtRow = $evtStmt->fetch(PDO::FETCH_ASSOC);
        $totalEvents   = (int)($evtRow['evts'] ?? 0);
        $totalCheckins = (int)($evtRow['chk']  ?? 0);
        $avgPerEvent   = $totalEvents > 0 ? round($totalCheckins / $totalEvents, 1) : 0;
    }

    $activeMembers = 0;
    $totalMembers  = 0;
    $stStmt = $db->query("SELECT SUM(status='Active') AS act, COUNT(*) AS tot FROM members WHERE status IN ('Active','Inactive')");
    $stRow  = $stStmt->fetch(PDO::FETCH_ASSOC);
    $activeMembers = (int)($stRow['act'] ?? 0);
    $totalMembers  = (int)($stRow['tot'] ?? 0);

    echo json_encode([
        'success'          => true,
        'dateRange'        => ['start' => $startDate, 'end' => $endDate],
        'summary'          => [
            'totalEvents'    => $totalEvents,
            'totalCheckins'  => $totalCheckins,
            'avgPerEvent'    => $avgPerEvent,
            'totalMembers'   => $totalMembers,
            'activeMembers'  => $activeMembers,
            'guestTotal'     => $guestTotal,
            'convertedCount' => $convertedCount,
        ],
        'attendanceTrend'  => $attendanceTrend,
        'memberGrowth'     => $growthData,
        'serviceBreakdown' => $serviceBreakdown,
        'genderBreakdown'  => $genderBreakdown,
        'statusBreakdown'  => $statusBreakdown,
        'topMembers'       => $topMembers,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
