# ServiceDesk - Progressive Web App (PWA) Implementation

## Overview

ServiceDesk is now a fully-featured Progressive Web App with offline-first capabilities, background sync, and push notifications. This document provides comprehensive information about the PWA implementation.

## Features

### 1. Offline Support
- **Cache-First Strategy**: Static assets (JS, CSS, images, fonts) are served from cache for instant loading
- **Network-First Strategy**: API data is fetched from network with cache fallback
- **Stale-While-Revalidate**: KB articles use stale data while fetching updates
- **IndexedDB Storage**: Tickets, comments, and user data cached locally for offline access
- **Offline Queue**: Actions performed offline are queued and synced when connection returns

### 2. Background Sync
- Automatic synchronization when connection is restored
- Queue system for offline actions (create ticket, add comment, update status)
- Conflict resolution for concurrent updates
- Progress tracking and error reporting
- Manual sync trigger available

### 3. Push Notifications
- Web push notifications using VAPID protocol
- Subscribe/unsubscribe functionality
- Custom notification actions (View, Dismiss)
- Badge support for notification counts
- Per-device subscription management

### 4. Install Prompt
- Custom install banner for better UX
- Platform-specific install instructions
- One-click installation
- Standalone app mode

### 5. App Shell Architecture
- Critical assets precached on install
- Fast initial load
- Smooth navigation
- Offline fallback page

## Architecture

```
ServiceDesk PWA Architecture
│
├── Service Worker (public/sw.js)
│   ├── Cache Management
│   │   ├── Static Cache (7 days)
│   │   ├── Dynamic Cache (1 day)
│   │   ├── API Cache (5 minutes)
│   │   ├── Image Cache (30 days)
│   │   └── Font Cache (90 days)
│   │
│   ├── Fetch Strategies
│   │   ├── Cache First (static assets)
│   │   ├── Network First (API)
│   │   ├── Stale While Revalidate (KB)
│   │   └── Network Only (auth)
│   │
│   ├── Background Sync
│   │   ├── Ticket Actions
│   │   ├── Comment Sync
│   │   └── Notification Sync
│   │
│   └── Push Notifications
│       ├── Push Event Handler
│       ├── Notification Click Handler
│       └── Periodic Sync (if supported)
│
├── Offline Manager (lib/pwa/offline-manager.ts)
│   ├── IndexedDB Wrapper
│   │   ├── Tickets Store
│   │   ├── Comments Store
│   │   ├── Offline Actions Store
│   │   ├── Cache Metadata Store
│   │   ├── KB Articles Store
│   │   └── Notifications Store
│   │
│   ├── Queue Management
│   │   ├── Add Actions
│   │   ├── Get Pending
│   │   ├── Update Status
│   │   └── Remove Completed
│   │
│   └── Storage Quota
│       ├── Check Usage
│       ├── Clean Expired
│       └── Warning Threshold
│
├── Sync Manager (lib/pwa/sync-manager.ts)
│   ├── Sync Controller
│   │   ├── Sync All
│   │   ├── Sync by Type
│   │   ├── Force Sync
│   │   └── Get Status
│   │
│   ├── Event System
│   │   ├── Sync Started
│   │   ├── Sync Progress
│   │   ├── Sync Completed
│   │   └── Sync Error
│   │
│   └── Background Sync Registration
│       ├── Standard Sync
│       └── Periodic Sync
│
├── Push Manager (lib/pwa/push-notifications.ts)
│   ├── Subscription Management
│   │   ├── Request Permission
│   │   ├── Subscribe
│   │   ├── Unsubscribe
│   │   └── Get Status
│   │
│   └── VAPID Keys (lib/pwa/vapid-manager.ts)
│       ├── Generate Keys
│       ├── Store Keys
│       ├── Create Auth Header
│       └── Validate Config
│
├── UI Components (components/pwa/)
│   ├── PWAProvider.tsx (main provider)
│   ├── PWAInstallBanner.tsx
│   ├── PWAOfflineIndicator.tsx
│   ├── PWASyncIndicator.tsx
│   └── PWAUpdateBanner.tsx
│
└── API Routes (app/api/pwa/)
    ├── /vapid-key (GET - public VAPID key)
    ├── /subscribe (POST/GET/DELETE - push subscriptions)
    ├── /sync (POST/GET - offline sync)
    └── /status (GET - PWA capabilities)
```

## Setup & Configuration

### 1. Environment Variables

Add to your `.env` file:

```bash
# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=<generated-public-key>
VAPID_PRIVATE_KEY=<generated-private-key>

# PWA Configuration
PWA_NAME="ServiceDesk Pro"
PWA_SHORT_NAME="ServiceDesk"
PWA_THEME_COLOR="#2563eb"
PWA_BACKGROUND_COLOR="#ffffff"
```

**Generating VAPID Keys:**

The system will auto-generate VAPID keys on first run and log them to console in development mode. Copy these values to your `.env` file.

Alternatively, use the web-push CLI:

```bash
npx web-push generate-vapid-keys
```

### 2. Database Migration

Run the migration to create push subscription tables:

```bash
npm run migrate:run
```

This creates:
- `push_subscriptions` table for storing user push subscriptions
- `sync_queue` table for offline action queue

### 3. Service Worker Registration

The service worker is automatically registered in the app. No manual registration needed.

File: `public/sw.js` (already configured)

### 4. Manifest Configuration

File: `public/manifest.json` (already configured)

Key features:
- Standalone display mode
- Start URL with PWA tracking
- Custom icons (192x192, 512x512)
- Shortcuts (Create Ticket, My Tickets, Dashboard, KB)
- Share target support
- File handlers for PDF, CSV, Excel, Images

## Usage

### For Developers

#### 1. Queue Offline Actions

```typescript
import { offlineHelpers } from '@/lib/pwa/offline-manager';

// Queue ticket creation for offline sync
await offlineHelpers.createTicketOffline({
  title: 'Bug Report',
  description: 'Application crashes on login',
  priority: 'high',
  category_id: 1
});

// Queue comment addition
await offlineHelpers.addCommentOffline('ticket-123', {
  content: 'Added more details',
  isInternal: false
});
```

#### 2. Trigger Manual Sync

```typescript
import { syncManager } from '@/lib/pwa/sync-manager';

// Sync all pending actions
await syncManager.syncAll();

// Get sync status
const status = await syncManager.getStatus();
console.log(`Pending: ${status.pendingCount}`);
```

#### 3. Subscribe to Push Notifications

```typescript
import { pushNotificationManager } from '@/lib/pwa/push-notifications';

// Request permission
const granted = await pushNotificationManager.requestPermission();

if (granted) {
  // Subscribe
  const subscription = await pushNotificationManager.subscribe(vapidPublicKey);

  // Send to server
  await fetch('/api/pwa/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ subscription })
  });
}
```

#### 4. Listen to Sync Events

```typescript
import { syncManager } from '@/lib/pwa/sync-manager';

// Listen for sync completion
const unsubscribe = syncManager.on('sync-completed', (event) => {
  console.log(`Synced ${event.progress?.completed} items`);
});

// Clean up listener
unsubscribe();
```

#### 5. Cache Data for Offline

```typescript
import { offlineManager } from '@/lib/pwa/offline-manager';

// Cache ticket for offline access
await offlineManager.cacheTicket(ticket);

// Cache KB article
await offlineManager.cacheKBArticle(article);

// Search cached KB
const results = await offlineManager.searchCachedKB('password reset');
```

### For Users

#### Installing the App

1. **Desktop (Chrome/Edge)**
   - Click the install icon in the address bar
   - Or use the custom install banner
   - Click "Install"

2. **Mobile (Chrome Android)**
   - Tap "Add to Home Screen" from browser menu
   - Confirm installation

3. **iOS Safari**
   - Tap Share button
   - Select "Add to Home Screen"
   - Name the app and tap "Add"

#### Using Offline

1. **View Cached Tickets**
   - Open the app while offline
   - Previously loaded tickets are available
   - Use search to find cached tickets

2. **Create Tickets Offline**
   - Fill out the ticket form as normal
   - Click "Create"
   - Ticket is queued for sync
   - Syncs automatically when online

3. **Add Comments Offline**
   - Write comments as usual
   - They're queued for sync
   - Status indicator shows pending state

4. **Sync Status**
   - Check sync indicator in header
   - Shows pending actions count
   - Click to manually trigger sync

## Offline Capabilities

### What Works Offline

✅ View cached tickets
✅ View ticket details (if previously loaded)
✅ Create new tickets (queued for sync)
✅ Add comments (queued for sync)
✅ Search knowledge base (cached articles)
✅ View user profile
✅ Access settings
✅ Navigate between pages
✅ View notifications (cached)

### What Requires Connection

❌ Real-time updates
❌ File uploads
❌ User authentication (initial login)
❌ Admin operations
❌ Fetching new data
❌ Push notifications
❌ Video/large media

## Cache Strategy Details

### Static Assets (Cache First)
- **Files**: JS, CSS, images, fonts
- **Duration**: 7-90 days depending on type
- **Strategy**: Serve from cache, update in background
- **Fallback**: Network if not in cache

### API Data (Network First)
- **Endpoints**: `/api/tickets`, `/api/notifications`, etc.
- **Duration**: 5 minutes
- **Strategy**: Try network first, fall back to cache
- **Fallback**: Cached data with offline indicator

### Knowledge Base (Stale While Revalidate)
- **Endpoints**: `/api/kb/*`
- **Duration**: 1 day
- **Strategy**: Serve stale cache while fetching fresh data
- **Fallback**: Stale cache if network fails

### Authentication (Network Only)
- **Endpoints**: `/api/auth/*`
- **Duration**: No cache
- **Strategy**: Always use network
- **Fallback**: Error response

## Background Sync

### How It Works

1. **Offline Action**: User creates ticket while offline
2. **Queue**: Action saved to IndexedDB sync queue
3. **Registration**: Background sync registered with browser
4. **Sync Trigger**: Browser triggers sync when online
5. **Process**: Service worker processes queue
6. **Cleanup**: Successful actions removed from queue

### Sync Tags

- `sync-actions`: General offline actions
- `sync-tickets`: Ticket-specific sync
- `sync-comments`: Comment-specific sync

### Conflict Resolution

When the same resource is modified offline and online:

1. Server checks `lastKnownUpdate` timestamp
2. If server version is newer, conflict detected
3. Conflict data returned to client
4. User prompted to resolve (keep local/server/merge)

## Push Notifications

### Setup Flow

1. User grants notification permission
2. App requests VAPID public key from `/api/pwa/vapid-key`
3. Browser creates push subscription with VAPID key
4. Subscription sent to `/api/pwa/subscribe`
5. Server stores subscription in database
6. Server can now send notifications to this device

### Sending Notifications

```typescript
// Server-side (example)
import webpush from 'web-push';
import { getVapidKeys } from '@/lib/pwa/vapid-manager';

const { publicKey, privateKey } = getVapidKeys();

webpush.setVapidDetails(
  'mailto:support@servicedesk.com',
  publicKey,
  privateKey
);

const subscription = /* get from database */;

await webpush.sendNotification(subscription, JSON.stringify({
  title: 'New Ticket Assigned',
  body: 'Ticket #123 has been assigned to you',
  icon: '/icon-192.png',
  badge: '/icons/badge-72.png',
  data: {
    url: '/tickets/123',
    ticketId: 123
  },
  actions: [
    { action: 'view', title: 'View Ticket' },
    { action: 'dismiss', title: 'Dismiss' }
  ]
}));
```

### Notification Actions

- **View**: Opens the related ticket/resource
- **Dismiss**: Closes the notification

## Storage Management

### IndexedDB Stores

| Store | Purpose | Key | Indexes |
|-------|---------|-----|---------|
| tickets | Cached tickets | id | status, priority, timestamp |
| comments | Cached comments | id | ticketId, timestamp |
| offlineActions | Sync queue | id (auto) | status, timestamp, type |
| cacheMetadata | Cache info | url | expiresAt |
| kbArticles | KB cache | id | category, timestamp |
| notifications | Cached notifications | id | read, timestamp |
| userPreferences | User settings | key | - |

### Storage Quota

- **Max Total**: 50MB
- **Max Per Store**: 10MB
- **Warning Threshold**: 80% usage
- **Auto Cleanup**: Removes expired cache metadata

Check storage usage:

```typescript
import { offlineManager } from '@/lib/pwa/offline-manager';

const quota = await offlineManager.getStorageQuota();
console.log(`Using ${quota.percentage}% of storage`);

if (await offlineManager.isStorageNearLimit()) {
  console.warn('Storage nearing limit!');
}
```

## Performance Optimizations

1. **Precaching**: Critical assets cached on install
2. **Lazy Caching**: Non-critical assets cached on first use
3. **Cache Limits**: Old entries removed when limit reached
4. **Compression**: Gzip enabled for all text assets
5. **Code Splitting**: Separate chunks for heavy features
6. **Image Optimization**: WebP/AVIF with fallbacks
7. **Font Subsetting**: Only used glyphs cached

## Testing

### Test Offline Functionality

1. **Chrome DevTools**
   - Open DevTools
   - Go to Application > Service Workers
   - Check "Offline" checkbox
   - Refresh page

2. **Network Throttling**
   - Open DevTools
   - Go to Network tab
   - Select "Slow 3G" or "Offline"

3. **PWA Audit**
   ```bash
   npm run lighthouse
   ```

### Test Push Notifications

1. **Grant Permission**: Allow notifications in browser
2. **Subscribe**: Use app's notification settings
3. **Test Send**: Use browser DevTools > Application > Push
4. **Check**: Notification should appear

### Test Background Sync

1. **Go Offline**: Disconnect internet
2. **Create Ticket**: Fill form and submit
3. **Check Queue**: Verify ticket in sync queue
4. **Go Online**: Reconnect internet
5. **Verify Sync**: Ticket should sync automatically

## Troubleshooting

### Service Worker Not Updating

```javascript
// Clear old service workers
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});

// Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
location.reload(true);
```

### Push Notifications Not Working

1. Check browser support: `'PushManager' in window`
2. Verify VAPID keys are set
3. Check notification permission: `Notification.permission`
4. Verify subscription in database
5. Check server VAPID configuration

### Offline Data Not Syncing

1. Check network connectivity
2. Verify auth token is valid
3. Check sync queue: `offlineManager.getPendingActions()`
4. Check browser console for errors
5. Try manual sync: `syncManager.forceSync()`

### Cache Not Working

1. Verify service worker is active
2. Check cache storage in DevTools
3. Clear cache and refresh
4. Check service worker logs
5. Verify fetch event handlers

## API Reference

### Offline Manager

```typescript
// Add item to store
await offlineManager.add('tickets', ticket);

// Update item
await offlineManager.update('tickets', updatedTicket);

// Get item
const ticket = await offlineManager.get('tickets', ticketId);

// Get all items
const tickets = await offlineManager.getAll('tickets');

// Get by index
const highPriority = await offlineManager.getByIndex(
  'tickets',
  'priority',
  'high'
);

// Delete item
await offlineManager.delete('tickets', ticketId);

// Clear store
await offlineManager.clear('tickets');

// Queue action
await offlineManager.queueAction({
  type: 'CREATE_TICKET',
  endpoint: '/api/tickets',
  method: 'POST',
  data: ticketData,
  maxRetries: 3
});

// Get statistics
const stats = await offlineManager.getStatistics();
```

### Sync Manager

```typescript
// Sync all
await syncManager.syncAll();

// Get status
const status = await syncManager.getStatus();

// Register background sync
await syncManager.registerBackgroundSync();

// Listen to events
const unsub = syncManager.on('sync-completed', (event) => {
  console.log('Sync done!');
});

// Force sync
await syncManager.forceSync();

// Clear errors
syncManager.clearErrors();
```

## Best Practices

1. **Always Check Online Status**: Use `navigator.onLine` before network requests
2. **Queue Offline Actions**: Don't show errors, queue for later
3. **Show Offline Indicator**: Make offline state clear to users
4. **Cache Strategically**: Don't cache everything, be selective
5. **Handle Conflicts**: Implement conflict resolution for concurrent edits
6. **Monitor Storage**: Check quota regularly and clean up
7. **Test Offline**: Test all features in offline mode
8. **Progressive Enhancement**: App should work without PWA features
9. **Update Gracefully**: Prompt users for updates, don't force
10. **Secure VAPID Keys**: Never expose private key to client

## Browser Support

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Service Workers | ✅ | ✅ | ✅ | ✅ (11.1+) |
| Background Sync | ✅ | ✅ | ❌ | ❌ |
| Push Notifications | ✅ | ✅ | ✅ | ✅ (16.4+) |
| Periodic Sync | ✅ | ✅ | ❌ | ❌ |
| Install Prompt | ✅ | ✅ | ❌ | ✅ (Add to Home) |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |

## Resources

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/rfc8292)

## License

This PWA implementation is part of ServiceDesk Pro and follows the same license.

## Support

For issues or questions about PWA features:
- Check this documentation
- Review browser console for errors
- Test in Chrome DevTools offline mode
- Check GitHub issues
- Contact support team
