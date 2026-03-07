# Test New Vercel Deployment
Write-Host "Testing New Vercel Deployment..." -ForegroundColor Cyan
Write-Host ""

$newUrl = "https://faithtrack-rho.vercel.app"

# Test Homepage
Write-Host "1. Testing Homepage..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$newUrl" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Homepage works!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Homepage failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test Login Page (Direct URL)
Write-Host "2. Testing Login Page (Direct URL)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$newUrl/login" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Login page works via direct URL!" -ForegroundColor Green
        Write-Host "   🎉 ROUTING IS FIXED!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Login page failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test Register Page
Write-Host "3. Testing Register Page..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$newUrl/register" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Register page works!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Register page failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test Backend API
Write-Host "4. Testing Backend API Connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://churchtrack-api.onrender.com/api/admin/get_church_settings.php" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend API is working!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Backend API failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your new URL: $newUrl" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open: $newUrl/login" -ForegroundColor White
Write-Host "2. Login with: admin / admin123" -ForegroundColor White
Write-Host "3. Test all features" -ForegroundColor White
Write-Host ""
Write-Host "Note: This is a NEW Vercel project." -ForegroundColor Yellow
Write-Host "The old URL (churchtrack-system.vercel.app) still exists." -ForegroundColor Yellow
Write-Host "You can delete it later from Vercel dashboard." -ForegroundColor Yellow
