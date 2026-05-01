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

try {
    $database = new Database();
    $db = $database->getConnection();
    ensureEmailVerificationInfrastructure($db);

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        throw new InvalidArgumentException('Invalid JSON');
    }

    $username = isset($payload['username']) ? trim((string)$payload['username']) : '';
    $password = isset($payload['password']) ? (string)$payload['password'] : '';

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
        exit();
    }

    $stmt = $db->prepare(
        'SELECT id, first_name, surname, email, password, email_verified_at
         FROM members WHERE username = :username LIMIT 1'
    );
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    $member = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$member || !password_verify($password, (string)$member['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
        exit();
    }

    $email = trim((string)($member['email'] ?? ''));
    if ($email === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No email on file for this account.']);
        exit();
    }

    if (!empty($member['email_verified_at'])) {
        echo json_encode(['success' => true, 'message' => 'Email is already verified.']);
        exit();
    }

    $token = generateEmailVerificationToken();
    $expiresAt = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');

    $upd = $db->prepare(
        'UPDATE members
         SET email_verification_token = :token,
             email_verification_expires_at = :exp,
             updated_at = NOW()
         WHERE id = :id'
    );
    $upd->bindParam(':token', $token);
    $upd->bindParam(':exp', $expiresAt);
    $upd->bindParam(':id', $member['id'], PDO::PARAM_INT);
    $upd->execute();

    $displayName = trim((string)($member['first_name'] ?? '') . ' ' . (string)($member['surname'] ?? ''));
    if ($displayName === '') {
        $displayName = $email;
    }

    $send = sendEmailVerificationLink($db, $email, $displayName, $token);
    if (!$send['success']) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => $send['message'] ?? 'Unable to send email.']);
        exit();
    }

    echo json_encode(['success' => true, 'message' => 'Verification email sent. Please check your inbox.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
