# Script to add CORS headers to all PHP API files
$files = @(
    "api\reports\export_attendance.php",
    "api\qr_sessions\list.php",
    "api\qr_sessions\get_session.php",
    "api\qr_sessions\get_guest_session.php",
    "api\qr_sessions\delete.php",
    "api\qr_sessions\create.php",
    "api\qr_sessions\checkin.php",
    "api\admin\login.php",
    "api\admin\get_profile.php",
    "api\admin\notifications.php",
    "api\dashboard\get_stats.php",
    "api\dashboard\get_recent_records.php",
    "api\dashboard\get_upcoming_birthdays.php",
    "api\members\login.php",
    "api\members\register.php",
    "api\members\get_all.php",
    "api\attendance\record.php",
    "api\attendance\get_all_events.php"
)

$oldPattern = @"
<?php
// CORS handled by Apache (apache-cors.conf)
if (`$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
"@

$newPattern = @"
<?php
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

// Handle preflight OPTIONS request
if (`$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
"@

$count = 0
foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match "CORS handled by Apache") {
            $content = $content -replace [regex]::Escape($oldPattern), $newPattern
            Set-Content $file -Value $content -NoNewline
            Write-Host "Updated: $file" -ForegroundColor Green
            $count++
        }
    }
}

Write-Host "`nTotal files updated: $count" -ForegroundColor Cyan
