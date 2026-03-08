# Vercel Redeployment Instructions

## Problem
Vercel is aggressively caching the old build and won't serve the new code even after multiple deployments.

## Solution: Create a NEW Vercel Project

### Step 1: Delete the Old Project (Optional but Recommended)
1. Go to https://vercel.com/eixelaneks-projects
2. Find the "faithtrack" project
3. Click Settings → Delete Project

### Step 2: Create a New Project
1. Go to https://vercel.com/new
2. Import from GitHub: `Eixelanek/Churchtrack-system`
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `faithtrack`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. Environment Variables (if needed):
   - `VITE_API_URL` = `https://churchtrack-api.onrender.com`

5. Click "Deploy"

### Step 3: Test the New Deployment
1. Wait for deployment to complete (1-2 minutes)
2. Open the new URL in INCOGNITO mode
3. Try logging in with:
   - Username: `admin`
   - Password: `admin123`

## Why This Works
- New project = no cached builds
- Fresh CDN distribution
- Clean slate for all assets

## Current Code Status
✅ All API calls are using the centralized config
✅ API_BASE_URL = 'https://churchtrack-api.onrender.com'
✅ Local build is correct
❌ Vercel is serving old cached version

The code is CORRECT - we just need Vercel to serve the NEW build!
