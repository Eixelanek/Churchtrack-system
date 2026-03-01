<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // Get all active members for referral selection
    $query = "SELECT 
                id, 
                CONCAT(first_name, ' ', 
                       COALESCE(CONCAT(middle_name, ' '), ''), 
                       surname,
                       CASE WHEN suffix != 'None' THEN CONCAT(' ', suffix) ELSE '' END) as name,
                username, 
                email, 
                birthday 
              FROM members 
              WHERE status = 'active' 
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
            'birthday' => $row['birthday']
        ];
    }

    http_response_code(200);
    echo json_encode($members);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server error: " . $e->getMessage()]);
}
?> 