# ServiceDesk PWA - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites

- Node.js 18+ installed
- ServiceDesk application running
- HTTPS enabled (required for PWA features)

### Step 1: Generate VAPID Keys

Run the application in development mode:

```bash
npm run dev
```

The system will auto-generate VAPID keys and display them in the console:

```
=== VAPID Keys Generated ===
Add these to your .env file:
VAPID_PUBLIC_KEY=BG7x...
VAPID_PRIVATE_KEY=abc123...
============================
```

### Step 2: Configure Environment

Create/update `.env` file:

```bash
# Copy the generated keys
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>

# PWA Settings (optional)
PWA_NAME="ServiceDesk Pro"
PWA_SHORT_NAME="ServiceDesk"
```

### Step 3: Run Database Migration

```bash
npm run migrate:run
```

This creates the required tables:
- `push_subscriptions` - for push notification subscriptions
- `sync_queue` - for offline action queue

### Step 4: Build & Start

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

### Step 5: Test PWA Features

#### Test Installation

1. Open app in Chrome/Edge
2. Look for install icon in address bar
3. Click to install
4. App opens in standalone window

#### Test Offline Mode

1. Open Chrome DevTools (F12)
2. Go to Application > Service Workers
3. Check "Offline" checkbox
4. Navigate the app (cached pages work!)
5. Create a ticket (queued for sync)
6. Uncheck "Offline"
7. Ticket syncs automatically

#### Test Push Notifications

1. Click notification bell in app
2. Click "Enable Notifications"
3. Grant permission when prompted
4. Test notification:
   ```bash
   # In browser console
   navigator.serviceWorker.ready.then(reg => {
     reg.showNotification('Test', {
       body: 'PWA notifications work!',
       icon: '/icon-192.png'
     });
   });
   ```

## 📱 Mobile Installation

### Android (Chrome)

1. Open app in Chrome
2. Tap menu (⋮)
3. Select "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen

### iOS (Safari)

1. Open app in Safari
2. Tap Share button (□↑)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen

## 🔧 Quick Configuration

### Customize App Name

Edit `public/manifest.json`:

```json
{
  "name": "Your Company ServiceDesk",
  "short_name": "ServiceDesk"
}
```

### Change Theme Color

Edit `public/manifest.json`:

```json
{
  "theme_color": "#your-color",
  "background_color": "#your-bg-color"
}
```

### Update Icons

Replace these files in `public/`:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `apple-touch-icon.png` (180x180)

### Configure Cache Duration

Edit `public/sw.js`:

```javascript
const CACHE_DURATIONS = {
  static: 7 * 24 * 60 * 60 * 1000,     // 7 days
  dynamic: 24 * 60 * 60 * 1000,        // 1 day
  api: 5 * 60 * 1000,                  // 5 minutes
  images: 30 * 24 * 60 * 60 * 1000,    // 30 days
  fonts: 90 * 24 * 60 * 60 * 1000,     // 90 days
};
```

## 🎯 Common Use Cases

### Enable Offline Ticket Creation

Already enabled! Users can:
1. Create tickets offline
2. Tickets queue automatically
3. Sync when online

### Cache Knowledge Base Articles

```typescript
import { offlineManager } from '@/lib/pwa/offline-manager';

// Cache article for offline access
await offlineManager.cacheKBArticle({
  id: '123',
  title: 'How to Reset Password',
  content: '...',
  category: 'authentication'
});

// Search cached articles
const results = await offlineManager.searchCachedKB('password');
```

### Send Push Notification

```typescript
// Backend code
import webpush from 'web-push';
import { getVapidKeys } from '@/lib/pwa/vapid-manager';

const vapid = getVapidKeys();

webpush.setVapidDetails(
  'mailto:admin@servicedesk.com',
  vapid.publicKey,
  vapid.privateKey
);

// Get user's subscription from database
const subscription = await getUserPushSubscription(userId);

// Send notification
await webpush.sendNotification(
  subscription,
  JSON.stringify({
    title: 'New Ticket Assigned',
    body: 'Ticket #123 needs your attention',
    icon: '/icon-192.png',
    data: { ticketId: 123, url: '/tickets/123' }
  })
);
```

### Monitor Sync Status

```typescript
import { syncManager } from '@/lib/pwa/sync-manager';

// Get current status
const status = await syncManager.getStatus();

console.log(`
  Syncing: ${status.isSyncing}
  Pending: ${status.pendingCount}
  Last Sync: ${new Date(status.lastSyncTime)}
`);

// Listen for sync events
syncManager.on('sync-completed', (event) => {
  console.log(`Synced ${event.progress.completed} items`);
});
```

## ⚡ Performance Tips

1. **Precache Critical Pages**: Add frequently visited pages to static cache
2. **Lazy Load Images**: Use `loading="lazy"` attribute
3. **Enable Compression**: Ensure gzip/brotli enabled on server
4. **Minimize Bundle Size**: Use code splitting for large features
5. **Cache Fonts**: Self-host fonts for offline availability

## 🐛 Troubleshooting

### Service Worker Not Registering

**Check HTTPS:**
```bash
# PWA requires HTTPS (except localhost)
# Use ngrok for testing:
ngrok http 3000
```

**Clear Registration:**
```javascript
// In browser console
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(reg => reg.unregister()));
```

### Notifications Not Showing

**Check Permission:**
```javascript
console.log(Notification.permission); // should be "granted"
```

**Reset Permission:**
1. Click lock icon in address bar
2. Site Settings > Notifications
3. Change to "Allow"

### Cache Not Updating

**Force Update:**
```javascript
// In browser console
caches.keys().then(keys =>
  Promise.all(keys.map(key => caches.delete(key)))
);
```

**Hard Refresh:**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Offline Queue Not Syncing

**Check Queue:**
```typescript
import { offlineManager } from '@/lib/pwa/offline-manager';

const pending = await offlineManager.getPendingActions();
console.log(`${pending.length} actions pending`);
```

**Force Sync:**
```typescript
import { syncManager } from '@/lib/pwa/sync-manager';

await syncManager.forceSync();
```

## 📊 Lighthouse Audit

Run PWA audit:

```bash
npm run lighthouse
```

Target scores:
- **Performance**: > 90
- **Accessibility**: > 95
- **Best Practices**: > 95
- **SEO**: > 90
- **PWA**: > 90

## 🔐 Security Checklist

- [ ] VAPID keys stored in environment variables (not code)
- [ ] Private VAPID key never exposed to client
- [ ] HTTPS enabled in production
- [ ] Service worker scope properly configured
- [ ] Push notification permissions requested appropriately
- [ ] Offline actions authenticated before sync
- [ ] Cached data doesn't include sensitive info
- [ ] Cache cleared on logout

## 📚 Next Steps

1. **Read Full Documentation**: See `PWA_IMPLEMENTATION.md`
2. **Customize UI**: Update install banner and offline indicator
3. **Configure Notifications**: Set up notification templates
4. **Monitor Usage**: Track PWA metrics and adoption
5. **Optimize Performance**: Fine-tune cache strategies

## 🆘 Need Help?

- 📖 Full docs: `PWA_IMPLEMENTATION.md`
- 🐛 Browser console: Check for errors
- 🔍 DevTools: Application tab > Service Workers
- 💬 Support: Contact development team

## ✅ Verification Checklist

Test each feature:

- [ ] App installs on desktop
- [ ] App installs on mobile
- [ ] Works offline
- [ ] Create ticket offline (queues)
- [ ] Ticket syncs when online
- [ ] Push notifications work
- [ ] Cache updates properly
- [ ] Offline page displays
- [ ] Background sync triggers
- [ ] Storage quota respected

---

**You're all set!** 🎉

Your ServiceDesk is now a fully-featured Progressive Web App.
