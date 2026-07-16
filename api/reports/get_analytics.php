<?php
date_default_timezone_set('Asia/Manila');

// Suppress HTML error output — must come before any output
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // ── Input validation ────────────────────────────────────────────────────
    $startDate = isset($_GET['startDate']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['startDate'])
        ? $_GET['startDate'] : date('Y-m-01');
    $endDate = isset($_GET['endDate']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['endDate'])
        ? $_GET['endDate'] : date('Y-m-d');

    // Safety: swap if end is before start
    if ($endDate < $startDate) {
        [$startDate, $endDate] = [$endDate, $startDate];
    }

    // ── 1. ATTENDANCE TREND (grouped by week) ───────────────────────────────
    $attendanceTrend = [];
    try {
        $stmt = $db->prepare("
            SELECT
                DATE_FORMAT(MIN(DATE(qs.event_datetime)), '%b %d') AS week_label,
                YEARWEEK(qs.event_datetime, 1)                     AS week_key,
                COUNT(qa.id)                                        AS total,
                SUM(CASE WHEN qa.member_id IS NOT NULL THEN 1 ELSE 0 END) AS members,
                SUM(CASE WHEN qa.member_id IS NULL     THEN 1 ELSE 0 END) AS guests
            FROM qr_sessions qs
            LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
            WHERE DATE(qs.event_datetime) BETWEEN :start AND :end
            GROUP BY YEARWEEK(qs.event_datetime, 1)
            ORDER BY week_key ASC
        ");
        $stmt->bindParam(':start', $startDate);
        $stmt->bindParam(':end',   $endDate);
        $stmt->execute();
        $attendanceTrend = array_values(array_map(function ($r) {
            return [
                'week'    => $r['week_label'],
                'total'   => (int)$r['total'],
                'members' => (int)$r['members'],
                'guests'  => (int)$r['guests'],
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
    } catch (Exception $e) { /* return empty */ }

    // ── 2. MEMBER GROWTH (last 7 months, cumulative) ────────────────────────
    $growthData = [];
    try {
        for ($i = 6; $i >= 0; $i--) {
            $endOfMonth = date('Y-m-t', strtotime("-{$i} months"));
            $monthLabel = date('M Y',   strtotime("-{$i} months"));
            $gStmt = $db->prepare("SELECT COUNT(*) AS cnt FROM members WHERE created_at <= :eom AND status IN ('Active','Inactive')");
            $gStmt->bindParam(':eom', $endOfMonth);
            $gStmt->execute();
            $growthData[] = [
                'month' => $monthLabel,
                'count' => (int)($gStmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0),
            ];
        }
    } catch (Exception $e) { $growthData = []; }

    // ── 3. SERVICE BREAKDOWN (within date range) ────────────────────────────
    $serviceBreakdown = [];
    try {
        $stmt = $db->prepare("
            SELECT
                COALESCE(NULLIF(TRIM(qs.service_name), ''), 'Unnamed Service') AS name,
                COUNT(qa.id) AS total
            FROM qr_sessions qs
            LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
            WHERE DATE(qs.event_datetime) BETWEEN :start AND :end
            GROUP BY qs.service_name
            ORDER BY total DESC
            LIMIT 8
        ");
        $stmt->bindParam(':start', $startDate);
        $stmt->bindParam(':end',   $endDate);
        $stmt->execute();
        $rows  = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $total = array_sum(array_column($rows, 'total'));
        $serviceBreakdown = array_values(array_map(function ($r) use ($total) {
            return [
                'name'       => $r['name'],
                'total'      => (int)$r['total'],
                'percentage' => $total > 0 ? round(($r['total'] / $total) * 100, 1) : 0,
            ];
        }, $rows));
    } catch (Exception $e) { /* return empty */ }

    // ── 4. GENDER DEMOGRAPHICS ──────────────────────────────────────────────
    $genderBreakdown = [];
    try {
        $stmt = $db->query("SELECT COALESCE(NULLIF(TRIM(gender),''), 'Unknown') AS gender, COUNT(*) AS cnt FROM members WHERE status IN ('Active','Inactive') GROUP BY gender");
        $rows  = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $total = array_sum(array_column($rows, 'cnt'));
        $genderBreakdown = array_values(array_map(function ($r) use ($total) {
            return [
                'name'       => ucfirst(strtolower($r['gender'])),
                'value'      => (int)$r['cnt'],
                'percentage' => $total > 0 ? round(($r['cnt'] / $total) * 100, 1) : 0,
            ];
        }, $rows));
    } catch (Exception $e) { /* return empty */ }

    // ── 5. ACTIVE vs INACTIVE ───────────────────────────────────────────────
    $statusBreakdown = [];
    try {
        $stmt  = $db->query("SELECT status, COUNT(*) AS cnt FROM members WHERE status IN ('Active','Inactive') GROUP BY status");
        $rows  = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $total = array_sum(array_column($rows, 'cnt'));
        $statusBreakdown = array_values(array_map(function ($r) use ($total) {
            return [
                'name'       => ucfirst(strtolower($r['status'])),
                'value'      => (int)$r['cnt'],
                'percentage' => $total > 0 ? round(($r['cnt'] / $total) * 100, 1) : 0,
            ];
        }, $rows));
    } catch (Exception $e) { /* return empty */ }

    // ── 6. GUEST COUNT (within date range) ──────────────────────────────────
    $guestTotal     = 0;
    $convertedCount = 0;
    try {
        $stmt = $db->prepare("SELECT COUNT(*) AS cnt FROM guests WHERE created_at BETWEEN :gs AND :ge");
        $stmt->bindParam(':gs', $startDate);
        $ge = $endDate . ' 23:59:59';
        $stmt->bindParam(':ge', $ge);
        $stmt->execute();
        $guestTotal = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);
    } catch (Exception $e) { $guestTotal = 0; }

    try {
        $stmt = $db->prepare("SELECT COUNT(*) AS cnt FROM members WHERE converted_from_guest = 1 AND created_at BETWEEN :cs AND :ce");
        $stmt->bindParam(':cs', $startDate);
        $ce = $endDate . ' 23:59:59';
        $stmt->bindParam(':ce', $ce);
        $stmt->execute();
        $convertedCount = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);
    } catch (Exception $e) { $convertedCount = 0; }

    // ── 7. TOP ACTIVE MEMBERS (within date range) ───────────────────────────
    $topMembers = [];
    try {
        $stmt = $db->prepare("
            SELECT
                m.id,
                CONCAT(m.first_name, ' ', m.surname) AS name,
                COUNT(DISTINCT DATE(qa.checkin_datetime)) AS days
            FROM members m
            INNER JOIN qr_attendance qa ON qa.member_id = m.id
            INNER JOIN qr_sessions qs   ON qa.session_id = qs.id
            WHERE m.status = 'Active'
              AND DATE(qs.event_datetime) BETWEEN :start AND :end
            GROUP BY m.id, m.first_name, m.surname
            ORDER BY days DESC
            LIMIT 10
        ");
        $stmt->bindParam(':start', $startDate);
        $stmt->bindParam(':end',   $endDate);
        $stmt->execute();
        $topMembers = array_values(array_map(function ($r) {
            return ['name' => $r['name'], 'days' => (int)$r['days']];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
    } catch (Exception $e) { /* return empty */ }

    // ── 8. SUMMARY STATS ────────────────────────────────────────────────────
    $totalEvents   = 0;
    $totalCheckins = 0;
    $avgPerEvent   = 0;
    try {
        $stmt = $db->prepare("
            SELECT
                COUNT(DISTINCT qs.id) AS evts,
                COUNT(qa.id)          AS chk
            FROM qr_sessions qs
            LEFT JOIN qr_attendance qa ON qa.session_id = qs.id
            WHERE DATE(qs.event_datetime) BETWEEN :start AND :end
        ");
        $stmt->bindParam(':start', $startDate);
        $stmt->bindParam(':end',   $endDate);
        $stmt->execute();
        $row           = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalEvents   = (int)($row['evts'] ?? 0);
        $totalCheckins = (int)($row['chk']  ?? 0);
        $avgPerEvent   = $totalEvents > 0 ? round($totalCheckins / $totalEvents, 1) : 0;
    } catch (Exception $e) { /* leave defaults */ }

    $activeMembers = 0;
    $totalMembers  = 0;
    try {
        $stmt = $db->query("
            SELECT
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS act,
                COUNT(*) AS tot
            FROM members
            WHERE status IN ('Active','Inactive')
        ");
        $row           = $stmt->fetch(PDO::FETCH_ASSOC);
        $activeMembers = (int)($row['act'] ?? 0);
        $totalMembers  = (int)($row['tot'] ?? 0);
    } catch (Exception $e) { /* leave defaults */ }

    // ── Response ─────────────────────────────────────────────────────────────
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
