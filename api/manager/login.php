<?php
// Add CORS headers for cross-origin requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $data = json_decode(file_get_contents("php://input"));

    if (!empty($data->username) && !empty($data->password)) {
        // Try to authenticate against an admin-like table with a role column if it exists
        $table = 'admin';
        // If admin table has a role column, prefer rows where role = 'manager'
        $hasRole = false;
        try {
            $colStmt = $db->query("SHOW COLUMNS FROM admin LIKE 'role'");
            if ($colStmt && $colStmt->rowCount() > 0) {
                $hasRole = true;
            }
        } catch (Exception $e) {
            // ignore and continue without role support
        }

        if ($hasRole) {
            $query = "SELECT id, username, password, role FROM $table WHERE username = :username AND role = 'manager' LIMIT 1";
        } else {
            $query = "SELECT id, username, password, 'manager' AS role FROM $table WHERE username = :username LIMIT 1";
        }
        $stmt = $db->prepare($query);
        $stmt->bindParam(":username", $data->username);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            // ...existing code...
            if (password_verify($data->password, $row['password'])) {
                $sessionId = null;

                try {
                    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
                    $device = 'Windows PC';
                    $browser = 'Unknown Browser';

                    if (preg_match('/iphone|ipad|ipod/i', $userAgent)) {
                        $device = 'iOS Device';
                    } elseif (preg_match('/android/i', $userAgent)) {
                        $device = 'Android Device';
                    } elseif (preg_match('/macintosh|mac os x/i', $userAgent)) {
                        $device = 'Mac';
                    }

                    if (preg_match('/chrome/i', $userAgent) && !preg_match('/edge/i', $userAgent)) {
                        $browser = 'Chrome';
                    } elseif (preg_match('/safari/i', $userAgent) && !preg_match('/chrome/i', $userAgent)) {
                        $browser = 'Safari';
                    } elseif (preg_match('/firefox/i', $userAgent)) {
                        $browser = 'Firefox';
                    } elseif (preg_match('/edge/i', $userAgent)) {
                        $browser = 'Edge';
                    }

                    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
                    $location = 'Philippines';

                    $updateHistory = $db->prepare("UPDATE login_history SET is_current = 0 WHERE admin_id = :admin_id");
                    $updateHistory->bindParam(':admin_id', $row['id'], PDO::PARAM_INT);
                    $updateHistory->execute();

                    $insertHistory = $db->prepare("INSERT INTO login_history (admin_id, ip_address, user_agent, device, browser, location, is_current)
                                                VALUES (:admin_id, :ip_address, :user_agent, :device, :browser, :location, 1)");
                    $insertHistory->bindParam(':admin_id', $row['id'], PDO::PARAM_INT);
                    $insertHistory->bindParam(':ip_address', $ipAddress);
                    $insertHistory->bindParam(':user_agent', $userAgent);
                    $insertHistory->bindParam(':device', $device);
                    $insertHistory->bindParam(':browser', $browser);
                    $insertHistory->bindParam(':location', $location);
                    $insertHistory->execute();

                    $deactivateSessions = $db->prepare("UPDATE admin_sessions SET is_active = 0 WHERE admin_id = :admin_id");
                    $deactivateSessions->bindParam(':admin_id', $row['id'], PDO::PARAM_INT);
                    $deactivateSessions->execute();

                    $sessionId = bin2hex(random_bytes(32));
                    $insertSession = $db->prepare("INSERT INTO admin_sessions (session_id, admin_id, device, ip_address, last_activity, user_agent, location, is_active, created_at)
                                                VALUES (:session_id, :admin_id, :device, :ip_address, NOW(), :user_agent, :location, 1, NOW())");
                    $insertSession->bindParam(':session_id', $sessionId);
                    $insertSession->bindParam(':admin_id', $row['id'], PDO::PARAM_INT);
                    $insertSession->bindParam(':device', $device);
                    $insertSession->bindParam(':ip_address', $ipAddress);
                    $insertSession->bindParam(':user_agent', $userAgent);
                    $insertSession->bindParam(':location', $location);
                    $insertSession->execute();
                } catch (Exception $e) {
                    error_log('Failed to track manager login: ' . $e->getMessage());
                    if (!$sessionId) {
                        $sessionId = bin2hex(random_bytes(32));
                    }
                }

                http_response_code(200);
                echo json_encode([
                    "message" => "Login successful.",
                    "id" => $row['id'],
                    "username" => $row['username'],
                    "role" => 'manager',
                    "session_id" => $sessionId,
                    "token" => $sessionId
                ]);
                exit();
            }
        }

        // ...existing code...

        http_response_code(401);
        echo json_encode(["message" => "Manager not found or invalid credentials."]);
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Unable to login. Data is incomplete."]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?>


