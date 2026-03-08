<?php

// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get the file path from query parameter
$filePath = isset($_GET['path']) ? $_GET['path'] : null;

if (!$filePath) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "File path is required"
    ]);
    exit();
}

// Sanitize the path to prevent directory traversal
$filePath = str_replace(['../', '..\\'], '', $filePath);
$filePath = ltrim($filePath, '/');

// Build the full path
$fullPath = __DIR__ . '/../../uploads/profile_pictures/' . basename($filePath);

// Check if file exists
if (!file_exists($fullPath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        "success" => false,
        "message" => "File not found"
    ]);
    exit();
}

// Get the file extension
$extension = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));

// Set the appropriate content type
$contentTypes = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp'
];

$contentType = $contentTypes[$extension] ?? 'application/octet-stream';

// Output the image
header('Content-Type: ' . $contentType);
header('Content-Length: ' . filesize($fullPath));
header('Cache-Control: public, max-age=86400'); // Cache for 1 day

readfile($fullPath);
exit();
?>
