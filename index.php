<?php
// Railway entry point - routes all requests to the api folder
$requestUri = $_SERVER['REQUEST_URI'];

// Remove query string
$path = parse_url($requestUri, PHP_URL_PATH);

// If requesting /api/*, serve from api folder
if (strpos($path, '/api/') === 0) {
    $file = __DIR__ . $path;
    
    // If it's a PHP file, execute it
    if (file_exists($file) && pathinfo($file, PATHINFO_EXTENSION) === 'php') {
        require $file;
        exit;
    }
    
    // If it's a directory, look for index.php
    if (is_dir($file) && file_exists($file . '/index.php')) {
        require $file . '/index.php';
        exit;
    }
}

// Health check endpoint
if ($path === '/' || $path === '/health') {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'ok',
        'message' => 'ChurchTrack API is running',
        'timestamp' => date('c')
    ]);
    exit;
}

// 404 for everything else
http_response_code(404);
header('Content-Type: application/json');
echo json_encode([
    'error' => 'Not found',
    'path' => $path
]);
