# FTP Upload Script for InfinityFree
# This script uploads the backend files to InfinityFree hosting

$ftpHost = "ftp://ftpupload.net"
$ftpUser = "if0_41276444"
$ftpPass = "FQdKr0jjkK"
$ftpPath = "/htdocs"

Write-Host "Starting upload to InfinityFree..." -ForegroundColor Green

# Create FTP client function
function Upload-FtpDirectory {
    param(
        [string]$LocalPath,
        [string]$RemotePath
    )
    
    $files = Get-ChildItem -Path $LocalPath -Recurse -File
    $totalFiles = $files.Count
    $current = 0
    
    foreach ($file in $files) {
        $current++
        $relativePath = $file.FullName.Substring($LocalPath.Length).Replace('\', '/')
        $remoteFile = "$RemotePath$relativePath"
        
        Write-Progress -Activity "Uploading files" -Status "$current of $totalFiles" -PercentComplete (($current / $totalFiles) * 100)
        
        try {
            $uri = "$ftpHost$remoteFile"
            $webclient = New-Object System.Net.WebClient
            $webclient.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
            
            # Upload file
            $webclient.UploadFile($uri, $file.FullName)
            Write-Host "✓ Uploaded: $relativePath" -ForegroundColor Gray
        }
        catch {
            Write-Host "✗ Failed: $relativePath - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Upload api folder
Write-Host "`nUploading api folder..." -ForegroundColor Cyan
Upload-FtpDirectory -LocalPath ".\api" -RemotePath "$ftpPath/api"

# Upload vendor folder
Write-Host "`nUploading vendor folder..." -ForegroundColor Cyan
Upload-FtpDirectory -LocalPath ".\vendor" -RemotePath "$ftpPath/vendor"

# Upload uploads folder
Write-Host "`nUploading uploads folder..." -ForegroundColor Cyan
Upload-FtpDirectory -LocalPath ".\uploads" -RemotePath "$ftpPath/uploads"

Write-Host "`n✓ Upload complete!" -ForegroundColor Green
Write-Host "Your backend is now at: https://churchtrack.infinityfreeapp.com" -ForegroundColor Yellow
