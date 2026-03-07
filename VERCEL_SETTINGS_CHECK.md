# Vercel Settings Checklist

## Current Issue
Direct URL access to `/login` returns 404 error, but navigation from homepage works.

## Settings to Verify in Vercel Dashboard

### 1. Go to Vercel Dashboard
- URL: https://vercel.com/dashboard
- Select project: `churchtrack-system-v2`

### 2. Click "Settings" Tab

### 3. Check "General" Section
Look for these settings:

#### Root Directory
- **Current**: (check what's there)
- **Should be**: Leave EMPTY or set to `faithtrack`
- **Why**: If empty, Vercel uses the root. If set to `faithtrack`, it uses that folder as root.

#### Framework Preset
- **Should be**: Vite
- **Why**: Tells Vercel how to build the project

### 4. Check "Build & Development Settings"

#### Build Command
- **Current**: `cd faithtrack && npm install && npm run build`
- **Alternative if Root Directory = faithtrack**: `npm install && npm run build`
- **Why**: Builds the React app

#### Output Directory
- **Current**: `faithtrack/dist`
- **Alternative if Root Directory = faithtrack**: `dist`
- **Why**: Where Vite outputs the built files

#### Install Command
- **Should be**: (leave default or empty)
- **Why**: Vercel auto-detects npm install

### 5. Check "Environment Variables"

Should have:
- **Name**: `VITE_API_URL`
- **Value**: `https://churchtrack-api.onrender.com`
- **Environment**: Production, Preview, Development (all checked)

---

## Two Possible Configurations

### Option A: Root Directory = EMPTY (Current Setup)
```
Root Directory: (empty)
Build Command: cd faithtrack && npm install && npm run build
Output Directory: faithtrack/dist
```

Files needed:
- ✅ `vercel.json` in root (we have this)
- ✅ `faithtrack/vercel.json` (we have this)
- ✅ `faithtrack/public/_redirects` (we have this)

### Option B: Root Directory = faithtrack (Recommended)
```
Root Directory: faithtrack
Build Command: npm install && npm run build
Output Directory: dist
```

Files needed:
- ✅ `faithtrack/vercel.json` (we have this)
- ✅ `faithtrack/public/_redirects` (we have this)
- ❌ Root `vercel.json` (not needed)

---

## Recommended Fix

### Try Option B (Simpler):

1. In Vercel Dashboard → Settings → General
2. Find "Root Directory" setting
3. Set it to: `faithtrack`
4. Click "Save"

5. Go to Settings → Build & Development Settings
6. Update Build Command to: `npm install && npm run build`
7. Update Output Directory to: `dist`
8. Click "Save"

9. Go to Deployments tab
10. Click "..." on latest deployment
11. Click "Redeploy"
12. Wait 2-3 minutes

This should fix the routing issue because:
- Vercel will treat `faithtrack` as the root
- The `faithtrack/vercel.json` will be read correctly
- The `faithtrack/public/_redirects` will work
- SPA routing will work for all URLs

---

## If Option B Doesn't Work

### Manual Deployment Test:

1. Install Vercel CLI locally:
```cmd
npm install -g vercel
```

2. Login to Vercel:
```cmd
vercel login
```

3. Deploy from faithtrack folder:
```cmd
cd faithtrack
vercel --prod
```

4. Follow prompts and test the deployment URL

---

## Verification Steps

After making changes:

1. Wait for deployment to complete (check Deployments tab)
2. Test homepage: https://churchtrack-system.vercel.app
3. Test login page: https://churchtrack-system.vercel.app/login
4. Test other routes: /register, /forgot-password, /about, /contact

All should return the React app (not 404).

---

## Current Files Status

✅ `vercel.json` (root) - Has rewrites configuration
✅ `faithtrack/vercel.json` - Has rewrites configuration  
✅ `faithtrack/public/_redirects` - Has SPA redirect rule
✅ `faithtrack/src/App.jsx` - React Router configured correctly
✅ Environment variable `VITE_API_URL` set in Vercel

---

## Next Steps

1. Check Root Directory setting in Vercel
2. If empty, set to `faithtrack` (Option B)
3. Update build commands accordingly
4. Redeploy
5. Test `/login` URL

If still not working after Option B, we may need to:
- Check Vercel deployment logs for errors
- Try Vercel CLI deployment
- Contact Vercel support

---

**Last Updated**: March 8, 2026
