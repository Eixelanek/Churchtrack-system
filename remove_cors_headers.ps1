# PowerShell script to remove CORS headers from all PHP files
# CORS is now handled by Apache config (apache-cors.conf)

$phpFiles = Get-ChildItem -Path "api" -Filter "*.php" -Recurse

foreach ($file in $phpFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Skip if file doesn't have CORS headers
    if ($content -notmatch 'Access-Control-Allow') {
        continue
    }
    
    Write-Host "Processing: $($file.FullName)"
    
    # Remove CORS header lines
    $content = $content -replace 'header\("Access-Control-Allow-Origin:.*?\);\r?\n', ''
    $content = $content -replace 'header\("Access-Control-Allow-Methods:.*?\);\r?\n', ''
    $content = $content -replace 'header\("Access-Control-Allow-Headers:.*?\);\r?\n', ''
    $content = $content -replace 'header\("Access-Control-Allow-Credentials:.*?\);\r?\n', ''
    $content = $content -replace 'header\("Access-Control-Max-Age:.*?\);\r?\n', ''
    
    # Remove empty lines at the start after <?php
    $content = $content -replace '(<\?php)\r?\n\r?\n+', '$1' + "`r`n"
    
    # Save the file
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "`nDone! Removed CORS headers from all PHP files."
Write-Host "CORS is now handled by Apache config (apache-cors.conf)"
