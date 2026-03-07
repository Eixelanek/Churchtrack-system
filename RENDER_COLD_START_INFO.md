# Render Free Tier - Cold Start Issue

## What's Happening

Render's free tier "spins down" your backend after 15 minutes of inactivity to save resources.

When someone visits your site after it's been inactive:
1. First request → Backend is sleeping → Takes 30-60 seconds to wake up → Request fails
2. Second request → Backend is awake → Works immediately ✅

## The Error You Saw

```
Network error: Failed to fetch
POST https://churchtrack-api.onrender.com/api/admin/login.php net::ERR_FAILED
```

This happens when the backend is waking up from sleep.

## Solution

### Option 1: Just Wait and Retry (Free)
1. When you see the error, wait 30 seconds
2. Try logging in again
3. It should work the second time

### Option 2: Keep Backend Awake (Free)
Use a service to ping your backend every 10 minutes:

**UptimeRobot** (Free):
1. Go to: https://uptimerobot.com
2. Sign up (free)
3. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: ChurchTrack Backend
   - URL: https://churchtrack-api.onrender.com/api/admin/get_church_settings.php
   - Monitoring Interval: 5 minutes
4. Save

This keeps your backend awake 24/7!

### Option 3: Upgrade Render (Paid)
- Render Starter Plan: $7/month
- Backend never sleeps
- Faster response times
- More resources

## Current Workaround

If you get a login error:
1. Wait 30 seconds
2. Refresh the page
3. Try logging in again
4. Should work! ✅

## Testing Backend Status

Run this command to wake up the backend:
```powershell
curl https://churchtrack-api.onrender.com/api/admin/get_church_settings.php
```

If it takes 30+ seconds to respond, it was sleeping.
If it responds in 1-2 seconds, it's awake.

## Recommended Setup

For production use, I recommend:
1. Set up UptimeRobot (free, keeps backend awake)
2. Or upgrade to Render Starter ($7/month)

For now, just retry the login after 30 seconds if it fails!

---

**Try logging in again now - the backend should be awake!**
