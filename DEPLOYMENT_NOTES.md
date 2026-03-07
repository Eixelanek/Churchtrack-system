# FaithTrack Deployment Notes

## ✅ CURRENT DEPLOYMENT STATUS (March 8, 2026)

### Backend (Render.com) ✅
- **URL**: https://churchtrack-api.onrender.com
- **Status**: Deployed and running
- **Test Endpoint**: https://churchtrack-api.onrender.com/api/admin/get_church_settings.php
- **Response**: Returns JSON successfully
- **Auto-Deploy**: Enabled from GitHub main branch

### Frontend (Vercel) 🔄
- **Project**: churchtrack-system-v2
- **URL**: https://churchtrack-system.vercel.app
- **Status**: Redeploying with routing fixes
- **Environment Variable**: VITE_API_URL = https://churchtrack-api.onrender.com
- **Build Command**: `cd faithtrack && npm install && npm run build`
- **Output Directory**: `faithtrack/dist`
- **Auto-Deploy**: Enabled from GitHub main branch

### Database (Aiven MySQL) ✅
- **Host**: churchtrack-db-churchtrack.a.aivencloud.com
- **Port**: 17629
- **Database**: defaultdb
- **User**: avnadmin
- **Status**: All 16 tables imported successfully
- **Tables**: admin, attendance_records, church_settings, events, family_relationships, guests, linked_events, login_history, member_notifications, members, notification_reads, notifications, password_reset_requests, profile_pictures, qr_sessions, sessions

---

## 🔧 RECENT FIXES (Latest First)

### March 8, 2026 - Routing Fix
**Problem**: Direct URL access to `/login` returned 404 error
**Solution**: 
- Updated `vercel.json` with both `rewrites` and `routes` configuration
- Created `faithtrack/vercel.json` for SPA routing
- Pushed to GitHub, Vercel auto-deploying

**Files Modified**:
1. `vercel.json` - Added routes configuration for filesystem handling
2. `faithtrack/vercel.json` - New file with SPA rewrites
3. `faithtrack/public/test.json` - Test endpoint

### March 8, 2026 - Backend Migration
**Problem**: InfinityFree had CORS restrictions on free tier
**Solution**: Migrated to Render.com with Docker deployment
- Created Dockerfile with Apache/PHP 8.1
- Configured environment variables for Aiven database
- Deployed successfully

### March 8, 2026 - Database Migration
**Problem**: Needed reliable MySQL hosting
**Solution**: Migrated to Aiven MySQL free tier
- Created database instance
- Imported all 16 tables using `import_to_aiven.php`
- Updated `api/config/database.php` with Aiven credentials

---

## 📋 TESTING CHECKLIST

After Vercel deployment completes:

1. ✅ Homepage loads: https://churchtrack-system.vercel.app
2. 🔄 Direct login URL: https://churchtrack-system.vercel.app/login (testing after redeploy)
3. ⏳ Login with admin/admin123
4. ⏳ Dashboard loads with data
5. ⏳ Member registration works
6. ⏳ QR code check-in works
7. ⏳ Image uploads work

---

## 🔑 DEFAULT CREDENTIALS

- **Admin**: username `admin`, password `admin123`

---

## 🏗️ DEPLOYMENT ARCHITECTURE

```
User Browser
    ↓
Vercel (Frontend - React SPA)
    ↓ HTTPS API Calls
Render.com (Backend - PHP/Apache in Docker)
    ↓ MySQL Connection
Aiven (MySQL Database)
```

---

## 🔄 UPDATE PROCESS

To update the application after deployment:

### 1. Make Changes Locally
```cmd
cd "F:\Ken\CLCC System"
# Edit your files
```

### 2. Test Locally (Optional)
```cmd
cd faithtrack
npm run dev
```

### 3. Commit Changes
```cmd
git add .
git commit -m "Description of changes"
```

### 4. Push to GitHub
```cmd
git push origin main
```

### 5. Auto-Deploy
- ✅ Vercel automatically deploys frontend (~2 minutes)
- ✅ Render automatically deploys backend (~5 minutes)
- ⚠️ Database changes require manual SQL execution in Aiven console

---

## 🐛 TROUBLESHOOTING

### Frontend Issues

**404 on Direct URL Access**
- Check `vercel.json` has rewrites configuration
- Verify `faithtrack/vercel.json` exists
- Check Vercel deployment logs
- Ensure build completed successfully

**API Calls Failing**
- Verify VITE_API_URL environment variable in Vercel
- Check browser console for CORS errors
- Test backend endpoint directly: https://churchtrack-api.onrender.com/api/admin/get_church_settings.php

### Backend Issues

**Database Connection Failed**
- Check `api/config/database.php` has correct Aiven credentials
- Verify Aiven database is running
- Check Render logs for connection errors

**API Returns HTML Instead of JSON**
- Check if PHP file has syntax errors
- Verify Apache is serving PHP files correctly
- Check Render deployment logs

### Database Issues

**Tables Not Found**
- Verify all 16 tables were imported
- Check Aiven console → Tables tab
- Re-run `import_to_aiven.php` if needed

---

## 📚 IMPORTANT FILES

### Configuration Files
- `api/config/database.php` - Database connection settings
- `vercel.json` - Vercel deployment configuration
- `faithtrack/vercel.json` - SPA routing configuration
- `Dockerfile` - Render backend deployment
- `faithtrack/vite.config.js` - Vite build configuration

### Deployment Scripts
- `import_to_aiven.php` - Database import script
- `database_schema_complete.sql` - Complete database schema

### Environment Variables
- Vercel: `VITE_API_URL` = https://churchtrack-api.onrender.com
- Render: Database credentials (host, port, user, password, database)

---

## 🔗 USEFUL LINKS

- **GitHub Repository**: https://github.com/Eixelanek/Churchtrack-system
- **Frontend (Vercel)**: https://churchtrack-system.vercel.app
- **Backend (Render)**: https://churchtrack-api.onrender.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Render Dashboard**: https://dashboard.render.com
- **Aiven Console**: https://console.aiven.io

---

## 🚀 NEXT STEPS

1. Wait for Vercel deployment to complete
2. Test direct login URL: https://churchtrack-system.vercel.app/login
3. Login with admin/admin123
4. Verify all features work
5. Test on mobile device
6. Share URL with client for testing

---

## 📝 MIGRATION TO clcc.life (Future)

When client provides domain access:

1. **Update DNS Records**
   - Point clcc.life to Vercel (A record or CNAME)
   - Add domain in Vercel project settings

2. **Update Environment Variables**
   - No changes needed (backend URL stays the same)

3. **Update CORS (if needed)**
   - Backend already allows all origins for development
   - Can restrict to specific domain later

4. **SSL Certificate**
   - Vercel provides automatic SSL for custom domains
   - No additional configuration needed

---

Good luck! 🚀

**Last Updated**: March 8, 2026
**Status**: Waiting for Vercel deployment to complete
