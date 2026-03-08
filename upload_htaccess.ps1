# Upload .htaccess file to InfinityFree
$ftpHost = "ftp://ftpupload.net"
$ftpUser = "if0_41276444"
$ftpPass = "FQdKr0jjkK"

Write-Host "Uploading .htaccess to InfinityFree..." -ForegroundColor Green

try {
    # Upload api/.htaccess
    $uri = "$ftpHost/htdocs/api/.htaccess"
    $webclient = New-Object System.Net.WebClient
    $webclient.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $webclient.UploadFile($uri, "api\.htaccess")
    Write-Host "Successfully uploaded api/.htaccess" -ForegroundColor Green
}
catch {
    Write-Host "Failed to upload: $($_.Exception.Message)" -ForegroundColor Red
}
