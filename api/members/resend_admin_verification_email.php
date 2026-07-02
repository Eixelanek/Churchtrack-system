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
    ensureMemberCreatedViaColumn($db);

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        throw new InvalidArgumentException('Invalid JSON');
    }

    $memberId = isset($payload['member_id']) ? (int)$payload['member_id'] : 0;
    $username = isset($payload['username']) ? trim((string)$payload['username']) : '';
    $password = isset($payload['password']) ? (string)$payload['password'] : '';

    if ($memberId <= 0 || $username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'member_id, username, and password are required.']);
        exit();
    }

    $stmt = $db->prepare(
        'SELECT id, username, email, password, email_verified_at, member_created_via, first_name, surname
         FROM members WHERE id = :id AND username = :username LIMIT 1'
    );
    $stmt->bindParam(':id', $memberId, PDO::PARAM_INT);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    $member = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
        exit();
    }

    if (!password_verify($password, $member['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
        exit();
    }

    $createdVia = (string)($member['member_created_via'] ?? 'registration');
    if (!in_array($createdVia, ['admin', 'guest_conversion'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Resend is only available for admin-created or guest-converted accounts.']);
        exit();
    }

    $email = trim((string)($member['email'] ?? ''));
    if ($email === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No email on file to send verification to.']);
        exit();
    }

    if (!empty($member['email_verified_at'])) {
        echo json_encode(['success' => true, 'message' => 'Email is already verified.']);
        exit();
    }

    $token = generateEmailVerificationToken();
    $expiresAt = (new DateTime('+24 hours'))->format('Y-m-d H:i:s');

    $upd = $db->prepare(
        'UPDATE members SET email_verification_token = :token, email_verification_expires_at = :exp, updated_at = NOW() WHERE id = :id'
    );
    $upd->bindParam(':token', $token);
    $upd->bindParam(':exp', $expiresAt);
    $upd->bindParam(':id', $memberId, PDO::PARAM_INT);
    $upd->execute();

    $displayName = trim(($member['first_name'] ?? '') . ' ' . ($member['surname'] ?? ''));
    if ($displayName === '') {
        $displayName = $email;
    }

    $send = sendEmailVerificationLink($db, $email, $displayName, $token);

    if (!$send['success']) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => $send['message'] ?? 'Unable to send email.']);
        exit();
    }

    echo json_encode(['success' => true, 'message' => 'Verification email sent.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
