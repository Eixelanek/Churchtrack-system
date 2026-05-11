const CACHE_NAME = 'faithtrack-v7';
const RUNTIME_CACHE = 'faithtrack-runtime-v7';

// Essential files to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// SPA shells (any navigation path may reload offline; fallback must match precache keys)
async function matchSpaShell() {
  return (
    (await caches.match('/index.html')) ||
    (await caches.match('/')) ||
    null
  );
}

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching essential files');
        return cache.addAll(PRECACHE_URLS).catch(err => {
          console.error('[SW] Failed to cache some files:', err);
        });
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting(); // Force activation
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete, claiming clients');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - Cache first, then network (ensures offline works)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Allow specific API calls that need to work during registration
  const allowedApiPaths = [
    '/api/members/get_all.php',
    '/api/members/check_email.php',
    '/api/members/check_username.php'
  ];
  
  const isAllowedApi = allowedApiPaths.some(path => url.pathname.includes(path));

  // Skip other API calls - let them fail naturally for offline detection
  if (url.pathname.startsWith('/api/') && !isAllowedApi) {
    console.log('[SW] Skipping API call:', url.pathname);
    return;
  }

  // For allowed API calls, use network-first strategy
  if (isAllowedApi) {
    console.log('[SW] Allowing API call:', url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch((error) => {
          console.log('[SW] API fetch failed:', url.pathname, error);
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving API from cache:', url.pathname);
                return cachedResponse;
              }
              return new Response(JSON.stringify({ error: 'Offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }

  // For navigation requests (full page reload, any route)
  if (request.method === 'GET' && request.mode === 'navigate') {
    console.log('[SW] Navigation request:', url.pathname);

    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, copy).catch(() => {});
          }
          return networkResponse;
        } catch (err) {
          console.log('[SW] Navigate network failed (offline?):', url.pathname, err?.message || err);
          let cached = await caches.match(request);
          if (cached) {
            console.log('[SW] Serving navigated URL from runtime cache');
            return cached;
          }
          cached = await matchSpaShell();
          if (cached) {
            console.log('[SW] Serving SPA shell from precache for route:', url.pathname);
            return cached;
          }
          console.log('[SW] No SPA shell in cache — first visit offline');
          return new Response(
            `<!DOCTYPE html>
                  <html lang="en">
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Offline - FaithTrack</title>
                    <style>
                      body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                        background: #f5f5f5;
                        text-align: center;
                      }
                      h1 { color: #333; margin-bottom: 10px; }
                      p { color: #666; margin-bottom: 20px; }
                      button {
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        font-size: 16px;
                        border-radius: 4px;
                        cursor: pointer;
                      }
                      button:hover { background: #45a049; }
                    </style>
                  </head>
                  <body>
                    <h1>You're Offline</h1>
                    <p>Open this site once online so it can finish installing. Then reload works offline.</p>
                    <button onclick="window.location.reload()">Retry</button>
                  </body>
                  </html>`,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            },
          );
        }
      })(),
    );
    return;
  }

  // For assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Asset from cache:', url.pathname);

          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {});

          return cachedResponse;
        }

        // Not cached, fetch from network
        console.log('[SW] Fetching asset from network:', url.pathname);
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch((error) => {
            console.log('[SW] Asset fetch failed:', url.pathname, error);
            return new Response('', { status: 404, statusText: 'Not Found' });
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendance());
  }
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

async function syncAttendance() {
  // Get pending attendance records from IndexedDB
  const db = await openDB();
  const tx = db.transaction('pendingActions', 'readonly');
  const store = tx.objectStore('pendingActions');
  const pendingActions = await store.getAll();

  // Sync each pending action
  for (const action of pendingActions) {
    try {
      await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: JSON.stringify(action.data)
      });

      // Remove from pending after successful sync
      const deleteTx = db.transaction('pendingActions', 'readwrite');
      const deleteStore = deleteTx.objectStore('pendingActions');
      await deleteStore.delete(action.id);
    } catch (error) {
      console.error('Failed to sync action:', error);
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FaithTrackDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cachedData')) {
        db.createObjectStore('cachedData', { keyPath: 'key' });
      }
    };
  });
}
