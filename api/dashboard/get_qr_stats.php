<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

require_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
    $currentYear = $now->format('Y');
    $currentMonth = $now->format('m');

    // Total generated QR sessions
    $totalQuery = "SELECT COUNT(*) AS total FROM qr_sessions";
    $totalStmt = $db->query($totalQuery);
    $totalResult = $totalStmt->fetch(PDO::FETCH_ASSOC);
    $totalGenerated = (int) ($totalResult['total'] ?? 0);

    // QR sessions generated this month
    // Use DATE() function to extract date part for more reliable comparison
    $monthQuery = "SELECT COUNT(*) AS month_total
                   FROM qr_sessions
                   WHERE (
                        (created_at IS NOT NULL AND YEAR(created_at) = :year AND MONTH(created_at) = :month)
                        OR (created_at IS NULL AND YEAR(event_datetime) = :year AND MONTH(event_datetime) = :month)
                   )";
    $monthStmt = $db->prepare($monthQuery);
    $monthStmt->bindParam(':year', $currentYear, PDO::PARAM_INT);
    $monthStmt->bindParam(':month', $currentMonth, PDO::PARAM_INT);
    $monthStmt->execute();
    $monthResult = $monthStmt->fetch(PDO::FETCH_ASSOC);
    $monthGenerated = (int) ($monthResult['month_total'] ?? 0);

    // Active sessions
    $activeQuery = "SELECT COUNT(*) AS active_total FROM qr_sessions WHERE status = 'active'";
    $activeStmt = $db->query($activeQuery);
    $activeResult = $activeStmt->fetch(PDO::FETCH_ASSOC);
    $activeSessions = (int) ($activeResult['active_total'] ?? 0);

    echo json_encode([
        'success' => true,
        'data' => [
            'totalGenerated' => $totalGenerated,
            'monthGenerated' => $monthGenerated,
            'activeSessions' => $activeSessions
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
