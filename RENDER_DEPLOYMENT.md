# Render Deployment Guide - ChurchTrack Backend

## Why Render?
- ✅ **Free tier** - Enough for small to medium apps
- ✅ **No anti-bot protection** - Unlike InfinityFree
- ✅ **Built-in MySQL** - Free PostgreSQL/MySQL database
- ✅ **Auto-deploy from GitHub** - Push and it deploys
- ✅ **HTTPS included** - Automatic SSL certificates
- ✅ **Better than InfinityFree** - More reliable

## Quick Deployment (10 minutes)

### Step 1: Prepare GitHub Repository

```bash
# Make sure all files are committed
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Deploy to Render

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign up/Login (pwede GitHub account)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your ChurchTrack repo

3. **Configure Service**
   - **Name**: `churchtrack-api`
   - **Environment**: `Docker`
   - **Region**: `Singapore` (closest to Philippines)
   - **Branch**: `main`
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: `Free`

4. **Create MySQL Database**
   - Click "New +" → "PostgreSQL" (or use external MySQL like Aiven)
   - **Name**: `churchtrack-db`
   - **Database**: `churchtrack`
   - **User**: `churchtrack`
   - **Plan**: `Free`

5. **Link Database to Service**
   - Go to your web service
   - Click "Environment"
   - Add environment variables:
     ```
     DB_HOST=<from database>
     DB_PORT=<from database>
     DB_NAME=churchtrack
     DB_USER=<from database>
     DB_PASSWORD=<from database>
     ```
   - Or use Aiven credentials (already in code as fallback)

6. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy (takes 5-10 minutes)
   - Get your URL: `https://churchtrack-api.onrender.com`

### Step 3: Import Database

**Option A: Use Aiven (Current Database)**
- No need to import! Already configured as fallback
- Just make sure Aiven is accessible

**Option B: Use Render PostgreSQL**
- Connect to database using provided credentials
- Import schema:
  ```bash
  # Convert MySQL to PostgreSQL or use Aiven
  ```

### Step 4: Update Frontend

Update `faithtrack/src/config/api.js`:
```javascript
export const API_BASE_URL = 'https://churchtrack-api.onrender.com';
```

Remove or update the proxy to use direct API calls:
```javascript
// Option 1: Use direct API calls (no proxy needed on Render)
export const apiCall = async (endpoint, options = {}) => {
  const { method = 'POST', data = {} } = options;
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString()
  });
  
  return await response.json();
};
```

Deploy frontend:
```bash
cd faithtrack
npm run build
netlify deploy --prod
```

### Step 5: Test

1. **Health Check**
   ```
   https://churchtrack-api.onrender.com/health
   ```
   Should return: `{"status":"ok"}`

2. **Test API Endpoint**
   ```
   https://churchtrack-api.onrender.com/api/admin/get_church_settings.php
   ```

3. **Test Frontend**
   - Visit: https://churchtrack-system.netlify.app
   - Try logging in
   - Check if data loads

## Important Notes

### Free Tier Limitations
- **Cold starts**: Service sleeps after 15 min of inactivity
- **First request**: May take 30-60 seconds to wake up
- **Solution**: Use a cron job to ping every 10 minutes (optional)

### Keep Service Awake (Optional)
Use a free service like UptimeRobot:
1. Go to https://uptimerobot.com
2. Add monitor: `https://churchtrack-api.onrender.com/health`
3. Check every 5 minutes
4. This keeps your service awake!

### Database Options

**Option 1: Keep using Aiven (Recommended)**
- Already configured as fallback
- No migration needed
- Just deploy to Render

**Option 2: Use Render PostgreSQL**
- Free tier included
- Need to convert MySQL to PostgreSQL
- Or use MySQL-compatible service

## Troubleshooting

### Build Fails
- Check Dockerfile syntax
- Check composer.json is valid
- View build logs in Render dashboard

### Database Connection Error
- Verify environment variables
- Check Aiven is accessible from Render
- Check database credentials

### CORS Errors
- Check apache-config.conf
- Verify CORS headers in PHP files
- Check Render logs

### Service Won't Start
- Check Render logs: Dashboard → Service → Logs
- Verify port 80 is exposed
- Check Apache configuration

## Cost

**Free Tier:**
- Web Service: Free (with cold starts)
- PostgreSQL: Free (256MB storage)
- Bandwidth: 100GB/month

**Paid Tier ($7/month):**
- No cold starts
- More resources
- Better for production

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- This project: Create GitHub issue

---

## Quick Commands

```bash
# Deploy
git push origin main  # Auto-deploys to Render

# View logs
# Go to Render Dashboard → Service → Logs

# Restart service
# Go to Render Dashboard → Service → Manual Deploy → Deploy latest commit
```

## Success Checklist

- [ ] Render service deployed
- [ ] Database connected (Aiven or Render)
- [ ] Health check returns OK
- [ ] Frontend updated with new API URL
- [ ] Frontend deployed to Netlify
- [ ] Login works
- [ ] Attendance recording works
- [ ] Reports work

## Done! 🎉

Your backend is now on Render with better reliability than InfinityFree!
