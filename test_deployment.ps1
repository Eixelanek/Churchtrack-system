# Test Deployment Script
Write-Host "Testing FaithTrack Deployment..." -ForegroundColor Cyan
Write-Host ""

# Test Backend
Write-Host "1. Testing Backend API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://churchtrack-api.onrender.com/api/admin/get_church_settings.php" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend API is working!" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "   Church Name: $($json.data.churchName)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Backend API failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test Frontend Homepage
Write-Host "2. Testing Frontend Homepage..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://churchtrack-system.vercel.app" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend homepage is working!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Frontend homepage failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test Frontend Login Page (Direct URL)
Write-Host "3. Testing Frontend Login Page (Direct URL)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://churchtrack-system.vercel.app/login" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Login page is accessible via direct URL!" -ForegroundColor Green
        Write-Host "   This means the routing fix worked!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Login page failed: $_" -ForegroundColor Red
    Write-Host "   Vercel may still be deploying. Wait 1-2 minutes and try again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Testing complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open https://churchtrack-system.vercel.app/login in your browser" -ForegroundColor White
Write-Host "2. Login with: admin / admin123" -ForegroundColor White
Write-Host "3. Test all features" -ForegroundColor White
