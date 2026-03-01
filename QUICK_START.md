# Quick Start - Deploy FaithTrack in 30 Minutes

## Checklist ✅

Follow these steps in order:

### Part 1: GitHub (5 minutes)

- [ ] Create GitHub account (if you don't have one): https://github.com/signup
- [ ] Create new repository: https://github.com/new
  - Name: `faithtrack-system` (or any name)
  - Private or Public: Your choice
  - Don't initialize with README
- [ ] Copy the repository URL (e.g., `https://github.com/yourusername/faithtrack-system.git`)

### Part 2: Push Code to GitHub (5 minutes)

Open terminal in your project folder and run:

```cmd
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_URL_HERE
git push -u origin main
```

Replace `YOUR_GITHUB_URL_HERE` with your actual GitHub repository URL.

### Part 3: Deploy Backend - PHP + MySQL (10 minutes)

#### Option A: InfinityFree (Recommended)

1. **Sign up**: https://infinityfree.net
   - Click "Sign Up"
   - Fill in email and password
   - Verify email

2. **Create Account**
   - Click "Create Account"
   - Choose subdomain (e.g., `faithtrack.infinityfreeapp.com`)
   - Wait for account creation (~5 minutes)

3. **Setup Database**
   - Go to Control Panel → MySQL Databases
   - Click "Create Database"
   - Note down:
     - Database name (e.g., `epiz_12345678_faithtrack`)
     - Username (e.g., `epiz_12345678`)
     - Password (you set this)
     - Host: `sql123.infinityfree.com` (or similar)

4. **Import Database**
   - Go to phpMyAdmin
   - Select your database
   - Click "Import" tab
   - Choose file: `database_schema.sql` from your project
   - Click "Go"
   - Wait for success message

5. **Upload Files**
   - Go to File Manager
   - Navigate to `htdocs` folder
   - Upload these folders/files:
     - `api/` folder (entire folder)
     - `uploads/` folder
     - `vendor/` folder (if exists)
     - `composer.json`

6. **Configure Database**
   - In File Manager, edit `htdocs/api/config/database.php`
   - Update with your database credentials:
   ```php
   private $host = "sql123.infinityfree.com";  // Your DB host
   private $db_name = "epiz_12345678_faithtrack";  // Your DB name
   private $username = "epiz_12345678";  // Your DB username
   private $password = "your_password";  // Your DB password
   ```
   - Save file

7. **Set Permissions**
   - Right-click `uploads` folder → Change Permissions → 755
   - Right-click `uploads/profile_pictures` → Change Permissions → 755

8. **Test Backend**
   - Visit: `http://faithtrack.infinityfreeapp.com/api/admin/get_church_settings.php`
   - Should see JSON response (not error)
   - If error, check database credentials

9. **Note Your Backend URL**
   - Write down: `http://faithtrack.infinityfreeapp.com`
   - You'll need this for frontend deployment

#### Option B: 000webhost

Similar steps, just use https://www.000webhost.com instead.

### Part 4: Deploy Frontend - React to Vercel (10 minutes)

1. **Sign up for Vercel**
   - Go to: https://vercel.com/signup
   - Click "Continue with GitHub"
   - Authorize Vercel

2. **Import Project**
   - Click "Add New..." → "Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Build Settings**
   - Framework Preset: `Vite`
   - Root Directory: `faithtrack`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Add Environment Variable** (IMPORTANT!)
   - Click "Environment Variables"
   - Add variable:
     - Name: `VITE_API_URL`
     - Value: `http://faithtrack.infinityfreeapp.com` (your backend URL)
   - Click "Add"

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build
   - You'll get a URL like: `https://faithtrack-system.vercel.app`

6. **Test Frontend**
   - Visit your Vercel URL
   - Try logging in
   - Check if data loads

### Part 5: Fix CORS Issues (if needed)

If you see CORS errors in browser console:

1. Go to InfinityFree File Manager
2. Edit `htdocs/api/.htaccess`
3. Update the CORS header:
```apache
Header set Access-Control-Allow-Origin "https://faithtrack-system.vercel.app"
```
Replace with your actual Vercel URL.

4. Save and test again

### Part 6: Test Everything

- [ ] Frontend loads
- [ ] Can login as admin
- [ ] Dashboard shows data
- [ ] Can add member
- [ ] Can create event
- [ ] QR code works
- [ ] Images upload

---

## Your Deployment URLs

Write them down here:

- **GitHub**: `https://github.com/___________/___________`
- **Backend**: `http://__________.infinityfreeapp.com`
- **Frontend**: `https://__________.vercel.app`

---

## Updating Your Site

### Update Frontend (React)
```cmd
cd faithtrack
# Make changes to your code
git add .
git commit -m "Updated feature X"
git push
```
Vercel auto-deploys in ~1 minute!

### Update Backend (PHP)
- Use InfinityFree File Manager
- Edit files directly
- Or upload new files via FTP

---

## Common Issues

### "Database connection failed"
- Check `api/config/database.php` credentials
- Make sure database was imported
- Check if database user has privileges

### "CORS error" in browser
- Update `api/.htaccess` with your Vercel URL
- Clear browser cache
- Try incognito mode

### "404 Not Found" for API
- Check if files uploaded to `htdocs` folder
- Check file paths are correct
- Make sure `.htaccess` exists

### Images not uploading
- Check folder permissions (755 or 777)
- Check if `uploads/` folder exists
- Check PHP upload limits in hosting

---

## Next Steps

Once everything works:

1. **Show to client** - Share your Vercel URL
2. **Get feedback** - Make improvements
3. **Request clcc.life access** - When ready to go live
4. **Migrate to production** - Follow DEPLOYMENT.md Part 7

---

## Need Help?

- Check browser console (F12) for errors
- Check Vercel deployment logs
- Check InfinityFree error logs
- Review DEPLOYMENT.md for detailed info

Good luck! 🚀
