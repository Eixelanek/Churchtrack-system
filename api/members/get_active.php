<?php
// Add CORS headers for cross-origin requests
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Get all active and inactive members for manual attendance
    $query = "SELECT 
                id, 
                CONCAT(first_name, ' ', 
                       COALESCE(CONCAT(middle_name, ' '), ''), 
                       surname,
                       CASE WHEN suffix != 'None' THEN CONCAT(' ', suffix) ELSE '' END) as name,
                username, 
                email, 
                birthday,
                status
              FROM members 
              WHERE status IN ('active', 'inactive')
              ORDER BY surname, first_name";
    $stmt = $db->prepare($query);
    $stmt->execute();

    $members = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $members[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'username' => $row['username'],
            'email' => $row['email'],
            'birthday' => $row['birthday'],
            'status' => $row['status']
        ];
    }

    http_response_code(200);
    echo json_encode($members);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 