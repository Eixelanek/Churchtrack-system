# Quick Fix Guide for Vercel Routing Issue

## Problem
`https://churchtrack-system.vercel.app/login` returns 404 error

## Solution (Do This Now)

### Step 1: Open Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Click on `churchtrack-system-v2` project

### Step 2: Change Root Directory
1. Click "Settings" tab
2. Scroll to "Root Directory" section
3. Click "Edit"
4. Type: `faithtrack`
5. Click "Save"

### Step 3: Update Build Settings
1. Still in Settings, scroll to "Build & Development Settings"
2. Click "Override" if not already enabled

3. **Build Command**: Change to
   ```
   npm install && npm run build
   ```

4. **Output Directory**: Change to
   ```
   dist
   ```

5. Click "Save"

### Step 4: Redeploy
1. Click "Deployments" tab at top
2. Find the latest deployment
3. Click the "..." menu button
4. Click "Redeploy"
5. Confirm "Redeploy"

### Step 5: Wait & Test
1. Wait 2-3 minutes for deployment
2. Open: https://churchtrack-system.vercel.app/login
3. Should now work! ✅

---

## If Still Not Working

### Alternative: Use Vercel CLI

1. Open PowerShell in your project folder:
```powershell
cd "F:\Ken\CLCC System\faithtrack"
```

2. Install Vercel CLI (if not installed):
```powershell
npm install -g vercel
```

3. Login to Vercel:
```powershell
vercel login
```

4. Deploy:
```powershell
vercel --prod
```

5. Follow the prompts:
   - Link to existing project? **Yes**
   - Select: `churchtrack-system-v2`
   - Wait for deployment

6. Test the URL it gives you

---

## What This Fixes

By setting Root Directory to `faithtrack`:
- ✅ Vercel reads `faithtrack/vercel.json` correctly
- ✅ SPA rewrites apply to all routes
- ✅ `/login`, `/register`, etc. all work
- ✅ React Router handles all navigation

---

## Current Status

- ✅ Backend API working: https://churchtrack-api.onrender.com
- ✅ Frontend homepage working: https://churchtrack-system.vercel.app
- ❌ Direct URL routing: Needs Root Directory fix
- ✅ Database connected: Aiven MySQL
- ✅ Environment variables set: VITE_API_URL

---

## After Fix Works

Test these URLs (all should work):
- https://churchtrack-system.vercel.app
- https://churchtrack-system.vercel.app/login
- https://churchtrack-system.vercel.app/register
- https://churchtrack-system.vercel.app/forgot-password
- https://churchtrack-system.vercel.app/about
- https://churchtrack-system.vercel.app/contact

Then login with:
- Username: `admin`
- Password: `admin123`

---

**Do the steps above now and let me know the result!**
