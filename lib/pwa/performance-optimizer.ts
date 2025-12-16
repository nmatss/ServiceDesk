import logger from '../monitoring/structured-logger';
import { sanitizeHTML } from '../security/sanitize';

/**
 * Performance Optimization Utilities
 * Code splitting, lazy loading, and Core Web Vitals optimization
 */

interface PerformanceMetrics {
  fcp: number;  // First Contentful Paint
  lcp: number;  // Largest Contentful Paint
  fid: number;  // First Input Delay
  cls: number;  // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

interface LazyLoadConfig {
  rootMargin: string;
  threshold: number;
  loadingPlaceholder: string;
  errorPlaceholder: string;
}

interface PreloadConfig {
  images: string[];
  fonts: string[];
  scripts: string[];
  styles: string[];
}

class PerformanceOptimizer {
  private performanceObserver: PerformanceObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private metrics: Partial<PerformanceMetrics> = {};

  constructor() {
    this.initPerformanceMonitoring();
    this.optimizePageLoad();
  }

  // Performance monitoring
  private initPerformanceMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    // Monitor Core Web Vitals
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        switch (entry.entryType) {
          case 'paint':
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime;
            }
            break;

          case 'largest-contentful-paint':
            this.metrics.lcp = entry.startTime;
            break;

          case 'first-input':
            const firstInputEntry = entry as any;
            if ('processingStart' in firstInputEntry) {
              this.metrics.fid = firstInputEntry.processingStart - entry.startTime;
            }
            break;

          case 'layout-shift':
            if (!(entry as any).hadRecentInput) {
              this.metrics.cls = (this.metrics.cls || 0) + (entry as any).value;
            }
            break;
        }
      }

      this.reportMetrics();
    });

    try {
      this.performanceObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (error) {
      logger.warn('Performance monitoring not fully supported', error);
    }

    // Monitor navigation timing
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
      }
    });
  }

  // Lazy loading implementation
  public enableLazyLoading(config?: Partial<LazyLoadConfig>): void {
    const defaultConfig: LazyLoadConfig = {
      rootMargin: '50px',
      threshold: 0.1,
      loadingPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+',
      errorPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjU1Ii8+PC9zdmc+',
      ...config
    };

    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          this.loadElement(element, defaultConfig);
          this.intersectionObserver!.unobserve(element);
        }
      });
    }, {
      rootMargin: defaultConfig.rootMargin,
      threshold: defaultConfig.threshold
    });

    // Observe existing lazy elements
    this.observeLazyElements();

    // Observe new lazy elements added to DOM
    this.observeNewElements();
  }

  private observeLazyElements(): void {
    const lazyElements = document.querySelectorAll('[data-lazy]');
    lazyElements.forEach(element => {
      this.intersectionObserver!.observe(element);
    });
  }

  private observeNewElements(): void {
    if (!('MutationObserver' in window)) return;

    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Check if the element itself is lazy
            if (element.hasAttribute('data-lazy')) {
              this.intersectionObserver!.observe(element);
            }

            // Check for lazy elements within the added node
            const lazyChildren = element.querySelectorAll('[data-lazy]');
            lazyChildren.forEach(child => {
              this.intersectionObserver!.observe(child);
            });
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private loadElement(element: HTMLElement, config: LazyLoadConfig): void {
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case 'img':
        this.loadImage(element as HTMLImageElement, config);
        break;

      case 'iframe':
        this.loadIframe(element as HTMLIFrameElement);
        break;

      case 'video':
        this.loadVideo(element as HTMLVideoElement);
        break;

      default:
        this.loadGenericElement(element);
    }
  }

  private loadImage(img: HTMLImageElement, config: LazyLoadConfig): void {
    const src = img.dataset.lazy;
    if (!src) return;

    // Show loading placeholder
    if (!img.src && config.loadingPlaceholder) {
      img.src = config.loadingPlaceholder;
    }

    // Create new image to preload
    const newImg = new Image();

    newImg.onload = () => {
      img.src = src;
      img.classList.add('lazy-loaded');
      img.removeAttribute('data-lazy');
    };

    newImg.onerror = () => {
      if (config.errorPlaceholder) {
        img.src = config.errorPlaceholder;
      }
      img.classList.add('lazy-error');
    };

    newImg.src = src;
  }

  private loadIframe(iframe: HTMLIFrameElement): void {
    const src = iframe.dataset.lazy;
    if (src) {
      iframe.src = src;
      iframe.removeAttribute('data-lazy');
    }
  }

  private loadVideo(video: HTMLVideoElement): void {
    const src = video.dataset.lazy;
    if (src) {
      video.src = src;
      video.removeAttribute('data-lazy');
    }
  }

  private loadGenericElement(element: HTMLElement): void {
    const src = element.dataset.lazy;
    if (src) {
      // Load content via fetch
      fetch(src)
        .then(response => response.text())
        .then(html => {
          // SECURITY: Sanitize HTML before inserting to prevent XSS
          element.innerHTML = sanitizeHTML(html);
          element.removeAttribute('data-lazy');
        })
        .catch(error => {
          logger.error('Failed to load lazy content', error);
          element.textContent = 'Failed to load content';
        });
    }
  }

  // Resource preloading
  public preloadResources(config: Partial<PreloadConfig>): void {
    // Preload critical images
    if (config.images) {
      config.images.forEach(src => this.preloadImage(src));
    }

    // Preload fonts
    if (config.fonts) {
      config.fonts.forEach(href => this.preloadFont(href));
    }

    // Preload scripts
    if (config.scripts) {
      config.scripts.forEach(src => this.preloadScript(src));
    }

    // Preload stylesheets
    if (config.styles) {
      config.styles.forEach(href => this.preloadStyle(href));
    }
  }

  private preloadImage(src: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  }

  private preloadFont(href: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  private preloadScript(src: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = src;
    document.head.appendChild(link);
  }

  private preloadStyle(href: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  }

  // Image optimization
  public optimizeImages(): void {
    const images = document.querySelectorAll('img');

    images.forEach(img => {
      // Add loading="lazy" for native lazy loading fallback
      if (!img.hasAttribute('loading')) {
        img.loading = 'lazy';
      }

      // Add decode="async" for better perceived performance
      if (!img.hasAttribute('decode')) {
        img.decoding = 'async';
      }

      // Optimize image loading based on viewport
      this.optimizeImageForViewport(img);
    });
  }

  private optimizeImageForViewport(img: HTMLImageElement): void {
    // Use ResizeObserver to adjust image quality based on display size
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width } = entry.contentRect;

          // Adjust image quality based on display size
          if (width < 400) {
            img.style.imageRendering = 'auto';
          } else if (width > 1200) {
            img.style.imageRendering = 'high-quality';
          }
        }
      });

      resizeObserver.observe(img);
    }
  }

  // Bundle optimization helpers
  public async loadChunk(chunkName: string): Promise<unknown> {
    try {
      // Dynamic import with chunk naming
      const loadedModule = await import(/* webpackChunkName: "[request]" */ `@/components/${chunkName}`);
      return loadedModule.default || loadedModule;
    } catch (error) {
      logger.error(`Failed to load chunk ${chunkName}:`, error);
      throw error;
    }
  }

  // Critical CSS inlining
  public inlineCriticalCSS(css: string): void {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-critical', 'true');
    document.head.appendChild(style);
  }

  // Resource prioritization
  public prioritizeResource(url: string, priority: 'high' | 'low'): void {
    if ('requestIdleCallback' in window && priority === 'low') {
      // Load low priority resources during idle time
      requestIdleCallback(() => {
        this.loadResource(url);
      });
    } else {
      // Load high priority resources immediately
      this.loadResource(url);
    }
  }

  private loadResource(url: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }

  // Page optimization
  private optimizePageLoad(): void {
    // Remove unused CSS (simplified implementation)
    this.removeUnusedCSS();

    // Optimize third-party scripts
    this.optimizeThirdPartyScripts();

    // Enable DNS prefetching
    this.enableDNSPrefetch();
  }

  private removeUnusedCSS(): void {
    // This would typically be done at build time
    // Here's a simplified runtime version
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');

    stylesheets.forEach(stylesheet => {
      if (stylesheet.getAttribute('href')?.includes('unused')) {
        stylesheet.remove();
      }
    });
  }

  private optimizeThirdPartyScripts(): void {
    // Defer non-critical third-party scripts
    const scripts = document.querySelectorAll('script[src]');

    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && this.isThirdPartyScript(src)) {
        script.setAttribute('defer', '');
      }
    });
  }

  private isThirdPartyScript(src: string): boolean {
    const currentHost = window.location.hostname;
    try {
      const url = new URL(src, window.location.origin);
      return url.hostname !== currentHost;
    } catch {
      return false;
    }
  }

  private enableDNSPrefetch(): void {
    const commonDomains = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdnjs.cloudflare.com'
    ];

    commonDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });
  }

  // Performance metrics reporting
  private reportMetrics(): void {
    // Debounce reporting
    clearTimeout(this.reportTimeout);
    this.reportTimeout = window.setTimeout(() => {
      this.sendMetricsToAnalytics();
    }, 1000);
  }

  private reportTimeout: number = 0;

  private sendMetricsToAnalytics(): void {
    // Send metrics to analytics service
    if (navigator.sendBeacon) {
      const data = JSON.stringify({
        url: window.location.href,
        metrics: this.metrics,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });

      navigator.sendBeacon('/api/analytics/performance', data);
    }

    // Also dispatch event for local handling
    window.dispatchEvent(new CustomEvent('performanceMetrics', {
      detail: this.metrics
    }));
  }

  // Core Web Vitals scoring
  public getWebVitalsScore(): {
    fcp: 'good' | 'needs-improvement' | 'poor';
    lcp: 'good' | 'needs-improvement' | 'poor';
    fid: 'good' | 'needs-improvement' | 'poor';
    cls: 'good' | 'needs-improvement' | 'poor';
    overall: number;
  } {
    const scoreMetric = (value: number, goodThreshold: number, poorThreshold: number) => {
      if (value <= goodThreshold) return 'good';
      if (value <= poorThreshold) return 'needs-improvement';
      return 'poor';
    };

    const fcp = scoreMetric(this.metrics.fcp || 0, 1800, 3000);
    const lcp = scoreMetric(this.metrics.lcp || 0, 2500, 4000);
    const fid = scoreMetric(this.metrics.fid || 0, 100, 300);
    const cls = scoreMetric(this.metrics.cls || 0, 0.1, 0.25);

    // Calculate overall score (0-100)
    const scores = { good: 100, 'needs-improvement': 50, poor: 0 };
    const overall = Math.round(
      (scores[fcp] + scores[lcp] + scores[fid] + scores[cls]) / 4
    );

    return { fcp, lcp, fid, cls, overall };
  }

  // Cleanup
  public destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    clearTimeout(this.reportTimeout);
  }
}

// Singleton instance
let performanceOptimizerInstance: PerformanceOptimizer | null = null;

export function getPerformanceOptimizer(): PerformanceOptimizer {
  if (!performanceOptimizerInstance) {
    performanceOptimizerInstance = new PerformanceOptimizer();
  }
  return performanceOptimizerInstance;
}

export default PerformanceOptimizer;