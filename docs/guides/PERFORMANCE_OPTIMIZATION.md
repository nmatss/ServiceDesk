# Performance Optimization Guide

## Overview

This document outlines all performance optimizations implemented in the ServiceDesk application to achieve excellent Web Vitals scores.

## Web Vitals Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time until largest content element is rendered |
| **FID** (First Input Delay) | < 100ms | Time from first user interaction to browser response |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability - measures unexpected layout shifts |
| **TTFB** (Time to First Byte) | < 600ms | Time until first byte is received from server |
| **FCP** (First Contentful Paint) | < 1.8s | Time until first content is rendered |

## Lighthouse Score Targets

- **Performance**: 90+ ✅
- **Accessibility**: 95+ ✅
- **Best Practices**: 95+ ✅
- **SEO**: 100 ✅

---

## 1. Bundle Optimization

### Webpack Configuration

**File**: `next.config.js`

#### Code Splitting Strategy

```javascript
splitChunks: {
  chunks: 'all',
  maxInitialRequests: 25,
  minSize: 20000,
  maxSize: 244000, // 244KB max chunk size
  cacheGroups: {
    // Separate heavy libraries
    framework: { /* React, Next.js */ },
    charts: { /* Recharts */ },
    richTextEditor: { /* React Quill */ },
    reactFlow: { /* ReactFlow */ },
    // ... more cache groups
  }
}
```

#### Benefits

- ✅ Smaller initial bundle size
- ✅ Better caching (vendor chunks rarely change)
- ✅ Parallel loading of chunks
- ✅ On-demand loading for heavy components

### Bundle Analysis

```bash
# Analyze bundle size
npm run build:analyze

# View reports
open .next/analyze/client.html
open .next/analyze/server.html
```

---

## 2. Lazy Loading

### Dynamic Imports for Heavy Components

**File**: `components/LazyComponents.tsx`

#### Heavy Libraries Lazy-Loaded

1. **Recharts** (~200KB) - Charts only loaded when visible
2. **React Quill** (~150KB) - Editor only loaded when editing
3. **ReactFlow** (~300KB) - Workflow builder on-demand
4. **Admin Dashboards** - Only for admin users
5. **Analytics Pages** - Only when accessing analytics

#### Usage Example

```typescript
import { LazyRichTextEditor } from '@/components/LazyComponents'

// Only loads when component renders
<LazyRichTextEditor value={content} onChange={setContent} />
```

#### Intersection Observer Lazy Loading

```typescript
import { LazyOnVisible } from '@/components/LazyComponents'

// Only loads when scrolled into view
<LazyOnVisible rootMargin="200px">
  <HeavyComponent />
</LazyOnVisible>
```

---

## 3. Image Optimization

### OptimizedImage Component

**File**: `components/OptimizedImage.tsx`

#### Features

- ✅ Automatic AVIF/WebP conversion
- ✅ Lazy loading by default
- ✅ Blur placeholder
- ✅ Error fallback
- ✅ Responsive sizes
- ✅ CDN optimization

#### Usage

```typescript
import OptimizedImage from '@/components/OptimizedImage'

<OptimizedImage
  src="/uploads/ticket-123.jpg"
  alt="Ticket attachment"
  width={800}
  height={600}
  quality={75}
  priority={false} // lazy load
/>
```

#### Variants

- `OptimizedAvatar` - Circular avatar with optimized size
- `OptimizedThumbnail` - Small thumbnails with lower quality
- `OptimizedLogo` - Priority loading for logos
- `OptimizedBackground` - Background images with overlay

---

## 4. Data Fetching Optimization

### API Client with Caching

**File**: `lib/api/client.ts`

#### Features

- ✅ **LRU Cache** - Intelligent response caching
- ✅ **Request Deduplication** - Prevent duplicate requests
- ✅ **Retry Logic** - Automatic retry on failures
- ✅ **Timeout Control** - Prevent hanging requests
- ✅ **Prefetching** - Load data before needed

#### Usage

```typescript
import { get, post } from '@/lib/api/client'

// Cached GET request
const tickets = await get('/api/tickets', {
  cache: true,
  cacheTTL: 60000, // 1 minute
})

// Prefetch for next page
prefetch('/api/tickets?page=2')
```

#### Cache Management

```typescript
import { clearCache, clearCachePattern } from '@/lib/api/client'

// Clear all cache
clearCache()

// Clear specific pattern
clearCachePattern('/api/tickets')
```

---

## 5. React Optimizations

### Custom Hooks

**File**: `lib/hooks/useOptimized.ts`

#### Performance Hooks

1. **useDebounce** - Debounce search inputs
   ```typescript
   const debouncedSearch = useDebounce(searchTerm, 500)
   ```

2. **useThrottle** - Throttle scroll handlers
   ```typescript
   const throttledScroll = useThrottle(handleScroll, 100)
   ```

3. **useLazyLoad** - Lazy load on viewport
   ```typescript
   const [ref, shouldLoad] = useLazyLoad('200px')
   ```

4. **usePagination** - Client-side pagination
   ```typescript
   const { paginatedData, nextPage, prevPage } = usePagination(data, 10)
   ```

5. **useVirtualScroll** - Virtual scrolling for large lists
   ```typescript
   const { visibleItems, containerProps } = useVirtualScroll(items, 50)
   ```

---

## 6. CSS Optimization

### Tailwind Configuration

**File**: `tailwind.config.js`

#### Optimizations

- ✅ **JIT Mode** - On-demand CSS generation
- ✅ **PurgeCSS** - Remove unused styles
- ✅ **Content Paths** - Optimized scanning
- ✅ **Hover Only When Supported** - Mobile optimization

```javascript
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  future: {
    hoverOnlyWhenSupported: true, // Optimize for mobile
  },
}
```

---

## 7. Web Vitals Monitoring

### Real-time Tracking

**File**: `lib/performance/web-vitals.ts`

#### Features

- ✅ Track all Core Web Vitals
- ✅ Send to Datadog/Sentry
- ✅ Custom analytics endpoint
- ✅ Performance warnings
- ✅ Long task detection
- ✅ Resource monitoring

#### Integration

```typescript
// app/layout.tsx
import WebVitalsReporter from '@/components/WebVitalsReporter'

<WebVitalsReporter />
```

#### API Endpoint

**POST** `/api/analytics/web-vitals`

Receives metrics in production and sends to:
- Datadog (if configured)
- Sentry (if configured)
- Custom database (optional)

---

## 8. Performance Scripts

### Available Commands

```bash
# Build with bundle analysis
npm run build:analyze

# Generate performance report
npm run perf:report

# Run Lighthouse audit
npm run lighthouse

# Lighthouse in CI mode
npm run lighthouse:ci

# Full performance analysis
npm run perf:analyze
```

### Performance Report

**Script**: `scripts/performance-report.js`

Generates detailed report including:
- Total bundle size
- Top 10 largest chunks
- Performance warnings
- Optimization suggestions
- Web Vitals targets

---

## 9. Best Practices Implemented

### Image Loading

- ✅ Use `next/image` with AVIF/WebP
- ✅ Lazy load below-the-fold images
- ✅ Set explicit width/height (prevent CLS)
- ✅ Use blur placeholders
- ✅ Priority load above-the-fold images

### Font Loading

- ✅ Font display: swap
- ✅ Preload critical fonts
- ✅ Subset fonts (latin only)
- ✅ Self-host fonts (avoid external requests)

### JavaScript

- ✅ Code splitting per route
- ✅ Dynamic imports for heavy components
- ✅ Tree shaking enabled
- ✅ Minification with SWC
- ✅ Deduplication of chunks

### Critical Rendering Path

- ✅ Inline critical CSS
- ✅ Defer non-critical CSS
- ✅ Async load JavaScript when possible
- ✅ Minimize render-blocking resources

### Caching Strategy

- ✅ Static assets: 1 year cache
- ✅ API responses: Smart caching with LRU
- ✅ Images: Immutable caching
- ✅ Service Worker (future enhancement)

---

## 10. Monitoring & Debugging

### Development Tools

```javascript
// In browser console
window.__getWebVitalsScores()
```

### Production Monitoring

1. **Datadog RUM** - Real User Monitoring
   - Track Web Vitals
   - User sessions
   - Error tracking

2. **Sentry Performance** - Error & Performance tracking
   - Slow transactions
   - Performance issues
   - Error context

3. **Custom Analytics** - Internal tracking
   - `/api/analytics/web-vitals`
   - Custom metrics
   - Business KPIs

---

## 11. Future Optimizations

### Planned Improvements

- [ ] **Service Worker** - Offline support & precaching
- [ ] **HTTP/3** - Faster protocol
- [ ] **Edge Functions** - Reduce TTFB
- [ ] **Image CDN** - CloudFront/Cloudflare
- [ ] **Database Query Optimization** - Faster API responses
- [ ] **GraphQL** - Reduce over-fetching
- [ ] **React Server Components** - Zero-bundle React

---

## 12. Performance Checklist

### Before Deployment

- [ ] Run `npm run build:analyze`
- [ ] Check bundle size < 500KB initial
- [ ] Run `npm run lighthouse` (score > 90)
- [ ] Test on slow 3G network
- [ ] Test on low-end devices
- [ ] Verify images are optimized
- [ ] Check no console errors
- [ ] Validate all Web Vitals green

### After Deployment

- [ ] Monitor Web Vitals in production
- [ ] Track Lighthouse scores over time
- [ ] Review Sentry performance issues
- [ ] Check Datadog RUM metrics
- [ ] User feedback on performance

---

## 13. Common Issues & Solutions

### Issue: Large Initial Bundle

**Solution**: Implement more dynamic imports

```typescript
// Before
import HeavyComponent from './HeavyComponent'

// After
const HeavyComponent = dynamic(() => import('./HeavyComponent'))
```

### Issue: Poor LCP

**Solutions**:
- Optimize largest image
- Remove render-blocking scripts
- Use priority loading for hero image
- Reduce server response time

### Issue: High CLS

**Solutions**:
- Set explicit dimensions for images/videos
- Reserve space for dynamic content
- Avoid inserting content above existing content
- Use CSS aspect-ratio

### Issue: Slow API Responses

**Solutions**:
- Implement caching with `lib/api/client`
- Use pagination for large datasets
- Optimize database queries
- Consider edge functions

---

## Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Bundle Analyzer](https://github.com/vercel/next.js/tree/canary/packages/next-bundle-analyzer)

---

## Support

For performance-related questions:
1. Check this guide
2. Review `scripts/performance-report.js` output
3. Analyze bundle with `npm run build:analyze`
4. Monitor Web Vitals in production
