<?php
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

include_once '../config/database.php';
require_once __DIR__ . '/email_verification_utils.php';
require_once __DIR__ . '/send_qr_email.php';

$data = json_decode(file_get_contents('php://input'));
if (!$data || empty($data->member_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'member_id is required']);
    exit();
}

$memberId = (int) $data->member_id;
if ($memberId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid member_id']);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);

    // Require an active admin session before allowing profile/status edits.
    $adminId = isset($data->admin_id) ? (int)$data->admin_id : 0;
    $sessionId = isset($data->session_id) ? trim((string)$data->session_id) : '';
    if ($adminId <= 0 || $sessionId === '') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Admin session is required.']);
        exit();
    }

    $adminSessionStmt = $db->prepare(
        "SELECT is_active FROM admin_sessions WHERE session_id = :session_id AND admin_id = :admin_id LIMIT 1"
    );
    $adminSessionStmt->bindValue(':session_id', $sessionId);
    $adminSessionStmt->bindValue(':admin_id', $adminId, PDO::PARAM_INT);
    $adminSessionStmt->execute();
    $sessionRow = $adminSessionStmt->fetch(PDO::FETCH_ASSOC);
    if (!$sessionRow || (int)$sessionRow['is_active'] !== 1) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Admin session is not active. Please log in again.']);
        exit();
    }

    $fetch = $db->prepare('SELECT * FROM members WHERE id = :mid LIMIT 1');
    $fetch->bindValue(':mid', $memberId, PDO::PARAM_INT);
    $fetch->execute();
    $row = $fetch->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Member not found']);
        exit();
    }

    $sets = [];
    $params = [':mid' => $memberId];
    $verificationMail = null;
    $wasActivated = false; // track pending → active transition

    $strOrNull = static function ($v) {
        if ($v === null || $v === '') {
            return null;
        }
        return is_string($v) ? trim($v) : $v;
    };

    if (property_exists($data, 'username')) {
        $u = trim((string) $data->username);
        if ($u === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Username cannot be empty']);
            exit();
        }
        if ($u !== (string) $row['username']) {
            $chk = $db->prepare('SELECT id FROM members WHERE username = :u AND status != \'rejected\' AND id != :id LIMIT 1');
            $chk->bindValue(':u', $u);
            $chk->bindValue(':id', $memberId, PDO::PARAM_INT);
            $chk->execute();
            if ($chk->fetch(PDO::FETCH_ASSOC)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username is already taken']);
                exit();
            }
        }
        $sets[] = 'username = :username';
        $params[':username'] = $u;
    }

    $nameFields = ['first_name', 'middle_name', 'surname', 'suffix', 'contact_number', 'gender',
        'street', 'barangay', 'city', 'province', 'zip_code',
        'guardian_first_name', 'guardian_middle_name', 'guardian_surname', 'guardian_suffix',
        'relationship_to_guardian'];
    foreach ($nameFields as $col) {
        if (property_exists($data, $col)) {
            $sets[] = "{$col} = :{$col}";
            $params[":{$col}"] = $strOrNull($data->{$col});
        }
    }

    if (property_exists($data, 'birthday')) {
        $b = $data->birthday;
        if ($b === null || $b === '') {
            $sets[] = 'birthday = NULL';
        } else {
            $b = trim((string) $b);
            if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $b, $m)) {
                $b = $m[1];
            }
            $sets[] = 'birthday = :birthday';
            $params[':birthday'] = $b;
        }
    }

    if (property_exists($data, 'email')) {
        $newE = trim((string) $data->email);
        $oldE = trim((string) ($row['email'] ?? ''));
        if ($newE !== $oldE) {
            if ($newE === '') {
                $sets[] = 'email = NULL';
                $sets[] = 'email_verified_at = NULL';
                $sets[] = 'email_verification_token = NULL';
                $sets[] = 'email_verification_expires_at = NULL';
            } else {
                if (!filter_var($newE, FILTER_VALIDATE_EMAIL)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
                    exit();
                }
                $dup = $db->prepare('SELECT id FROM members WHERE email = :e AND id != :id AND status != \'rejected\' LIMIT 1');
                $dup->bindValue(':e', $newE);
                $dup->bindValue(':id', $memberId, PDO::PARAM_INT);
                $dup->execute();
                if ($dup->fetch(PDO::FETCH_ASSOC)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Email is already in use']);
                    exit();
                }
                $token = generateEmailVerificationToken();
                $exp = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');
                $sets[] = 'email = :email_new';
                $sets[] = 'email_verified_at = NULL';
                $sets[] = 'email_verification_token = :ev_tok';
                $sets[] = 'email_verification_expires_at = :ev_exp';
                $params[':email_new'] = $newE;
                $params[':ev_tok'] = $token;
                $params[':ev_exp'] = $exp;
                $fn = trim((string) (property_exists($data, 'first_name') ? $data->first_name : $row['first_name']))
                    . ' '
                    . trim((string) (property_exists($data, 'surname') ? $data->surname : $row['surname']));
                $fn = trim($fn);
                $verificationMail = [
                    'email' => $newE,
                    'token' => $token,
                    'name' => $fn !== '' ? $fn : $newE,
                ];
            }
        }
    }

    if (property_exists($data, 'status')) {
        $st = (string) $data->status;
        $valid = ['pending', 'active', 'rejected', 'inactive'];
        if (!in_array($st, $valid, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid status']);
            exit();
        }
        if ($st === 'rejected') {
            $reason = isset($data->rejection_reason) ? trim((string) $data->rejection_reason) : (isset($data->reason) ? trim((string) $data->reason) : '');
            if ($reason === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Rejection reason is required when status is rejected']);
                exit();
            }
            $sets[] = 'rejection_reason = :rej_reason';
            $params[':rej_reason'] = $reason;
        } else {
            $sets[] = 'rejection_reason = NULL';
        }
        $sets[] = 'status = :mem_status';
        $params[':mem_status'] = $st;
        // Detect activation: was pending/inactive, now becoming active
        if ($st === 'active' && in_array($row['status'], ['pending', 'inactive'], true)) {
            $wasActivated = true;
        }
        $colMgr = $db->query("SHOW COLUMNS FROM members LIKE 'manager_status'");
        if ($colMgr && $colMgr->rowCount() > 0) {
            // Don't touch manager_status when admin directly activates a member
            // manager_status tracks the recommendation flow separately
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No fields to update']);
        exit();
    }

    $sets[] = 'updated_at = NOW()';

    $sql = 'UPDATE members SET ' . implode(', ', $sets) . ' WHERE id = :mid';
    $stmt = $db->prepare($sql);
    foreach ($params as $key => $value) {
        if ($value === null) {
            $stmt->bindValue($key, null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue($key, $value);
        }
    }
    $stmt->execute();

    if ($verificationMail !== null) {
        $send = sendEmailVerificationLink($db, $verificationMail['email'], $verificationMail['name'], $verificationMail['token']);
        if (!$send['success']) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Member updated, but verification email could not be sent: ' . ($send['message'] ?? 'unknown'),
                'email_send_ok' => false,
            ]);
            exit();
        }
    }

    // Send QR code email when member is activated and has a verified email
    if ($wasActivated) {
        $freshStmt = $db->prepare("SELECT email, email_verified_at FROM members WHERE id = :id LIMIT 1");
        $freshStmt->bindValue(':id', $memberId, PDO::PARAM_INT);
        $freshStmt->execute();
        $fresh = $freshStmt->fetch(PDO::FETCH_ASSOC);

        if (
            $fresh &&
            !empty($fresh['email']) &&
            !empty($fresh['email_verified_at'])
        ) {
            $qrSend = sendMemberQrEmail($db, $memberId);
            if (!$qrSend['success']) {
                error_log("QR email failed for member {$memberId}: " . ($qrSend['message'] ?? 'unknown'));
            }
        }
    }

    echo json_encode(['success' => true, 'message' => 'Member updated successfully', 'email_send_ok' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
