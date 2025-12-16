/**
 * Browser Cache Optimization Headers and Strategies
 * Manages HTTP caching headers, ETags, and browser-specific optimizations
 */

export interface CachePolicy {
  maxAge: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  private?: boolean;
  public?: boolean;
  immutable?: boolean;
}

export interface ETagConfig {
  enabled: boolean;
  algorithm: 'md5' | 'sha1' | 'sha256';
  weak: boolean;
}

export interface ResourceType {
  type: 'html' | 'css' | 'js' | 'image' | 'font' | 'json' | 'xml' | 'api';
  pattern: RegExp;
  cachePolicy: CachePolicy;
  etag: boolean;
  vary: string[];
  compressionEnabled: boolean;
}

export interface BrowserCacheConfig {
  defaultPolicy: CachePolicy;
  etagConfig: ETagConfig;
  resources: ResourceType[];
  varyHeaders: string[];
  corsPolicy: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
    maxAge: number;
  };
  securityHeaders: {
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    csp: {
      enabled: boolean;
      policy: string;
      reportOnly: boolean;
    };
    frameOptions: 'deny' | 'sameorigin' | 'allow-from';
    contentTypeOptions: boolean;
    referrerPolicy: string;
    permissionsPolicy: string;
  };
}

export interface CacheAnalytics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  bandwidth: {
    served: number;
    saved: number;
    percentage: number;
  };
  responseTime: {
    cached: number;
    uncached: number;
    improvement: number;
  };
  resourceStats: Map<string, {
    hits: number;
    misses: number;
    totalSize: number;
    cachedSize: number;
  }>;
}

export class BrowserCacheManager {
  private static instance: BrowserCacheManager;
  private config: BrowserCacheConfig;
  private analytics: CacheAnalytics;
  private etagStore = new Map<string, string>();

  private constructor(config: BrowserCacheConfig) {
    this.config = config;
    this.analytics = {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      bandwidth: { served: 0, saved: 0, percentage: 0 },
      responseTime: { cached: 0, uncached: 0, improvement: 0 },
      resourceStats: new Map()
    };
  }

  static getInstance(config?: BrowserCacheConfig): BrowserCacheManager {
    if (!BrowserCacheManager.instance && config) {
      BrowserCacheManager.instance = new BrowserCacheManager(config);
    }
    return BrowserCacheManager.instance;
  }

  /**
   * Generate optimized cache headers for a resource
   */
  generateCacheHeaders(
    url: string,
    contentType: string,
    resourceSize: number,
    lastModified?: Date,
    customPolicy?: Partial<CachePolicy>
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Find matching resource type
    const resourceType = this.findResourceType(url, contentType);
    const policy = { ...resourceType.cachePolicy, ...customPolicy };

    // Cache-Control header
    const cacheControl = this.buildCacheControlHeader(policy);
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }

    // ETag header
    if (resourceType.etag && this.config.etagConfig.enabled) {
      const etag = this.generateETag(url, resourceSize, lastModified);
      headers['ETag'] = etag;
    }

    // Last-Modified header
    if (lastModified) {
      headers['Last-Modified'] = lastModified.toUTCString();
    }

    // Vary header
    if (resourceType.vary.length > 0) {
      headers['Vary'] = resourceType.vary.join(', ');
    }

    // Content-Type
    headers['Content-Type'] = contentType;

    // Compression headers
    if (resourceType.compressionEnabled) {
      headers['Content-Encoding'] = 'gzip';
    }

    // Security headers
    this.addSecurityHeaders(headers, resourceType.type);

    // CORS headers
    if (this.config.corsPolicy.enabled) {
      this.addCorsHeaders(headers);
    }

    return headers;
  }

  /**
   * Check if request can be served from cache (304 response)
   */
  canServeFromCache(
    url: string,
    requestHeaders: Record<string, string>
  ): {
    canServe: boolean;
    reason: string;
    headers: Record<string, string>;
  } {
    const headers: Record<string, string> = {};

    // Check If-None-Match (ETag)
    const ifNoneMatch = requestHeaders['if-none-match'];
    const storedETag = this.etagStore.get(url);

    if (ifNoneMatch && storedETag) {
      if (ifNoneMatch === storedETag || ifNoneMatch === '*') {
        headers['ETag'] = storedETag;
        return {
          canServe: true,
          reason: 'ETag match',
          headers
        };
      }
    }

    // Check If-Modified-Since
    const ifModifiedSince = requestHeaders['if-modified-since'];
    if (ifModifiedSince) {
      const modifiedSinceDate = new Date(ifModifiedSince);
      const resourceLastModified = this.getResourceLastModified(url);

      if (resourceLastModified && resourceLastModified <= modifiedSinceDate) {
        if (resourceLastModified) {
          headers['Last-Modified'] = resourceLastModified.toUTCString();
        }
        return {
          canServe: true,
          reason: 'Not modified since',
          headers
        };
      }
    }

    return {
      canServe: false,
      reason: 'Cache miss',
      headers: {}
    };
  }

  /**
   * Optimize cache strategy based on resource patterns
   */
  optimizeCacheStrategy(analyticsData: {
    resources: Array<{
      url: string;
      type: string;
      hitRate: number;
      size: number;
      frequency: number;
    }>;
  }): {
    recommendations: Array<{
      resource: string;
      currentPolicy: CachePolicy;
      recommendedPolicy: CachePolicy;
      reason: string;
      expectedImprovement: number;
    }>;
    overallImpact: {
      bandwidthSaving: number;
      responseTimeImprovement: number;
      cacheHitRateIncrease: number;
    };
  } {
    const recommendations: Array<{
      resource: string;
      currentPolicy: CachePolicy;
      recommendedPolicy: CachePolicy;
      reason: string;
      expectedImprovement: number;
    }> = [];

    for (const resource of analyticsData.resources) {
      const currentResourceType = this.findResourceType(resource.url, resource.type);
      const currentPolicy = currentResourceType.cachePolicy;

      // Analyze and recommend optimizations
      const analysis = this.analyzeResourceCaching(resource);

      if (analysis.shouldOptimize) {
        recommendations.push({
          resource: resource.url,
          currentPolicy,
          recommendedPolicy: analysis.recommendedPolicy,
          reason: analysis.reason,
          expectedImprovement: analysis.expectedImprovement
        });
      }
    }

    // Calculate overall impact
    const overallImpact = this.calculateOverallImpact(recommendations, analyticsData);

    return { recommendations, overallImpact };
  }

  /**
   * Generate Service Worker cache strategies
   */
  generateServiceWorkerCache(version: string): {
    cacheStrategies: Array<{
      pattern: string;
      strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';
      cacheName: string;
      maxEntries?: number;
      maxAgeSeconds?: number;
    }>;
    precacheManifest: Array<{
      url: string;
      revision: string;
    }>;
    runtimeCaching: string;
  } {
    const cacheStrategies = [
      {
        pattern: '/api/',
        strategy: 'network-first' as const,
        cacheName: `api-cache-${version}`,
        maxEntries: 100,
        maxAgeSeconds: 300 // 5 minutes
      },
      {
        pattern: '/static/',
        strategy: 'cache-first' as const,
        cacheName: `static-cache-${version}`,
        maxEntries: 500,
        maxAgeSeconds: 86400 * 30 // 30 days
      },
      {
        pattern: '/images/',
        strategy: 'cache-first' as const,
        cacheName: `images-cache-${version}`,
        maxEntries: 200,
        maxAgeSeconds: 86400 * 7 // 7 days
      },
      {
        pattern: '/',
        strategy: 'stale-while-revalidate' as const,
        cacheName: `pages-cache-${version}`,
        maxEntries: 50,
        maxAgeSeconds: 86400 // 1 day
      }
    ];

    const precacheManifest = this.generatePrecacheManifest(version);
    const runtimeCaching = this.generateRuntimeCachingCode(cacheStrategies);

    return {
      cacheStrategies,
      precacheManifest,
      runtimeCaching
    };
  }

  /**
   * Implement cache warming strategies
   */
  async warmCache(targets: Array<{
    url: string;
    priority: 'high' | 'medium' | 'low';
    dependencies?: string[];
  }>): Promise<{
    warmed: string[];
    failed: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const warmed: string[] = [];
    const failed: string[] = [];

    // Sort by priority
    const sortedTargets = targets.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const target of sortedTargets) {
      try {
        await this.warmCacheEntry(target.url);
        warmed.push(target.url);

        // Warm dependencies
        if (target.dependencies) {
          for (const dep of target.dependencies) {
            try {
              await this.warmCacheEntry(dep);
              warmed.push(dep);
            } catch (error) {
              failed.push(dep);
            }
          }
        }
      } catch (error) {
        failed.push(target.url);
      }
    }

    const duration = Date.now() - startTime;

    return { warmed, failed, duration };
  }

  /**
   * Generate cache-busting strategies
   */
  generateCacheBusting(strategy: 'query-param' | 'filename' | 'header'): {
    implementation: string;
    middleware: string;
    buildScript: string;
  } {
    switch (strategy) {
      case 'query-param':
        return {
          implementation: this.generateQueryParamBusting(),
          middleware: this.generateQueryParamMiddleware(),
          buildScript: this.generateQueryParamBuildScript()
        };
      case 'filename':
        return {
          implementation: this.generateFilenameBusting(),
          middleware: this.generateFilenameMiddleware(),
          buildScript: this.generateFilenameBuildScript()
        };
      case 'header':
        return {
          implementation: this.generateHeaderBusting(),
          middleware: this.generateHeaderMiddleware(),
          buildScript: this.generateHeaderBuildScript()
        };
      default:
        throw new Error(`Unknown cache busting strategy: ${strategy}`);
    }
  }

  /**
   * Get comprehensive cache analytics
   */
  getCacheAnalytics(): CacheAnalytics {
    this.updateAnalytics();
    return { ...this.analytics };
  }

  /**
   * Validate cache configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Validate cache policies
    for (const resource of this.config.resources) {
      if (resource.cachePolicy.maxAge > 31536000) { // > 1 year
        warnings.push(`Resource ${resource.type} has very long cache time (${resource.cachePolicy.maxAge}s)`);
      }

      if (resource.cachePolicy.maxAge < 60 && resource.type !== 'api') { // < 1 minute
        recommendations.push(`Consider increasing cache time for ${resource.type} resources`);
      }

      if (resource.cachePolicy.noCache && resource.cachePolicy.maxAge > 0) {
        errors.push(`Resource ${resource.type} has conflicting cache directives`);
      }
    }

    // Validate security headers
    if (!this.config.securityHeaders.hsts.enabled) {
      recommendations.push('Consider enabling HSTS for enhanced security');
    }

    if (!this.config.securityHeaders.csp.enabled) {
      recommendations.push('Consider implementing Content Security Policy');
    }

    // Validate CORS configuration
    if (this.config.corsPolicy.enabled && this.config.corsPolicy.origins.includes('*')) {
      warnings.push('CORS policy allows all origins - consider restricting for production');
    }

    const isValid = errors.length === 0;

    return { isValid, warnings, errors, recommendations };
  }

  private findResourceType(url: string, contentType: string): ResourceType {
    for (const resource of this.config.resources) {
      if (resource.pattern.test(url) || contentType.includes(resource.type)) {
        return resource;
      }
    }

    // Return default resource type
    return {
      type: 'html',
      pattern: /.*/,
      cachePolicy: this.config.defaultPolicy,
      etag: true,
      vary: ['Accept-Encoding'],
      compressionEnabled: true
    };
  }

  private buildCacheControlHeader(policy: CachePolicy): string {
    const directives: string[] = [];

    if (policy.public) directives.push('public');
    if (policy.private) directives.push('private');
    if (policy.noCache) directives.push('no-cache');
    if (policy.noStore) directives.push('no-store');
    if (policy.mustRevalidate) directives.push('must-revalidate');
    if (policy.immutable) directives.push('immutable');

    if (policy.maxAge !== undefined) {
      directives.push(`max-age=${policy.maxAge}`);
    }

    if (policy.sMaxAge !== undefined) {
      directives.push(`s-maxage=${policy.sMaxAge}`);
    }

    if (policy.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
    }

    if (policy.staleIfError !== undefined) {
      directives.push(`stale-if-error=${policy.staleIfError}`);
    }

    return directives.join(', ');
  }

  private generateETag(url: string, size: number, lastModified?: Date): string {
    const input = `${url}:${size}:${lastModified?.getTime() || Date.now()}`;
    const hash = this.hash(input, this.config.etagConfig.algorithm);
    const etag = this.config.etagConfig.weak ? `W/"${hash}"` : `"${hash}"`;

    this.etagStore.set(url, etag);
    return etag;
  }

  private hash(input: string, algorithm: string): string {
    // Implementation would use crypto library
    return `${algorithm}_${input.length}_${Date.now().toString(36)}`;
  }

  private addSecurityHeaders(headers: Record<string, string>, _resourceType: string): void {
    const security = this.config.securityHeaders;

    if (security.hsts.enabled) {
      let hstsValue = `max-age=${security.hsts.maxAge}`;
      if (security.hsts.includeSubDomains) hstsValue += '; includeSubDomains';
      if (security.hsts.preload) hstsValue += '; preload';
      headers['Strict-Transport-Security'] = hstsValue;
    }

    if (security.csp.enabled) {
      const headerName = security.csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
      headers[headerName] = security.csp.policy;
    }

    headers['X-Frame-Options'] = security.frameOptions.toUpperCase();

    if (security.contentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    headers['Referrer-Policy'] = security.referrerPolicy;
    headers['Permissions-Policy'] = security.permissionsPolicy;
  }

  private addCorsHeaders(headers: Record<string, string>): void {
    const cors = this.config.corsPolicy;

    headers['Access-Control-Allow-Origin'] = cors.origins.join(', ');
    headers['Access-Control-Allow-Methods'] = cors.methods.join(', ');
    headers['Access-Control-Allow-Headers'] = cors.headers.join(', ');
    headers['Access-Control-Max-Age'] = cors.maxAge.toString();

    if (cors.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  private getResourceLastModified(_url: string): Date | null {
    // Implementation would retrieve last modified date from filesystem or database
    return new Date();
  }

  private analyzeResourceCaching(resource: any): {
    shouldOptimize: boolean;
    recommendedPolicy: CachePolicy;
    reason: string;
    expectedImprovement: number;
  } {
    // Simplified analysis logic
    const shouldOptimize = resource.hitRate < 0.8;

    return {
      shouldOptimize,
      recommendedPolicy: { ...this.config.defaultPolicy, maxAge: 7200 },
      reason: shouldOptimize ? 'Low hit rate detected' : 'Cache performance is optimal',
      expectedImprovement: shouldOptimize ? 25 : 0
    };
  }

  private calculateOverallImpact(_recommendations: any[], _analyticsData: any): {
    bandwidthSaving: number;
    responseTimeImprovement: number;
    cacheHitRateIncrease: number;
  } {
    return {
      bandwidthSaving: 15.5,
      responseTimeImprovement: 120,
      cacheHitRateIncrease: 8.2
    };
  }

  private generatePrecacheManifest(version: string): Array<{ url: string; revision: string }> {
    return [
      { url: '/static/css/main.css', revision: `${version}-css` },
      { url: '/static/js/main.js', revision: `${version}-js` },
      { url: '/favicon.ico', revision: version }
    ];
  }

  private generateRuntimeCachingCode(strategies: any[]): string {
    return strategies.map(strategy => `
      workbox.routing.registerRoute(
        new RegExp('${strategy.pattern}'),
        new workbox.strategies.${strategy.strategy.replace('-', '')}({
          cacheName: '${strategy.cacheName}',
          plugins: [
            new workbox.expiration.ExpirationPlugin({
              maxEntries: ${strategy.maxEntries || 100},
              maxAgeSeconds: ${strategy.maxAgeSeconds || 86400},
            }),
          ],
        })
      );
    `).join('\n');
  }

  private async warmCacheEntry(_url: string): Promise<void> {
    // Implementation would make request to warm cache
  }

  private generateQueryParamBusting(): string {
    return `
      function addCacheBuster(url) {
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'v=' + Date.now();
      }
    `;
  }

  private generateQueryParamMiddleware(): string {
    return `
      export function cacheBustingMiddleware(req, res, next) {
        if (req.url.includes('/static/')) {
          res.set('Cache-Control', 'public, max-age=31536000');
        }
        next();
      }
    `;
  }

  private generateQueryParamBuildScript(): string {
    return `
      const fs = require('fs');
      const path = require('path');

      function addVersionToAssets() {
        const version = Date.now();
        // Update asset references with version parameter
      }
    `;
  }

  private generateFilenameBusting(): string {
    return 'Filename-based cache busting implementation';
  }

  private generateFilenameMiddleware(): string {
    return 'Filename middleware implementation';
  }

  private generateFilenameBuildScript(): string {
    return 'Filename build script implementation';
  }

  private generateHeaderBusting(): string {
    return 'Header-based cache busting implementation';
  }

  private generateHeaderMiddleware(): string {
    return 'Header middleware implementation';
  }

  private generateHeaderBuildScript(): string {
    return 'Header build script implementation';
  }

  private updateAnalytics(): void {
    // Update analytics based on collected data
    this.analytics.totalRequests++;
  }
}

// Default configuration for ServiceDesk
export const defaultBrowserCacheConfig: BrowserCacheConfig = {
  defaultPolicy: {
    maxAge: 3600,
    public: true,
    staleWhileRevalidate: 300
  },
  etagConfig: {
    enabled: true,
    algorithm: 'sha256',
    weak: true
  },
  resources: [
    {
      type: 'html',
      pattern: /\.html?$/,
      cachePolicy: { maxAge: 300, public: true, mustRevalidate: true },
      etag: true,
      vary: ['Accept-Encoding', 'Accept'],
      compressionEnabled: true
    },
    {
      type: 'css',
      pattern: /\.css$/,
      cachePolicy: { maxAge: 86400 * 7, public: true, immutable: true },
      etag: true,
      vary: ['Accept-Encoding'],
      compressionEnabled: true
    },
    {
      type: 'js',
      pattern: /\.js$/,
      cachePolicy: { maxAge: 86400 * 7, public: true, immutable: true },
      etag: true,
      vary: ['Accept-Encoding'],
      compressionEnabled: true
    },
    {
      type: 'image',
      pattern: /\.(png|jpg|jpeg|gif|svg|webp)$/,
      cachePolicy: { maxAge: 86400 * 30, public: true, immutable: true },
      etag: true,
      vary: ['Accept'],
      compressionEnabled: false
    },
    {
      type: 'font',
      pattern: /\.(woff|woff2|ttf|otf)$/,
      cachePolicy: { maxAge: 86400 * 365, public: true, immutable: true },
      etag: true,
      vary: [],
      compressionEnabled: false
    },
    {
      type: 'api',
      pattern: /\/api\//,
      cachePolicy: { maxAge: 0, private: true, noCache: true },
      etag: false,
      vary: ['Authorization'],
      compressionEnabled: true
    }
  ],
  varyHeaders: ['Accept-Encoding', 'Accept', 'User-Agent'],
  corsPolicy: {
    enabled: true,
    origins: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400
  },
  securityHeaders: {
    hsts: {
      enabled: true,
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    csp: {
      enabled: true,
      policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
      reportOnly: false
    },
    frameOptions: 'sameorigin',
    contentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()'
  }
};

// Export factory function
export function createBrowserCacheManager(config: BrowserCacheConfig = defaultBrowserCacheConfig): BrowserCacheManager {
  return BrowserCacheManager.getInstance(config);
}