<?php
// Add CORS headers for cross-origin requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=UTF-8");

include_once '../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);
    ensureMemberCreatedViaColumn($db);

    $data = json_decode(file_get_contents("php://input"));

    if(!empty($data->username) && !empty($data->password)) {
        $query = "SELECT id, full_name AS name, username, email, birthday, status, password, must_change_password, password_temp_expires_at, email_verified_at, member_created_via FROM members WHERE username = :username LIMIT 1";
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
            $emailVerifiedAt = $row['email_verified_at'];
            $createdVia = isset($row['member_created_via']) ? (string)$row['member_created_via'] : 'registration';
            $hashed_password = $row['password'];

            $emailTrimmed = $email !== null ? trim((string)$email) : '';
            $hasEmail = $emailTrimmed !== '';
            $emailVerified = $emailVerifiedAt !== null && trim((string)$emailVerifiedAt) !== '';
            // Unverified email + email on file: cannot log in (public, guest_conversion, and admin if email was set at creation).
            // Admin with no email yet may log in to complete email in-app.
            $needsEmailVerify = $hasEmail && !$emailVerified;

            if(password_verify($data->password, $hashed_password)) {
                if ($needsEmailVerify) {
                    http_response_code(403);
                    echo json_encode(array(
                        "message" => "Please verify your email before logging in. Check your inbox for the verification link.",
                        "code" => "EMAIL_NOT_VERIFIED"
                    ));
                    exit();
                }

                if ($status !== 'active') {
                    http_response_code(403);
                    echo json_encode(array(
                        "message" => "Your account is not yet approved by admin.",
                        "code" => "ACCOUNT_NOT_APPROVED",
                        "status" => $status
                    ));
                    exit();
                }

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

                $requiresEmailVerification = ($createdVia === 'admin' && !$hasEmail);

                // Check if member is 18+ and doesn't have a unique email (shared parent email)
                $requiresEmailSetup = false;
                $isAdultEmailSetup = false;
                if ($birthday) {
                    $birthDate = new DateTime($birthday);
                    $today = new DateTime();
                    $age = $today->diff($birthDate)->y;
                    
                    // If 18+ and email is empty or shared (created via admin), require email setup
                    if ($age >= 18 && !$hasEmail) {
                        $requiresEmailSetup = true;
                        $isAdultEmailSetup = true;
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
                    "temp_password_expires_at" => $row['password_temp_expires_at'],
                    "requires_email_verification" => $requiresEmailVerification,
                    "requires_email_setup" => $requiresEmailSetup,
                    "is_adult_email_setup" => $isAdultEmailSetup,
                    "member_created_via" => $createdVia
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
