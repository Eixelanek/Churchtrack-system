<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $admin_id = isset($_GET['admin_id']) ? $_GET['admin_id'] : null;
    
    if (!empty($admin_id)) {
        try {
            $query = "SELECT id, ip_address, device, browser, location, login_time, is_current 
                      FROM login_history 
                      WHERE admin_id = :admin_id 
                      ORDER BY login_time DESC 
                      LIMIT 10";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(":admin_id", $admin_id);
            $stmt->execute();
            
            $loginHistory = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                // Calculate time ago
                $loginTime = strtotime($row['login_time']);
                $now = time();
                $diff = $now - $loginTime;
                
                if ($diff < 60) {
                    $timeAgo = 'Just now';
                } elseif ($diff < 3600) {
                    $minutes = floor($diff / 60);
                    $timeAgo = $minutes . ' minute' . ($minutes > 1 ? 's' : '') . ' ago';
                } elseif ($diff < 86400) {
                    $hours = floor($diff / 3600);
                    $timeAgo = $hours . ' hour' . ($hours > 1 ? 's' : '') . ' ago';
                } elseif ($diff < 172800) {
                    $timeAgo = 'Yesterday, ' . date('g:i A', $loginTime);
                } elseif ($diff < 604800) {
                    $days = floor($diff / 86400);
                    $timeAgo = $days . ' day' . ($days > 1 ? 's' : '') . ' ago';
                } else {
                    $timeAgo = date('M d, Y, g:i A', $loginTime);
                }
                
                $loginHistory[] = [
                    'id' => (int)$row['id'],
                    'device' => $row['device'] ?: 'Unknown Device',
                    'browser' => $row['browser'] ?: 'Unknown Browser',
                    'location' => $row['location'] ?: 'Unknown',
                    'timeAgo' => $timeAgo,
                    'loginTime' => $row['login_time'],
                    'isCurrent' => (bool)$row['is_current']
                ];
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $loginHistory
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Admin ID is required.'
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
}
?>
