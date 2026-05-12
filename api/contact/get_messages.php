<?php
// Get contact messages
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $status = $_GET['status'] ?? 'all';
    $validStatuses = ['all', 'new', 'read', 'replied'];
    
    if (!in_array($status, $validStatuses)) {
        $status = 'all';
    }

    $query = "SELECT id, first_name, last_name, email, phone, message, status, created_at FROM contact_messages";
    
    if ($status !== 'all') {
        $query .= " WHERE status = :status";
    }
    
    $query .= " ORDER BY created_at DESC";

    $stmt = $db->prepare($query);
    
    if ($status !== 'all') {
        $stmt->bindParam(':status', $status);
    }
    
    $stmt->execute();
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'messages' => $messages
    ]);

} catch (Exception $e) {
    error_log('Get messages error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
