# Netlify build settings

Kung **naka-localhost pa rin** ang app sa live site, malamang **mali ang build config** sa Netlify kaya hindi na-deploy ang bagong code.

## Dapat naka-set sa Netlify

Sa **Site configuration** → **Build & deploy** → **Build settings**:

| Setting | Value |
|--------|--------|
| **Base directory** | `faithtrack` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |

O kung gusto mong mag-build mula sa **root**:

| Setting | Value |
|--------|--------|
| **Base directory** | *(iwanang blank)* |
| **Build command** | `npm run build` |
| **Publish directory** | `faithtrack/dist` |

## Pagkatapos baguhin

1. **Trigger deploy** → **Clear cache and deploy site**
2. Hintayin hanggang **Published**
3. Sa browser: **Ctrl+Shift+R** (hard refresh)

Kung tama ang deploy, sa Console makikita: `API Base URL: https://churchtrack-api.onrender.com` at ang JS file ay **hindi** na `index-BnUNkoRX.js` (mag-iiba ang hash).
