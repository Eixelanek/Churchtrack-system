# Quick upload script for export_attendance.php fix
$ftpHost = "ftp://ftpupload.net"
$ftpUser = "if0_41276444"
$ftpPass = "FQdKr0jjkK"
$ftpPath = "/htdocs/api/reports/export_attendance.php"

Write-Host "Uploading export_attendance.php to InfinityFree..." -ForegroundColor Green

try {
    $uri = "$ftpHost$ftpPath"
    $webclient = New-Object System.Net.WebClient
    $webclient.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    
    # Upload file
    $localFile = Join-Path $PSScriptRoot "api\reports\export_attendance.php"
    $webclient.UploadFile($uri, $localFile)
    Write-Host "Successfully uploaded export_attendance.php" -ForegroundColor Green
    Write-Host ""
    Write-Host "The fix is now live at: https://churchtrack.infinityfreeapp.com" -ForegroundColor Yellow
    Write-Host "Try opening the Attendance Report again!" -ForegroundColor Cyan
}
catch {
    Write-Host "Upload failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please upload manually using FTP:" -ForegroundColor Yellow
    Write-Host "  Host: ftpupload.net"
    Write-Host "  User: if0_41276444"
    Write-Host "  Path: /htdocs/api/reports/export_attendance.php"
}
