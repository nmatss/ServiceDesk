/**
 * Performance & Load Testing Suite
 *
 * Tests system performance under various load conditions and measures:
 * - Page load times
 * - API response times
 * - Database query performance
 * - Concurrent user handling
 * - Memory leak detection
 * - Asset optimization
 * - Cache effectiveness
 *
 * Performance Budgets:
 * - Page Load: < 3s (LCP < 2.5s)
 * - API Response: < 500ms (p95 < 1s)
 * - Database Query: < 100ms
 * - Time to Interactive: < 5s
 * - First Contentful Paint: < 1.8s
 */

import { test, expect, Page } from '@playwright/test';
import { chromium, Browser, BrowserContext } from '@playwright/test';
import { logger } from '@/lib/monitoring/logger';

// ========================
// PERFORMANCE BUDGETS
// ========================

const PERFORMANCE_BUDGETS = {
  // Core Web Vitals
  LCP: 2500, // Largest Contentful Paint (ms)
  FID: 100,  // First Input Delay (ms)
  CLS: 0.1,  // Cumulative Layout Shift (score)
  TTFB: 800, // Time to First Byte (ms)
  FCP: 1800, // First Contentful Paint (ms)
  TTI: 5000, // Time to Interactive (ms)

  // API Performance
  API_RESPONSE_P50: 300,  // 50th percentile (ms)
  API_RESPONSE_P95: 500,  // 95th percentile (ms)
  API_RESPONSE_P99: 1000, // 99th percentile (ms)

  // Database Performance
  DB_QUERY_AVG: 100,  // Average query time (ms)
  DB_QUERY_MAX: 500,  // Maximum acceptable query time (ms)

  // Page Load
  PAGE_LOAD_MAX: 3000, // Maximum page load time (ms)

  // Asset Size
  JS_BUNDLE_MAX: 512 * 1024,    // 512KB
  CSS_BUNDLE_MAX: 100 * 1024,   // 100KB
  IMAGE_MAX: 200 * 1024,        // 200KB per image
  TOTAL_PAGE_SIZE: 2 * 1024 * 1024, // 2MB
};

// ========================
// TEST CONFIGURATION
// ========================

const TEST_CONFIG = {
  CONCURRENT_USERS: 100,
  TEST_DURATION: 60000, // 1 minute
  RAMP_UP_TIME: 10000,  // 10 seconds
  WARMUP_REQUESTS: 10,
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  API_TIMEOUT: 30000,
};

// ========================
// TEST DATA
// ========================

const TEST_USERS = [
  { email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { email: 'agent@example.com', password: 'agent123', role: 'agent' },
  { email: 'user@example.com', password: 'user123', role: 'user' },
];

// ========================
// HELPER FUNCTIONS
// ========================

/**
 * Measure Core Web Vitals
 */
async function measureWebVitals(page: Page): Promise<{
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  fcp: number;
  tti: number;
}> {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const result: any = {
        lcp: 0,
        fid: 0,
        cls: 0,
        ttfb: 0,
        fcp: 0,
        tti: 0,
      };

      // LCP - Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        result.lcp = lastEntry.renderTime || lastEntry.loadTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // FID - First Input Delay
      new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0] as any;
        result.fid = firstInput.processingStart - firstInput.startTime;
      }).observe({ type: 'first-input', buffered: true });

      // CLS - Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        result.cls = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });

      // TTFB & FCP
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navEntry) {
        result.ttfb = navEntry.responseStart - navEntry.requestStart;
      }

      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        result.fcp = fcpEntry.startTime;
      }

      // TTI - approximate using load event
      result.tti = navEntry ? navEntry.loadEventEnd - navEntry.fetchStart : 0;

      // Wait a bit for all observers to fire
      setTimeout(() => resolve(result), 1000);
    });
  });

  return metrics as any;
}

/**
 * Measure API response time
 */
async function measureApiResponse(
  page: Page,
  endpoint: string,
  options: { method?: string; body?: any } = {}
): Promise<{ duration: number; status: number; size: number }> {
  const startTime = Date.now();

  const response = await page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.text();

      return {
        status: res.status,
        size: data.length,
      };
    },
    { url: endpoint, method: options.method, body: options.body }
  );

  const duration = Date.now() - startTime;

  return {
    duration,
    status: response.status,
    size: response.size,
  };
}

/**
 * Calculate percentiles
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * Measure memory usage
 */
async function measureMemory(page: Page): Promise<{ usedJSHeapSize: number; totalJSHeapSize: number }> {
  const memory = await page.evaluate(() => {
    if ((performance as any).memory) {
      return {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      };
    }
    return { usedJSHeapSize: 0, totalJSHeapSize: 0 };
  });

  return memory;
}

/**
 * Login helper
 */
async function login(page: Page, email: string, password: string) {
  await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
  await page.click('text=Login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

// ========================
// TEST SUITE: PAGE LOAD PERFORMANCE
// ========================

test.describe('Page Load Performance', () => {
  test('Landing page loads within budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Measure Web Vitals
    const vitals = await measureWebVitals(page);

    // Assertions
    expect(loadTime).toBeLessThan(PERFORMANCE_BUDGETS.PAGE_LOAD_MAX);
    expect(vitals.lcp).toBeLessThan(PERFORMANCE_BUDGETS.LCP);
    expect(vitals.fcp).toBeLessThan(PERFORMANCE_BUDGETS.FCP);
    expect(vitals.ttfb).toBeLessThan(PERFORMANCE_BUDGETS.TTFB);
    expect(vitals.cls).toBeLessThan(PERFORMANCE_BUDGETS.CLS);
    expect(vitals.tti).toBeLessThan(PERFORMANCE_BUDGETS.TTI);

    logger.info('Landing Page Performance', {
      loadTime,
      ...vitals,
    });
  });

  test('Dashboard loads within budget', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const startTime = Date.now();
    await page.goto(`${TEST_CONFIG.BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    const vitals = await measureWebVitals(page);

    expect(loadTime).toBeLessThan(PERFORMANCE_BUDGETS.PAGE_LOAD_MAX);
    expect(vitals.lcp).toBeLessThan(PERFORMANCE_BUDGETS.LCP);

    logger.info('Dashboard Performance', {
      loadTime,
      ...vitals,
    });
  });

  test('Ticket list page loads within budget', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const startTime = Date.now();
    await page.goto(`${TEST_CONFIG.BASE_URL}/tickets`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    const vitals = await measureWebVitals(page);

    expect(loadTime).toBeLessThan(PERFORMANCE_BUDGETS.PAGE_LOAD_MAX);
    expect(vitals.lcp).toBeLessThan(PERFORMANCE_BUDGETS.LCP);

    logger.info('Ticket List Performance', {
      loadTime,
      ...vitals,
    });
  });

  test('Analytics page loads within budget', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const startTime = Date.now();
    await page.goto(`${TEST_CONFIG.BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    const vitals = await measureWebVitals(page);

    expect(loadTime).toBeLessThan(PERFORMANCE_BUDGETS.PAGE_LOAD_MAX);

    logger.info('Analytics Page Performance', {
      loadTime,
      ...vitals,
    });
  });
});

// ========================
// TEST SUITE: API PERFORMANCE
// ========================

test.describe('API Response Performance', () => {
  test('Health check endpoint responds quickly', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);

    const measurements: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureApiResponse(page, `${TEST_CONFIG.BASE_URL}/api/health`);
      measurements.push(duration);
    }

    const avg = measurements.reduce((a, b) => a + b) / measurements.length;
    const p95 = calculatePercentile(measurements, 95);

    expect(avg).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P50);
    expect(p95).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P95);

    logger.info('Health Check API Performance', {
      avg,
      p50: calculatePercentile(measurements, 50),
      p95,
      p99: calculatePercentile(measurements, 99),
    });
  });

  test('Ticket list API responds within budget', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const measurements: number[] = [];
    for (let i = 0; i < 20; i++) {
      const { duration } = await measureApiResponse(page, `${TEST_CONFIG.BASE_URL}/api/tickets`);
      measurements.push(duration);
    }

    const avg = measurements.reduce((a, b) => a + b) / measurements.length;
    const p95 = calculatePercentile(measurements, 95);
    const p99 = calculatePercentile(measurements, 99);

    expect(avg).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P50);
    expect(p95).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P95);
    expect(p99).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P99);

    logger.info('Ticket List API Performance', {
      avg,
      p50: calculatePercentile(measurements, 50),
      p95,
      p99,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
    });
  });

  test('Analytics API responds within budget', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const measurements: number[] = [];
    for (let i = 0; i < 15; i++) {
      const { duration } = await measureApiResponse(page, `${TEST_CONFIG.BASE_URL}/api/analytics`);
      measurements.push(duration);
    }

    const avg = measurements.reduce((a, b) => a + b) / measurements.length;
    const p95 = calculatePercentile(measurements, 95);

    expect(p95).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P95);

    logger.info('Analytics API Performance', {
      avg,
      p50: calculatePercentile(measurements, 50),
      p95,
      p99: calculatePercentile(measurements, 99),
    });
  });

  test('Search API responds within budget', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const measurements: number[] = [];
    const searchQueries = ['bug', 'feature', 'issue', 'ticket', 'problem'];

    for (const query of searchQueries) {
      const { duration } = await measureApiResponse(
        page,
        `${TEST_CONFIG.BASE_URL}/api/search?q=${query}`
      );
      measurements.push(duration);
    }

    const avg = measurements.reduce((a, b) => a + b) / measurements.length;
    const p95 = calculatePercentile(measurements, 95);

    expect(p95).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P95);

    logger.info('Search API Performance', {
      avg,
      p95,
      queries: searchQueries.length,
    });
  });
});

// ========================
// TEST SUITE: CONCURRENT USER LOAD
// ========================

test.describe('Concurrent User Load', () => {
  test('System handles 100 concurrent users', async () => {
    const browser = await chromium.launch();
    const contexts: BrowserContext[] = [];
    const results: Array<{ success: boolean; duration: number; error?: string }> = [];

    try {
      // Create 100 concurrent user sessions
      logger.info(`Creating ${TEST_CONFIG.CONCURRENT_USERS} concurrent user contexts...`);

      for (let i = 0; i < TEST_CONFIG.CONCURRENT_USERS; i++) {
        const context = await browser.newContext();
        contexts.push(context);
      }

      // Simulate concurrent page loads
      logger.info('Starting concurrent page loads...');
      const loadPromises = contexts.map(async (context, index) => {
        const page = await context.newPage();
        const startTime = Date.now();

        try {
          await page.goto(`${TEST_CONFIG.BASE_URL}/landing`, { timeout: 30000 });
          await page.waitForLoadState('networkidle', { timeout: 30000 });
          const duration = Date.now() - startTime;

          results.push({ success: true, duration });
          return { success: true, duration };
        } catch (error) {
          const duration = Date.now() - startTime;
          results.push({
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return { success: false, duration, error };
        } finally {
          await page.close();
        }
      });

      await Promise.all(loadPromises);

      // Analyze results
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const successRate = (successful / results.length) * 100;
      const durations = results.filter((r) => r.success).map((r) => r.duration);

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Duration = calculatePercentile(durations, 95);
      const p99Duration = calculatePercentile(durations, 99);

      logger.info('Concurrent Load Test Results', {
        totalUsers: TEST_CONFIG.CONCURRENT_USERS,
        successful,
        failed,
        successRate: `${successRate.toFixed(2)}%`,
        avgDuration: `${avgDuration.toFixed(2)}ms`,
        p95Duration: `${p95Duration.toFixed(2)}ms`,
        p99Duration: `${p99Duration.toFixed(2)}ms`,
      });

      // Assertions
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(p95Duration).toBeLessThan(PERFORMANCE_BUDGETS.PAGE_LOAD_MAX * 2); // Allow 2x budget under load
    } finally {
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
      await browser.close();
    }
  });

  test('API handles 50 concurrent requests', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);

    const measurements: number[] = [];
    const errors: string[] = [];

    // Create 50 concurrent API requests
    const requests = Array.from({ length: 50 }, async () => {
      try {
        const { duration, status } = await measureApiResponse(
          page,
          `${TEST_CONFIG.BASE_URL}/api/health`
        );

        if (status === 200) {
          measurements.push(duration);
        } else {
          errors.push(`HTTP ${status}`);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    });

    await Promise.all(requests);

    const successRate = (measurements.length / 50) * 100;
    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const p95 = calculatePercentile(measurements, 95);

    logger.info('Concurrent API Request Results', {
      totalRequests: 50,
      successful: measurements.length,
      failed: errors.length,
      successRate: `${successRate.toFixed(2)}%`,
      avgDuration: `${avg.toFixed(2)}ms`,
      p95Duration: `${p95.toFixed(2)}ms`,
    });

    expect(successRate).toBeGreaterThan(98); // 98% success rate
    expect(p95).toBeLessThan(PERFORMANCE_BUDGETS.API_RESPONSE_P95 * 1.5); // Allow 1.5x budget
  });
});

// ========================
// TEST SUITE: MEMORY LEAK DETECTION
// ========================

test.describe('Memory Leak Detection', () => {
  test('No memory leaks during prolonged session', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const memoryMeasurements: number[] = [];

    // Measure initial memory
    const initialMemory = await measureMemory(page);
    memoryMeasurements.push(initialMemory.usedJSHeapSize);

    logger.info('Initial memory', {
      used: `${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      total: `${(initialMemory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
    });

    // Simulate user activity for 30 iterations
    for (let i = 0; i < 30; i++) {
      // Navigate between pages
      await page.goto(`${TEST_CONFIG.BASE_URL}/tickets`);
      await page.waitForLoadState('networkidle');
      await page.goto(`${TEST_CONFIG.BASE_URL}/analytics`);
      await page.waitForLoadState('networkidle');
      await page.goto(`${TEST_CONFIG.BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Measure memory every 5 iterations
      if (i % 5 === 0) {
        const memory = await measureMemory(page);
        memoryMeasurements.push(memory.usedJSHeapSize);

        logger.info(`Memory after ${i + 1} iterations:`, {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          delta: `${((memory.usedJSHeapSize - initialMemory.usedJSHeapSize) / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    }

    // Analyze memory growth
    const finalMemory = memoryMeasurements[memoryMeasurements.length - 1];
    const memoryGrowth = finalMemory - initialMemory.usedJSHeapSize;
    const memoryGrowthPercentage = (memoryGrowth / initialMemory.usedJSHeapSize) * 100;

    logger.info('Memory Leak Analysis', {
      initialMemory: `${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      finalMemory: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
      growth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
      growthPercentage: `${memoryGrowthPercentage.toFixed(2)}%`,
    });

    // Memory should not grow more than 50% during normal usage
    expect(memoryGrowthPercentage).toBeLessThan(50);
  });

  test('Memory released after navigation', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    // Load heavy page
    await page.goto(`${TEST_CONFIG.BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');

    const heavyPageMemory = await measureMemory(page);

    // Navigate to light page
    await page.goto(`${TEST_CONFIG.BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    // Wait for cleanup
    await page.waitForTimeout(2000);

    const lightPageMemory = await measureMemory(page);

    logger.info('Memory Release Test', {
      heavyPage: `${(heavyPageMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      lightPage: `${(lightPageMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      released: `${((heavyPageMemory.usedJSHeapSize - lightPageMemory.usedJSHeapSize) / 1024 / 1024).toFixed(2)}MB`,
    });

    // Some memory should be released
    expect(lightPageMemory.usedJSHeapSize).toBeLessThanOrEqual(heavyPageMemory.usedJSHeapSize);
  });
});

// ========================
// TEST SUITE: ASSET OPTIMIZATION
// ========================

test.describe('Asset Optimization', () => {
  test('JavaScript bundles are optimized', async ({ page }) => {
    const resources: { url: string; size: number; type: string }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.js') && !url.includes('node_modules')) {
        try {
          const buffer = await response.body();
          resources.push({
            url,
            size: buffer.length,
            type: 'javascript',
          });
        } catch (e) {
          // Ignore errors for failed responses
        }
      }
    });

    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    const totalJsSize = resources.reduce((sum, r) => sum + r.size, 0);
    const largestJs = Math.max(...resources.map((r) => r.size));

    logger.info('JavaScript Bundle Analysis', {
      totalBundles: resources.length,
      totalSize: `${(totalJsSize / 1024).toFixed(2)}KB`,
      largestBundle: `${(largestJs / 1024).toFixed(2)}KB`,
      averageSize: `${(totalJsSize / resources.length / 1024).toFixed(2)}KB`,
    });

    expect(largestJs).toBeLessThan(PERFORMANCE_BUDGETS.JS_BUNDLE_MAX);
  });

  test('CSS bundles are optimized', async ({ page }) => {
    const resources: { url: string; size: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.css')) {
        try {
          const buffer = await response.body();
          resources.push({
            url,
            size: buffer.length,
          });
        } catch (e) {
          // Ignore errors
        }
      }
    });

    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    const totalCssSize = resources.reduce((sum, r) => sum + r.size, 0);
    const largestCss = Math.max(...resources.map((r) => r.size), 0);

    logger.info('CSS Bundle Analysis', {
      totalBundles: resources.length,
      totalSize: `${(totalCssSize / 1024).toFixed(2)}KB`,
      largestBundle: `${(largestCss / 1024).toFixed(2)}KB`,
    });

    expect(largestCss).toBeLessThan(PERFORMANCE_BUDGETS.CSS_BUNDLE_MAX);
  });

  test('Images are optimized', async ({ page }) => {
    const images: { url: string; size: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (contentType.startsWith('image/')) {
        try {
          const buffer = await response.body();
          images.push({
            url,
            size: buffer.length,
          });
        } catch (e) {
          // Ignore errors
        }
      }
    });

    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    const totalImageSize = images.reduce((sum, img) => sum + img.size, 0);
    const largestImage = Math.max(...images.map((img) => img.size), 0);

    logger.info('Image Optimization Analysis', {
      totalImages: images.length,
      totalSize: `${(totalImageSize / 1024).toFixed(2)}KB`,
      largestImage: `${(largestImage / 1024).toFixed(2)}KB`,
      averageSize: images.length > 0 ? `${(totalImageSize / images.length / 1024).toFixed(2)}KB` : '0KB',
    });

    if (images.length > 0) {
      expect(largestImage).toBeLessThan(PERFORMANCE_BUDGETS.IMAGE_MAX);
    }
  });

  test('Total page size is within budget', async ({ page }) => {
    let totalSize = 0;

    page.on('response', async (response) => {
      try {
        const buffer = await response.body();
        totalSize += buffer.length;
      } catch (e) {
        // Ignore errors
      }
    });

    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    logger.info('Total Page Size', {
      size: `${(totalSize / 1024).toFixed(2)}KB`,
      sizeMB: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
    });

    expect(totalSize).toBeLessThan(PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE);
  });
});

// ========================
// TEST SUITE: CACHE EFFECTIVENESS
// ========================

test.describe('Cache Effectiveness', () => {
  test('Static assets are cached', async ({ page }) => {
    const firstLoadResources: Map<string, number> = new Map();
    const secondLoadResources: Map<string, number> = new Map();

    // First load
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('_next/static/') || url.includes('.js') || url.includes('.css')) {
        firstLoadResources.set(url, response.status());
      }
    });

    await page.goto(`${TEST_CONFIG.BASE_URL}/landing`);
    await page.waitForLoadState('networkidle');

    // Second load (should use cache)
    page.removeAllListeners('response');

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('_next/static/') || url.includes('.js') || url.includes('.css')) {
        secondLoadResources.set(url, response.status());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Count cached responses (304 or from cache)
    let cachedCount = 0;
    for (const [url, status] of secondLoadResources.entries()) {
      if (status === 304 || firstLoadResources.has(url)) {
        cachedCount++;
      }
    }

    const cacheHitRate = (cachedCount / secondLoadResources.size) * 100;

    logger.info('Cache Effectiveness', {
      firstLoad: firstLoadResources.size,
      secondLoad: secondLoadResources.size,
      cached: cachedCount,
      cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
    });

    expect(cacheHitRate).toBeGreaterThan(70); // At least 70% cache hit rate
  });

  test('API responses use cache headers', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    let cacheControlHeader: string | null = null;
    let etagHeader: string | null = null;

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/tickets')) {
        cacheControlHeader = response.headers()['cache-control'] || null;
        etagHeader = response.headers()['etag'] || null;
      }
    });

    await page.goto(`${TEST_CONFIG.BASE_URL}/tickets`);
    await page.waitForLoadState('networkidle');

    logger.info('API Cache Headers', {
      cacheControl: cacheControlHeader,
      etag: etagHeader,
    });

    // Cache headers should be present
    expect(cacheControlHeader).toBeTruthy();
  });
});

// ========================
// TEST SUITE: DATABASE PERFORMANCE
// ========================

test.describe('Database Performance', () => {
  test('Query performance is acceptable', async ({ page }) => {
    await login(page, TEST_USERS[0].email, TEST_USERS[0].password);

    const queryTimes: number[] = [];

    // Measure multiple queries
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureApiResponse(page, `${TEST_CONFIG.BASE_URL}/api/tickets`);
      queryTimes.push(duration);
    }

    const avgQueryTime = queryTimes.reduce((a, b) => a + b) / queryTimes.length;
    const maxQueryTime = Math.max(...queryTimes);

    logger.info('Database Query Performance', {
      avgTime: `${avgQueryTime.toFixed(2)}ms`,
      maxTime: `${maxQueryTime.toFixed(2)}ms`,
      minTime: `${Math.min(...queryTimes).toFixed(2)}ms`,
    });

    expect(avgQueryTime).toBeLessThan(PERFORMANCE_BUDGETS.DB_QUERY_AVG);
    expect(maxQueryTime).toBeLessThan(PERFORMANCE_BUDGETS.DB_QUERY_MAX);
  });
});
