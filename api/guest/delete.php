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

require_once '../config/database.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input) || empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Guest id is required']);
        exit();
    }

    $guestId = (int)$input['id'];
    if ($guestId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid guest id']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $db->beginTransaction();

    try {
        $checkStmt = $db->prepare('SELECT id FROM guests WHERE id = :id LIMIT 1');
        $checkStmt->bindParam(':id', $guestId, PDO::PARAM_INT);
        $checkStmt->execute();

        if (!$checkStmt->fetch(PDO::FETCH_ASSOC)) {
            $db->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Guest not found']);
            exit();
        }

        $deleteAttendanceStmt = $db->prepare('DELETE FROM guest_attendance WHERE guest_id = :guest_id');
        $deleteAttendanceStmt->bindParam(':guest_id', $guestId, PDO::PARAM_INT);
        $deleteAttendanceStmt->execute();

        $deleteGuestStmt = $db->prepare('DELETE FROM guests WHERE id = :id');
        $deleteGuestStmt->bindParam(':id', $guestId, PDO::PARAM_INT);
        $deleteGuestStmt->execute();

        $db->commit();

        echo json_encode(['success' => true, 'message' => 'Guest deleted']);
    } catch (Throwable $transactionError) {
        $db->rollBack();
        throw $transactionError;
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete guest: ' . $e->getMessage()
    ]);
}
