const CACHE_NAME = 'faithtrack-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/login',
  '/member',
  '/admin',
  '/manager',
  '/checkin',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Try to cache all URLs, but don't fail if some are missing
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => console.log(`Failed to cache ${url}:`, err))
          )
        );
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - network first with timeout, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip API calls - let them fail naturally so offline logic kicks in
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      // Try network first with timeout
      Promise.race([
        fetch(request)
          .then((response) => {
            // Cache the new version
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          }),
        // Timeout after 2 seconds
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 2000)
        )
      ])
      .catch(() => {
        // Network failed or timed out, serve from cache
        console.log('Network failed for navigation, serving from cache:', url.pathname);
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('Found cached response for:', url.pathname);
            return cachedResponse;
          }
          // Try to match without query params
          const urlWithoutQuery = url.origin + url.pathname;
          return caches.match(urlWithoutQuery).then(response => {
            if (response) {
              console.log('Found cached response (without query):', urlWithoutQuery);
              return response;
            }
            // Fallback to index.html for SPA routing
            console.log('Falling back to index.html');
            return caches.match('/index.html').then(indexResponse => {
              if (indexResponse) {
                return indexResponse;
              }
              // Last resort - return offline page
              return new Response(
                '<!DOCTYPE html><html><head><title>Offline</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h1>You are offline</h1><p>Please check your internet connection and try again.</p><button onclick="window.location.reload()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Retry</button></body></html>',
                { 
                  status: 200,
                  headers: { 'Content-Type': 'text/html' } 
                }
              );
            });
          });
        });
      })
    );
    return;
  }

  // For other resources (JS, CSS, images) - cache first for speed
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version immediately
          // Update cache in background if online
          if (navigator.onLine) {
            fetch(request)
              .then((response) => {
                if (response && response.status === 200) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, response);
                  });
                }
              })
              .catch(() => {
                // Ignore fetch errors for background updates
              });
          }
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch((error) => {
            console.log('Failed to fetch resource:', url.pathname, error);
            // Return empty response for failed asset loads
            return new Response('', { status: 404 });
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
