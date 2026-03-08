# Add CORS headers to all PHP files in api folder
Write-Host "Adding CORS headers to all API files..." -ForegroundColor Cyan

$corsHeaders = @"
// Add CORS headers for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

"@

$files = Get-ChildItem -Path "api" -Filter "*.php" -Recurse
$updated = 0
$skipped = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Skip if already has CORS headers
    if ($content -match "Access-Control-Allow-Origin") {
        Write-Host "  Skipped (already has CORS): $($file.FullName)" -ForegroundColor Gray
        $skipped++
        continue
    }
    
    # Add CORS headers after <?php
    if ($content -match "^<\?php\s*\n") {
        $newContent = $content -replace "^(<\?php\s*\n)", "`$1$corsHeaders"
        Set-Content $file.FullName -Value $newContent -NoNewline
        Write-Host "  Updated: $($file.FullName)" -ForegroundColor Green
        $updated++
    } else {
        Write-Host "  Skipped (no PHP tag): $($file.FullName)" -ForegroundColor Yellow
        $skipped++
    }
}

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Updated: $updated files" -ForegroundColor Green
Write-Host "  Skipped: $skipped files" -ForegroundColor Yellow
