<?php
// Test script to debug update_profile.php issues
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Test database connection
    echo json_encode([
        'success' => true,
        'message' => 'Database connection successful',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    // Check if guardian_middle_name column exists
    $checkColumnQuery = "SHOW COLUMNS FROM members LIKE 'guardian_middle_name'";
    $checkStmt = $db->query($checkColumnQuery);
    $columnExists = $checkStmt->rowCount() > 0;
    
    echo "\n" . json_encode([
        'guardian_middle_name_column_exists' => $columnExists
    ]);
    
    // Check members table structure
    $columnsQuery = "SHOW COLUMNS FROM members";
    $columnsStmt = $db->query($columnsQuery);
    $columns = $columnsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\n" . json_encode([
        'members_table_columns' => array_column($columns, 'Field')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
?>