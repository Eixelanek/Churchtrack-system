# Quick Railway Deployment Steps

## 1. Push to GitHub (if not yet done)
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## 2. Deploy to Railway

### Via Railway Dashboard (Easiest)

1. **Go to Railway**: https://railway.app/new
   
2. **Deploy from GitHub**:
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect PHP

3. **Add MySQL Database**:
   - Click "New" → "Database" → "Add MySQL"
   - Railway will create a MySQL instance
   - It will auto-link to your service

4. **Get Your URL**:
   - Click on your service
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://churchtrack-production.up.railway.app`)

5. **Import Database**:
   - Click on MySQL service
   - Go to "Data" tab
   - Or use Railway CLI:
     ```bash
     railway link
     railway run mysql -u root -p railway < database_schema_complete.sql
     ```

## 3. Update Frontend

Update `faithtrack/src/config/api.js`:
```javascript
export const API_BASE_URL = 'https://your-railway-url.up.railway.app';
```

Then deploy:
```bash
cd faithtrack
npm run build
netlify deploy --prod
```

## 4. Test

Visit: `https://your-railway-url.up.railway.app/health`

Should return:
```json
{
  "status": "ok",
  "message": "ChurchTrack API is running",
  "timestamp": "2026-03-08T..."
}
```

## Done! 🎉

Your backend is now on Railway with:
- ✅ No anti-bot protection
- ✅ Automatic HTTPS
- ✅ Free MySQL database
- ✅ Better reliability than InfinityFree

## Next Steps

1. Test login functionality
2. Test attendance recording
3. Test reports generation
4. Monitor Railway dashboard for usage

## Troubleshooting

If you get database errors:
1. Check Railway logs: Click on service → "Deployments" → Latest deployment → "View Logs"
2. Verify MySQL service is running
3. Check environment variables are set

If you need help, Railway has great docs: https://docs.railway.app
