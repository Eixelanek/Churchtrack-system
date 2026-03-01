# PowerShell script to auto-sync API files
Write-Host "Watching for changes in C:\Ken\CLCC System\api..." -ForegroundColor Green

$source = "C:\Ken\CLCC System\api"
$destination = "C:\xampp\htdocs\api"

# Create destination folder if it doesn't exist
if (!(Test-Path $destination)) {
    New-Item -ItemType Directory -Path $destination -Force
}

# Initial sync
Write-Host "Performing initial sync..." -ForegroundColor Yellow
robocopy $source $destination /E /XO

# Watch for changes
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $source
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] $changeType detected: $path" -ForegroundColor Cyan
    
    # Sync the changed file
    $relativePath = $path.Substring($source.Length + 1)
    $destPath = Join-Path $destination $relativePath
    $destDir = Split-Path $destPath -Parent
    
    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    Copy-Item $path $destPath -Force
    Write-Host "Synced: $relativePath" -ForegroundColor Green
}

Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Renamed" -Action $action

Write-Host "File watcher started. Press Ctrl+C to stop." -ForegroundColor Green

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-Host "File watcher stopped." -ForegroundColor Red
}
