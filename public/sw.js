// ServiceDesk Pro - Advanced Service Worker v2.0.0
// Implements comprehensive offline-first strategy with intelligent caching and background sync

const VERSION = '2.0.0';
const CACHE_NAME = `servicedesk-v${VERSION}`;
const STATIC_CACHE = `servicedesk-static-v${VERSION}`;
const DYNAMIC_CACHE = `servicedesk-dynamic-v${VERSION}`;
const API_CACHE = `servicedesk-api-v${VERSION}`;
const IMAGE_CACHE = `servicedesk-images-v${VERSION}`;
const OFFLINE_CACHE = `servicedesk-offline-v${VERSION}`;
const FONT_CACHE = `servicedesk-fonts-v${VERSION}`;

// Cache duration configurations (in milliseconds)
const CACHE_DURATIONS = {
  static: 7 * 24 * 60 * 60 * 1000,     // 7 days
  dynamic: 24 * 60 * 60 * 1000,        // 1 day
  api: 5 * 60 * 1000,                  // 5 minutes
  images: 30 * 24 * 60 * 60 * 1000,    // 30 days
  fonts: 90 * 24 * 60 * 60 * 1000,     // 90 days
  offline: Infinity,                    // Never expire
};

// Cache size limits
const CACHE_LIMITS = {
  static: 50,
  dynamic: 100,
  api: 50,
  images: 200,
  fonts: 20,
};

// Performance monitoring
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  backgroundSyncs: 0,
};

// Static resources to cache on install
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
  '/site.webmanifest',
  '/offline.html',
];

// Critical routes that should work offline
const CRITICAL_ROUTES = [
  '/',
  '/dashboard',
  '/tickets',
  '/tickets/new',
  '/profile',
  '/offline.html',
];

// Font patterns
const FONT_PATTERNS = [
  /https:\/\/fonts\.googleapis\.com\/.*/,
  /https:\/\/fonts\.gstatic\.com\/.*/,
  /.*\.(woff|woff2|ttf|eot)$/,
];

// API endpoints to cache
const API_PATTERNS = [
  /^\/api\/auth\/verify$/,
  /^\/api\/notifications\/unread$/,
  /^\/api\/tickets(\?.*)?$/,
  /^\/api\/tickets\/[^\/]+$/,
  /^\/api\/categories$/,
  /^\/api\/priorities$/,
  /^\/api\/statuses$/,
  /^\/api\/agents$/,
  /^\/api\/knowledge\/.*/,
  /^\/api\/user$/,
];

// API endpoints that should NOT be cached
const NO_CACHE_API_PATTERNS = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/tickets\/[^\/]+\/comments$/,
  /^\/api\/tickets\/create$/,
  /^\/api\/files\/upload$/,
  /^\/api\/notifications$/,
];

// Background sync tags
const SYNC_TAGS = {
  TICKETS: 'tickets-sync',
  COMMENTS: 'comments-sync',
  NOTIFICATIONS: 'notifications-sync',
  ATTACHMENTS: 'attachments-sync',
};

// Dynamic routes to cache
const DYNAMIC_PATTERNS = [
  /^\/tickets/,
  /^\/dashboard/,
  /^\/knowledge-base/,
  /^\/admin/,
];

// Background sync queue
let syncQueue = [];

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing ServiceWorker v1.0.0');

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),

      // Initialize IndexedDB for offline data
      initializeOfflineStorage(),

      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating ServiceWorker v1.0.0');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('servicedesk-') &&
                     cacheName !== CACHE_NAME &&
                     cacheName !== STATIC_CACHE &&
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== API_CACHE &&
                     cacheName !== IMAGE_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),

      // Take control of all pages
      self.clients.claim()
    ])
  );
});

// Fetch event - Implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests with appropriate strategies
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isFontRequest(url)) {
    event.respondWith(handleFontRequest(request));
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request));
  } else if (isDynamicRoute(url)) {
    event.respondWith(handleDynamicRoute(request));
  } else {
    event.respondWith(handleGenericRequest(request));
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'ticket-sync') {
    event.waitUntil(syncTicketActions());
  } else if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    image: data.image,
    data: data.data,
    tag: data.tag || 'servicedesk-notification',
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200],
    actions: data.actions || [
      {
        action: 'view',
        title: 'Ver Ticket',
        icon: '/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Dispensar',
        icon: '/icons/action-dismiss.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'view' && data && data.ticketId) {
    event.waitUntil(
      clients.openWindow(`/tickets/${data.ticketId}`)
    );
  } else if (action === 'dismiss') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

// Message event - Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_API_RESPONSE') {
    cacheAPIResponse(event.data.url, event.data.response);
  } else if (event.data && event.data.type === 'QUEUE_OFFLINE_ACTION') {
    queueOfflineAction(event.data.action);
  }
});

// Helper functions

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.json') ||
         url.pathname.endsWith('.xml') ||
         STATIC_ASSETS.includes(url.pathname);
}

function isFontRequest(url) {
  return FONT_PATTERNS.some(pattern => pattern.test(url.href));
}

function shouldCacheAPI(url) {
  // Check if it's explicitly excluded
  if (NO_CACHE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return false;
  }
  // Check if it matches cacheable patterns
  return API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') ||
         API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isImageRequest(url) {
  return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);
}

function isDynamicRoute(url) {
  return DYNAMIC_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Cache-first strategy for static assets
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.static)) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Static asset fetch failed:', error);
    const cache = await caches.open(STATIC_CACHE);
    return cache.match(request) || createOfflineResponse();
  }
}

// Cache-first strategy for fonts with very long expiration
async function handleFontRequest(request) {
  try {
    const cache = await caches.open(FONT_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.fonts)) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }

    performanceMetrics.networkRequests++;
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clean cache if it's getting too large
      await cleanCache(FONT_CACHE, CACHE_LIMITS.fonts);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Font fetch failed:', error);
    const cache = await caches.open(FONT_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
    throw error;
  }
}

// Enhanced network-first strategy for API requests with intelligent caching
async function handleAPIRequest(request) {
  const url = new URL(request.url);

  // Skip caching for excluded endpoints
  if (!shouldCacheAPI(url)) {
    try {
      performanceMetrics.networkRequests++;
      return await fetch(request);
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Network unavailable',
        offline: true
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503
      });
    }
  }

  const cache = await caches.open(API_CACHE);

  try {
    performanceMetrics.networkRequests++;
    const networkResponse = await fetch(request, {
      headers: {
        ...request.headers,
        'X-SW-Fetch': 'true',
        'X-SW-Version': VERSION
      }
    });

    if (networkResponse.ok) {
      // Clean cache if it's getting too large
      await cleanCache(API_CACHE, CACHE_LIMITS.api);

      // Cache successful responses with metadata
      const responseToCache = networkResponse.clone();
      responseToCache.headers.append('X-SW-Cached', new Date().toISOString());
      cache.put(request, responseToCache);

      // Broadcast update to clients
      broadcastCacheUpdate(request.url, 'network');
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, checking cache for:', request.url);
    performanceMetrics.cacheMisses++;

    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.api)) {
      // Broadcast that we're serving from cache
      broadcastCacheUpdate(request.url, 'cache');
      performanceMetrics.cacheHits++;

      // Add offline indicator to response
      const response = cachedResponse.clone();
      response.headers.append('X-SW-Offline', 'true');
      return response;
    }

    // Return specialized offline responses for different endpoints
    return createOfflineAPIResponse(request.url);
  }
}

// Cache-first strategy for images with long expiration
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.images)) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Image fetch failed:', error);
    const cache = await caches.open(IMAGE_CACHE);
    return cache.match(request) || createPlaceholderImage();
  }
}

// Stale-while-revalidate for dynamic routes
async function handleDynamicRoute(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  // Serve from cache immediately if available
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // If network fails, return cached version or offline page
    return cachedResponse || createOfflineResponse();
  });

  if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.dynamic)) {
    // Return cached version immediately, update in background
    fetchPromise.catch(() => {});
    return cachedResponse;
  }

  return fetchPromise;
}

// Generic request handler
async function handleGenericRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('[SW] Generic request failed:', error);
    return createOfflineResponse();
  }
}

// Utility functions
function isExpired(response, maxAge) {
  const responseDate = new Date(response.headers.get('date') || Date.now());
  return Date.now() - responseDate.getTime() > maxAge;
}

function createOfflineResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ServiceDesk - Offline</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: system-ui, sans-serif;
          text-align: center;
          padding: 2rem;
          background: #f8fafc;
          color: #374151;
        }
        .offline-container {
          max-width: 400px;
          margin: 0 auto;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .offline-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1rem;
          background: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
        }
        .retry-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">⚡</div>
        <h1>Você está offline</h1>
        <p>Verifique sua conexão com a internet e tente novamente.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Tentar Novamente
        </button>
      </div>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

function createPlaceholderImage() {
  // Return a simple 1x1 gray pixel as base64
  const grayPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return fetch(grayPixel);
}

// Cache management utility
async function cleanCache(cacheName, limit) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length > limit) {
      // Remove oldest entries (FIFO)
      const keysToDelete = keys.slice(0, keys.length - limit);
      await Promise.all(keysToDelete.map(key => cache.delete(key)));
      console.log(`[SW] Cleaned ${keysToDelete.length} entries from ${cacheName}`);
    }
  } catch (error) {
    console.error(`[SW] Cache cleanup failed for ${cacheName}:`, error);
  }
}

// Create specialized offline API responses
function createOfflineAPIResponse(url) {
  if (url.includes('/api/auth/verify')) {
    return new Response(JSON.stringify({
      user: null,
      offline: true,
      message: 'Authentication check unavailable offline'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }

  if (url.includes('/api/tickets')) {
    return new Response(JSON.stringify({
      tickets: [],
      offline: true,
      message: 'Tickets will be loaded when connection is restored',
      cached: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }

  if (url.includes('/api/notifications')) {
    return new Response(JSON.stringify({
      notifications: [],
      unread: 0,
      offline: true,
      message: 'Notifications unavailable offline'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Generic offline response
  return new Response(JSON.stringify({
    error: 'Service unavailable offline',
    offline: true,
    message: 'This feature requires an internet connection'
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 503
  });
}

// Performance metrics reporting
function reportPerformanceMetrics() {
  const metrics = {
    ...performanceMetrics,
    timestamp: Date.now(),
    version: VERSION
  };

  // Broadcast metrics to clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PERFORMANCE_METRICS',
        metrics
      });
    });
  });
}

// Background sync functions
async function syncTicketActions() {
  console.log('[SW] Syncing offline ticket actions');

  const db = await openIndexedDB();
  const transaction = db.transaction(['offlineActions'], 'readonly');
  const store = transaction.objectStore('offlineActions');
  const actions = await getAllFromStore(store);

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body
      });

      if (response.ok) {
        // Remove successful action from queue
        const deleteTransaction = db.transaction(['offlineActions'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('offlineActions');
        await deleteStore.delete(action.id);

        // Notify clients about successful sync
        broadcastSyncSuccess(action);
      }
    } catch (error) {
      console.error('[SW] Failed to sync action:', action, error);
    }
  }
}

async function syncNotifications() {
  console.log('[SW] Syncing notifications');

  try {
    const response = await fetch('/api/notifications/unread');
    if (response.ok) {
      const notifications = await response.json();
      // Broadcast new notifications to clients
      broadcastNotifications(notifications);
    }
  } catch (error) {
    console.error('[SW] Failed to sync notifications:', error);
  }
}

// IndexedDB helper functions
async function initializeOfflineStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServiceDeskDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('offlineActions')) {
        const store = db.createObjectStore('offlineActions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
      }

      if (!db.objectStoreNames.contains('cacheMetadata')) {
        db.createObjectStore('cacheMetadata', { keyPath: 'url' });
      }
    };
  });
}

async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServiceDeskDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Communication with main thread
function broadcastCacheUpdate(url, source) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'CACHE_UPDATE',
        url,
        source
      });
    });
  });
}

function broadcastSyncSuccess(action) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_SUCCESS',
        action
      });
    });
  });
}

function broadcastNotifications(notifications) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATIONS_UPDATE',
        notifications
      });
    });
  });
}

async function queueOfflineAction(action) {
  const db = await openIndexedDB();
  const transaction = db.transaction(['offlineActions'], 'readwrite');
  const store = transaction.objectStore('offlineActions');

  await store.add({
    ...action,
    timestamp: Date.now(),
    id: undefined // Let autoIncrement handle this
  });

  // Register background sync
  if (self.registration.sync) {
    await self.registration.sync.register('ticket-sync');
  }
}

async function cacheAPIResponse(url, response) {
  const cache = await caches.open(API_CACHE);
  const responseClone = new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=300'
    }
  });

  await cache.put(url, responseClone);
}

// Periodic performance reporting (every 5 minutes)
setInterval(() => {
  reportPerformanceMetrics();
}, 5 * 60 * 1000);

console.log(`[SW] ServiceDesk Service Worker v${VERSION} loaded successfully`);