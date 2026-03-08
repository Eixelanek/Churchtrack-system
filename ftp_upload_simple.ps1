# Simple FTP Upload for InfinityFree
$ftpServer = "ftp://ftpupload.net/htdocs"
$username = "if0_41276444"
$password = "FQdKr0jjkK"

Write-Host "Uploading files to InfinityFree..." -ForegroundColor Green
Write-Host "This may take several minutes..." -ForegroundColor Yellow

# Function to upload a single file
function Upload-File {
    param($LocalFile, $RemotePath)
    
    try {
        $webclient = New-Object System.Net.WebClient
        $webclient.Credentials = New-Object System.Net.NetworkCredential($username, $password)
        $uri = "$ftpServer/$RemotePath"
        $webclient.UploadFile($uri, $LocalFile)
        return $true
    }
    catch {
        Write-Host "Error uploading $RemotePath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Upload .htaccess
Write-Host "`nUploading .htaccess..." -ForegroundColor Cyan
Upload-File "api\.htaccess" "api/.htaccess"

# Upload database config
Write-Host "Uploading database config..." -ForegroundColor Cyan
Upload-File "api\config\database.php" "api/config/database.php"

Write-Host "`n✓ Critical files uploaded!" -ForegroundColor Green
Write-Host "`nNOTE: You need to upload the full api/, vendor/, and uploads/ folders" -ForegroundColor Yellow
Write-Host "Use FileZilla for easier bulk upload:" -ForegroundColor Yellow
Write-Host "  Host: ftpupload.net" -ForegroundColor White
Write-Host "  Username: if0_41276444" -ForegroundColor White
Write-Host "  Password: FQdKr0jjkK" -ForegroundColor White
Write-Host "  Upload to: /htdocs/" -ForegroundColor White
