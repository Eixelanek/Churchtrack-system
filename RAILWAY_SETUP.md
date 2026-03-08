# Railway Deployment Guide for ChurchTrack Backend

## Prerequisites
1. Create a Railway account at https://railway.app
2. Install Railway CLI (optional): `npm install -g @railway/cli`

## Deployment Steps

### Option 1: Deploy via Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**
   - Visit https://railway.app/dashboard
   - Click "New Project"

2. **Deploy from GitHub**
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account if not already connected
   - Select your ChurchTrack repository
   - Railway will auto-detect the PHP project

3. **Add MySQL Database**
   - In your project, click "New"
   - Select "Database" → "Add MySQL"
   - Railway will provision a MySQL database

4. **Configure Environment Variables**
   - Click on your service
   - Go to "Variables" tab
   - Add these variables:
     ```
     DB_HOST=<from MySQL service>
     DB_NAME=railway
     DB_USER=<from MySQL service>
     DB_PASSWORD=<from MySQL service>
     DB_PORT=<from MySQL service>
     ```
   - Railway will auto-populate MySQL variables if you connect the services

5. **Update database.php**
   - The database config will read from environment variables
   - No code changes needed if using Railway's MySQL

6. **Deploy**
   - Railway will automatically deploy
   - Get your public URL from the "Settings" → "Domains" section
   - Click "Generate Domain" to get a public URL

### Option 2: Deploy via Railway CLI

```bash
# Login to Railway
railway login

# Initialize project
railway init

# Link to existing project or create new
railway link

# Add MySQL database
railway add

# Deploy
railway up

# Get the URL
railway domain
```

## Post-Deployment

1. **Import Database Schema**
   - Use Railway's MySQL client or phpMyAdmin
   - Import `database_schema_complete.sql`
   - Or use Railway CLI:
     ```bash
     railway run mysql -u root -p < database_schema_complete.sql
     ```

2. **Update Frontend API URL**
   - Update `faithtrack/src/config/api.js`
   - Change `API_BASE_URL` to your Railway URL
   - Example: `https://churchtrack-production.up.railway.app`

3. **Test the API**
   - Visit: `https://your-railway-url.railway.app/health`
   - Should return: `{"status":"ok","message":"ChurchTrack API is running"}`

4. **Redeploy Frontend**
   ```bash
   cd faithtrack
   npm run build
   netlify deploy --prod
   ```

## Environment Variables Reference

Required variables for Railway:
- `DB_HOST` - MySQL host (auto-provided by Railway)
- `DB_NAME` - Database name (default: railway)
- `DB_USER` - MySQL user (auto-provided by Railway)
- `DB_PASSWORD` - MySQL password (auto-provided by Railway)
- `DB_PORT` - MySQL port (auto-provided by Railway)

## Troubleshooting

### Database Connection Issues
- Check if MySQL service is running
- Verify environment variables are set correctly
- Check Railway logs: `railway logs`

### CORS Issues
- Railway automatically handles CORS
- If issues persist, check `api/cors.php`

### File Upload Issues
- Railway has ephemeral filesystem
- Consider using cloud storage (Cloudinary, AWS S3) for uploads

## Cost
- Railway Free Tier: $5 credit/month
- Enough for small to medium traffic
- Upgrade to Pro ($20/month) for production use

## Support
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
