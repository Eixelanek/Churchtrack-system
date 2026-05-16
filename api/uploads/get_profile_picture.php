<?php
// Profile picture endpoint.
// New uploads are Cloudinary URLs stored directly in the DB.
// This endpoint handles legacy local file paths for backwards compatibility.

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

$filePath = isset($_GET['path']) ? trim($_GET['path']) : null;

if (!$filePath) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'File path is required']);
    exit();
}

// If it's already a full URL (Cloudinary), redirect to it
if (str_starts_with($filePath, 'http://') || str_starts_with($filePath, 'https://')) {
    header('Location: ' . $filePath, true, 302);
    exit();
}

// Legacy: serve from local filesystem
$filePath = str_replace(['../', '..\\'], '', $filePath);
$filePath = ltrim($filePath, '/');
$fullPath = __DIR__ . '/../../uploads/profile_pictures/' . basename($filePath);

if (!file_exists($fullPath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'File not found']);
    exit();
}

$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$types = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp'];
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($fullPath));
header('Cache-Control: public, max-age=86400');
readfile($fullPath);
exit();
?>
