<?php
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

    if(!empty($data->username) && !empty($data->password)) {
        $query = "SELECT id, full_name AS name, username, email, birthday, status, password, must_change_password, password_temp_expires_at FROM members WHERE username = :username LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->bindParam(":username", $data->username);
        $stmt->execute();

        if($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $id = $row['id'];
            $name = $row['name'];
            $username = $row['username'];
            $email = $row['email'];
            $birthday = $row['birthday'];
            $status = $row['status'];
            $hashed_password = $row['password'];

            if(password_verify($data->password, $hashed_password)) {
                if ((int)($row['must_change_password'] ?? 0) === 1) {
                    $expiresAt = $row['password_temp_expires_at'];
                    if ($expiresAt) {
                        $expiryDate = new DateTime($expiresAt);
                        $now = new DateTime();
                        if ($expiryDate < $now) {
                            http_response_code(403);
                            echo json_encode(array(
                                "message" => "Temporary password has expired. Please request a new reset to continue.",
                                "code" => "TEMP_PASSWORD_EXPIRED"
                            ));
                            exit();
                        }
                    }
                }

                http_response_code(200);
                echo json_encode(array(
                    "message" => "Login successful.",
                    "id" => $id,
                    "name" => $name,
                    "username" => $username,
                    "email" => $email,
                    "birthday" => $birthday,
                    "status" => $status,
                    "warning" => $status !== 'active' ? 'Account is currently marked as ' . $status . '.' : null,
                    "must_change_password" => (int)($row['must_change_password'] ?? 0) === 1,
                    "temp_password_expires_at" => $row['password_temp_expires_at']
                ));
            } else {
                http_response_code(401);
                echo json_encode(array("message" => "Invalid password."));
            }
        } else {
            http_response_code(401);
            echo json_encode(array("message" => "User not found."));
        }
    } else {
        http_response_code(400);
        echo json_encode(array("message" => "Unable to login. Data is incomplete."));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Server error: " . $e->getMessage()));
}
?> 