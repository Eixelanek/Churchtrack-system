# FaithTrack Deployment Guide

## Overview
This guide will help you deploy FaithTrack to the internet using free hosting services.

## Architecture
- **Frontend**: React app (Vite) → Deploy to Vercel
- **Backend**: PHP API + MySQL → Deploy to InfinityFree or similar
- **Updates**: Push to GitHub → Auto-deploys to Vercel

---

## Step 1: Push to GitHub

### 1.1 Create GitHub Repository
1. Go to https://github.com/new
2. Create a new repository (e.g., "faithtrack-system")
3. Keep it private if you want
4. Don't initialize with README (we already have files)

### 1.2 Push Your Code
```cmd
git init
git add .
git commit -m "Initial commit - FaithTrack system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/faithtrack-system.git
git push -u origin main
```

---

## Step 2: Deploy Backend (PHP + MySQL)

### 2.1 Sign up for Free PHP Hosting
Options:
- **InfinityFree**: https://infinityfree.net (Recommended)
- **000webhost**: https://www.000webhost.com
- **Hostinger Free**: https://www.hostinger.ph

### 2.2 Setup Database
1. Login to cPanel/Control Panel
2. Create MySQL database
3. Create database user
4. Note down:
   - Database name
   - Database user
   - Database password
   - Database host (usually localhost)

### 2.3 Import Database
1. Open phpMyAdmin
2. Select your database
3. Click "Import"
4. Upload `database_schema.sql`
5. Click "Go"

### 2.4 Upload Backend Files
1. Open File Manager or use FTP
2. Upload these folders to `public_html` or `htdocs`:
   - `api/` folder
   - `uploads/` folder
   - `vendor/` folder (if using Composer)
   - `composer.json`

### 2.5 Configure Database Connection
Edit `api/config/database.php` on the server:
```php
<?php
$host = 'localhost'; // or your DB host
$dbname = 'your_database_name';
$username = 'your_database_user';
$password = 'your_database_password';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed']));
}
?>
```

### 2.6 Set Permissions
- `uploads/` folder: 755 or 777
- `uploads/profile_pictures/` folder: 755 or 777

### 2.7 Test Backend
Visit: `https://your-backend-domain.com/api/admin/get_church_settings.php`
Should return JSON response.

---

## Step 3: Deploy Frontend (React to Vercel)

### 3.1 Sign up for Vercel
1. Go to https://vercel.com
2. Sign up with GitHub account
3. Authorize Vercel to access your repositories

### 3.2 Import Project
1. Click "Add New Project"
2. Select your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `faithtrack`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.3 Add Environment Variable
Add this environment variable in Vercel:
- **Name**: `VITE_API_URL`
- **Value**: `https://your-backend-domain.com`

### 3.4 Deploy
Click "Deploy" and wait for build to complete.

---

## Step 4: Update API URLs in Code

### 4.1 Create Environment File
Create `faithtrack/.env.production`:
```env
VITE_API_URL=https://your-backend-domain.com
```

### 4.2 Update API Helper (Optional - for better config)
The app already uses dynamic URLs based on hostname, so it should work automatically.
But you can create a config file for explicit control.

---

## Step 5: Test Everything

### 5.1 Test Checklist
- [ ] Frontend loads at Vercel URL
- [ ] Login page works
- [ ] Registration works
- [ ] Admin dashboard loads
- [ ] Member dashboard loads
- [ ] QR code scanning works
- [ ] Image uploads work
- [ ] Database queries work

### 5.2 Common Issues

**CORS Errors:**
Add to your PHP files (at the top):
```php
header('Access-Control-Allow-Origin: https://your-vercel-app.vercel.app');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

**Database Connection Failed:**
- Check database credentials in `api/config/database.php`
- Ensure database user has all privileges
- Check if remote MySQL is allowed

**Images Not Loading:**
- Check folder permissions (755 or 777)
- Verify upload path in PHP code
- Check .htaccess rules

---

## Step 6: Continuous Updates

### 6.1 Update Frontend
```cmd
cd faithtrack
# Make your changes
git add .
git commit -m "Update: description of changes"
git push
```
Vercel will auto-deploy in ~1 minute.

### 6.2 Update Backend
- Use FTP/SFTP to upload changed files
- Or use Git deployment if your host supports it
- Or use cPanel File Manager

---

## Step 7: Migrate to clcc.life (When Ready)

### 7.1 Get Access from Client
- cPanel/hosting login
- Or domain registrar access

### 7.2 Point Domain
**Option A: Move everything to their hosting**
1. Upload all files to their server
2. Import database
3. Update Vercel to use custom domain

**Option B: Keep split hosting**
1. Point clcc.life to Vercel (frontend)
2. Point api.clcc.life to your PHP hosting (backend)

### 7.3 Update DNS
In domain registrar:
- Add A record or CNAME to point to Vercel
- Add subdomain for API if needed

---

## URLs After Deployment

- **Frontend (Vercel)**: `https://your-app.vercel.app`
- **Backend (InfinityFree)**: `https://your-backend.infinityfreeapp.com`
- **Final (clcc.life)**: `https://clcc.life` (after migration)

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check PHP error logs in cPanel
3. Check Vercel deployment logs
4. Test API endpoints directly in browser

---

## Security Notes

- Never commit `api/config/database.php` with real credentials
- Use environment variables for sensitive data
- Enable HTTPS (Vercel does this automatically)
- Regularly update dependencies
- Backup database regularly
