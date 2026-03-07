# Quick Fix for Login Error

## The Problem
Render free tier puts your backend to sleep after 15 minutes of inactivity.
First login attempt fails because backend is waking up (30-60 seconds).

## Immediate Solution

### Try This Now:
1. Open: https://faithtrack-rho.vercel.app/login
2. If you see "Network error", wait 30 seconds
3. Click "Sign In" again
4. Should work now! ✅

The backend is now awake from our tests, so it should work immediately!

## Login Credentials
- Username: `admin`
- Password: `admin123`

## If It Still Doesn't Work

### Check 1: Is Backend Awake?
Open this URL in a new tab:
https://churchtrack-api.onrender.com/api/admin/get_church_settings.php

Should show JSON data immediately.
If it takes 30+ seconds, backend was sleeping.

### Check 2: Try Direct API Test
Run this in PowerShell:
```powershell
$body = '{"username":"admin","password":"admin123"}' 
Invoke-WebRequest -Uri "https://churchtrack-api.onrender.com/api/admin/login.php" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

Should return: `{"message":"Login successful.",...}`

## Permanent Fix (Recommended)

### Use UptimeRobot (Free!)
Keeps your backend awake 24/7:

1. Go to: https://uptimerobot.com
2. Sign up (free account)
3. Click "Add New Monitor"
4. Settings:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: **ChurchTrack API**
   - URL: **https://churchtrack-api.onrender.com/api/admin/get_church_settings.php**
   - Monitoring Interval: **5 minutes**
5. Click "Create Monitor"

Done! Your backend will never sleep again.

## Alternative: Paid Render Plan
- $7/month
- No cold starts
- Faster performance
- More reliable

---

**Try logging in now! Backend should be awake from our tests.**

If you still get an error, wait 30 seconds and try again.
