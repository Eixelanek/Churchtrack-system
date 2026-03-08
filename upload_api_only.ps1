# Upload only API folder to InfinityFree
$ftpHost = "ftp://ftpupload.net"
$ftpUser = "if0_41276444"
$ftpPass = "FQdKr0jjkK"

Write-Host "Uploading API folder to InfinityFree..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "api" -Filter "*.php" -Recurse
$total = $files.Count
$current = 0

foreach ($file in $files) {
    $current++
    $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    $remotePath = "/htdocs/$relativePath"
    
    Write-Progress -Activity "Uploading" -Status "$current of $total - $relativePath" -PercentComplete (($current / $total) * 100)
    
    try {
        $uri = "$ftpHost$remotePath"
        $webclient = New-Object System.Net.WebClient
        $webclient.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $webclient.UploadFile($uri, $file.FullName)
    }
    catch {
        Write-Host "Failed: $relativePath" -ForegroundColor Red
    }
}

Write-Host "`nUpload complete!" -ForegroundColor Green
Write-Host "Backend updated at: https://churchtrack.infinityfreeapp.com" -ForegroundColor Yellow
