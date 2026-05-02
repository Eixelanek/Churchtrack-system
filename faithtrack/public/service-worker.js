const CACHE_NAME = 'faithtrack-v6';
const RUNTIME_CACHE = 'faithtrack-runtime-v6';

// Essential files to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

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

  // Skip API calls - let them fail naturally for offline detection
  if (url.pathname.startsWith('/api/')) {
    console.log('[SW] Skipping API call:', url.pathname);
    return;
  }

  // For navigation requests (pages)
  if (request.mode === 'navigate') {
    console.log('[SW] Navigation request:', url.pathname);
    
    event.respondWith(
      // Try cache first for instant offline support
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            
            // Update cache in background if online
            if (navigator.onLine) {
              fetch(request)
                .then((networkResponse) => {
                  if (networkResponse && networkResponse.status === 200) {
                    caches.open(RUNTIME_CACHE).then((cache) => {
                      cache.put(request, networkResponse);
                    });
                  }
                })
                .catch(() => console.log('[SW] Background update failed'));
            }
            
            return cachedResponse;
          }

          // Not in cache, try network with timeout
          console.log('[SW] Not in cache, trying network:', url.pathname);
          return Promise.race([
            fetch(request)
              .then((response) => {
                if (response && response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(RUNTIME_CACHE).then((cache) => {
                    cache.put(request, responseClone);
                  });
                }
                return response;
              }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Network timeout')), 3000)
            )
          ])
          .catch(() => {
            // Network failed, serve index.html for SPA routing
            console.log('[SW] Network failed, serving index.html');
            return caches.match('/index.html')
              .then((indexResponse) => {
                if (indexResponse) {
                  return indexResponse;
                }
                // Last resort - basic offline page
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
                    <p>Please check your internet connection and try again.</p>
                    <button onclick="window.location.reload()">Retry</button>
                  </body>
                  </html>`,
                  {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                  }
                );
              });
          });
        })
    );
    return;
  }

  // For assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Asset from cache:', url.pathname);
          
          // Update in background if online
          if (navigator.onLine) {
            fetch(request)
              .then((response) => {
                if (response && response.status === 200) {
                  caches.open(RUNTIME_CACHE).then((cache) => {
                    cache.put(request, response);
                  });
                }
              })
              .catch(() => {});
          }
          
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
