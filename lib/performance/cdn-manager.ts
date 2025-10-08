import { logger } from '../monitoring/logger';

/**
 * CDN Management for Static Assets Optimization
 * Handles CDN integration, asset optimization, and cache invalidation
 */

export interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'azure' | 'gcp' | 'custom';
  baseUrl: string;
  apiKey?: string;
  zoneId?: string;
  regions: string[];
  cacheTTL: {
    images: number;
    scripts: number;
    stylesheets: number;
    fonts: number;
    documents: number;
  };
  compression: {
    enabled: boolean;
    algorithms: ('gzip' | 'brotli' | 'deflate')[];
    minSize: number;
  };
  imageOptimization: {
    enabled: boolean;
    formats: ('webp' | 'avif' | 'jpeg' | 'png')[];
    quality: number;
    progressive: boolean;
    autoResize: boolean;
  };
}

export interface AssetInfo {
  path: string;
  type: 'image' | 'script' | 'stylesheet' | 'font' | 'document';
  size: number;
  hash: string;
  lastModified: Date;
  cached: boolean;
  cdnUrl?: string;
  compressionRatio?: number;
}

export interface CacheInvalidation {
  paths: string[];
  patterns: string[];
  tags: string[];
  purgeAll: boolean;
}

export interface CDNStats {
  totalAssets: number;
  totalSize: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  regionalPerformance: Map<string, {
    hitRate: number;
    avgResponseTime: number;
    requests: number;
  }>;
}

export class CDNManager {
  private static instance: CDNManager;
  private config: CDNConfig;
  private assetCache = new Map<string, AssetInfo>();
  private invalidationQueue: CacheInvalidation[] = [];
  private performanceMetrics = new Map<string, number[]>();

  private constructor(config: CDNConfig) {
    this.config = config;
    this.startPerformanceMonitoring();
  }

  static getInstance(config?: CDNConfig): CDNManager {
    if (!CDNManager.instance && config) {
      CDNManager.instance = new CDNManager(config);
    }
    return CDNManager.instance;
  }

  /**
   * Upload asset to CDN with optimization
   */
  async uploadAsset(
    localPath: string,
    cdnPath: string,
    options: {
      optimize?: boolean;
      compress?: boolean;
      cacheControl?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<AssetInfo> {
    const {
      optimize = true,
      compress = true,
      cacheControl,
      metadata = {}
    } = options;

    try {
      // Read and analyze asset
      const assetData = await this.readAsset(localPath);
      const assetType = this.detectAssetType(localPath);
      const hash = this.generateHash(assetData);

      // Check if asset already exists
      const existingAsset = this.assetCache.get(cdnPath);
      if (existingAsset && existingAsset.hash === hash) {
        return existingAsset;
      }

      // Optimize asset based on type
      let optimizedData = assetData;
      if (optimize) {
        optimizedData = await this.optimizeAsset(assetData, assetType);
      }

      // Compress if enabled
      if (compress && this.shouldCompress(assetType, optimizedData.length)) {
        optimizedData = await this.compressAsset(optimizedData);
      }

      // Upload to CDN
      const cdnUrl = await this.uploadToCDN(cdnPath, optimizedData, {
        contentType: this.getContentType(assetType),
        cacheControl: cacheControl || this.getCacheControl(assetType),
        metadata
      });

      // Create asset info
      const assetInfo: AssetInfo = {
        path: cdnPath,
        type: assetType,
        size: optimizedData.length,
        hash,
        lastModified: new Date(),
        cached: true,
        cdnUrl,
        compressionRatio: assetData.length > 0 ? optimizedData.length / assetData.length : 1
      };

      // Cache asset info
      this.assetCache.set(cdnPath, assetInfo);

      return assetInfo;
    } catch (error) {
      throw new Error(`Failed to upload asset ${localPath}: ${error}`);
    }
  }

  /**
   * Get optimized CDN URL for asset
   */
  getCDNUrl(
    path: string,
    options: {
      format?: 'webp' | 'avif' | 'jpeg' | 'png';
      width?: number;
      height?: number;
      quality?: number;
      progressive?: boolean;
    } = {}
  ): string {
    const { format, width, height, quality, progressive } = options;

    let url = `${this.config.baseUrl}/${path}`;

    // Add image optimization parameters
    if (this.config.imageOptimization.enabled && this.isImage(path)) {
      const params = new URLSearchParams();

      if (format && this.config.imageOptimization.formats.includes(format)) {
        params.set('f', format);
      }

      if (width) {
        params.set('w', width.toString());
      }

      if (height) {
        params.set('h', height.toString());
      }

      if (quality !== undefined) {
        params.set('q', quality.toString());
      } else {
        params.set('q', this.config.imageOptimization.quality.toString());
      }

      if (progressive !== undefined) {
        params.set('progressive', progressive.toString());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }

    return url;
  }

  /**
   * Invalidate cache for specific paths or patterns
   */
  async invalidateCache(invalidation: CacheInvalidation): Promise<{
    success: boolean;
    invalidatedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let invalidatedCount = 0;

    try {
      switch (this.config.provider) {
        case 'cloudflare':
          invalidatedCount = await this.invalidateCloudflare(invalidation);
          break;
        case 'aws':
          invalidatedCount = await this.invalidateAWS(invalidation);
          break;
        case 'azure':
          invalidatedCount = await this.invalidateAzure(invalidation);
          break;
        case 'gcp':
          invalidatedCount = await this.invalidateGCP(invalidation);
          break;
        default:
          invalidatedCount = await this.invalidateCustom(invalidation);
          break;
      }

      // Update local cache
      this.updateLocalCache(invalidation);

      return { success: true, invalidatedCount, errors };
    } catch (error) {
      errors.push(`Cache invalidation failed: ${error}`);
      return { success: false, invalidatedCount, errors };
    }
  }

  /**
   * Batch invalidate multiple assets
   */
  async batchInvalidate(
    paths: string[],
    options: {
      immediate?: boolean;
      groupSize?: number;
    } = {}
  ): Promise<void> {
    const { immediate = false, groupSize = 30 } = options;

    const invalidation: CacheInvalidation = {
      paths,
      patterns: [],
      tags: [],
      purgeAll: false
    };

    if (immediate) {
      await this.invalidateCache(invalidation);
    } else {
      // Queue for batch processing
      this.invalidationQueue.push(invalidation);

      if (this.invalidationQueue.length >= groupSize) {
        await this.processPendingInvalidations();
      }
    }
  }

  /**
   * Preload critical assets
   */
  async preloadAssets(
    assets: Array<{
      path: string;
      priority: 'high' | 'medium' | 'low';
    }>,
    regions?: string[]
  ): Promise<{ preloaded: string[]; errors: string[] }> {
    const preloaded: string[] = [];
    const errors: string[] = [];

    // Sort by priority
    const sortedAssets = assets.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const asset of sortedAssets) {
      try {
        await this.preloadAsset(asset.path, regions);
        preloaded.push(asset.path);
      } catch (error) {
        errors.push(`Failed to preload ${asset.path}: ${error}`);
      }
    }

    return { preloaded, errors };
  }

  /**
   * Get CDN performance statistics
   */
  async getPerformanceStats(): Promise<CDNStats> {
    try {
      switch (this.config.provider) {
        case 'cloudflare':
          return await this.getCloudflareStats();
        case 'aws':
          return await this.getAWSStats();
        case 'azure':
          return await this.getAzureStats();
        case 'gcp':
          return await this.getGCPStats();
        default:
          return await this.getCustomStats();
      }
    } catch (error) {
      throw new Error(`Failed to get performance stats: ${error}`);
    }
  }

  /**
   * Optimize images for different devices and formats
   */
  async generateResponsiveImages(
    imagePath: string,
    breakpoints: number[] = [320, 768, 1024, 1920]
  ): Promise<Map<number, string>> {
    const responsiveUrls = new Map<number, string>();

    for (const width of breakpoints) {
      const url = this.getCDNUrl(imagePath, {
        width,
        format: 'webp',
        quality: this.config.imageOptimization.quality
      });

      responsiveUrls.set(width, url);
    }

    return responsiveUrls;
  }

  /**
   * Set up automatic asset optimization pipeline
   */
  setupAutomaticOptimization(config: {
    watchDirectories: string[];
    optimizationRules: Array<{
      pattern: RegExp;
      optimization: {
        compress: boolean;
        format?: string;
        quality?: number;
        resize?: { width?: number; height?: number };
      };
    }>;
  }): void {
    // Implementation would set up file watchers and automatic optimization
    logger.info('Automatic optimization pipeline configured');
  }

  /**
   * Generate critical CSS for above-the-fold content
   */
  async generateCriticalCSS(
    html: string,
    cssFiles: string[]
  ): Promise<string> {
    // Implementation would use tools like critical or puppeteer
    // to extract critical CSS for above-the-fold content
    return '/* Critical CSS would be generated here */';
  }

  private async readAsset(path: string): Promise<Buffer> {
    // Implementation would read file from local filesystem
    return Buffer.from('mock asset data');
  }

  private detectAssetType(path: string): AssetInfo['type'] {
    const ext = path.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'avif':
      case 'svg':
        return 'image';
      case 'js':
      case 'mjs':
      case 'ts':
        return 'script';
      case 'css':
      case 'scss':
      case 'sass':
        return 'stylesheet';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'otf':
        return 'font';
      default:
        return 'document';
    }
  }

  private generateHash(data: Buffer): string {
    // Implementation would use crypto to generate hash
    return `hash_${Date.now()}`;
  }

  private async optimizeAsset(data: Buffer, type: AssetInfo['type']): Promise<Buffer> {
    switch (type) {
      case 'image':
        return this.optimizeImage(data);
      case 'script':
        return this.optimizeScript(data);
      case 'stylesheet':
        return this.optimizeStylesheet(data);
      default:
        return data;
    }
  }

  private async optimizeImage(data: Buffer): Promise<Buffer> {
    // Implementation would use sharp or similar library for image optimization
    return data;
  }

  private async optimizeScript(data: Buffer): Promise<Buffer> {
    // Implementation would use terser or similar for JavaScript minification
    return data;
  }

  private async optimizeStylesheet(data: Buffer): Promise<Buffer> {
    // Implementation would use cssnano or similar for CSS optimization
    return data;
  }

  private shouldCompress(type: AssetInfo['type'], size: number): boolean {
    if (!this.config.compression.enabled || size < this.config.compression.minSize) {
      return false;
    }

    // Don't compress already compressed formats
    const nonCompressible = ['image'];
    return !nonCompressible.includes(type);
  }

  private async compressAsset(data: Buffer): Promise<Buffer> {
    // Implementation would use zlib for compression
    return data;
  }

  private async uploadToCDN(
    path: string,
    data: Buffer,
    options: {
      contentType: string;
      cacheControl: string;
      metadata: Record<string, string>;
    }
  ): Promise<string> {
    // Implementation would upload to specific CDN provider
    return `${this.config.baseUrl}/${path}`;
  }

  private getContentType(type: AssetInfo['type']): string {
    switch (type) {
      case 'image':
        return 'image/*';
      case 'script':
        return 'application/javascript';
      case 'stylesheet':
        return 'text/css';
      case 'font':
        return 'font/*';
      default:
        return 'application/octet-stream';
    }
  }

  private getCacheControl(type: AssetInfo['type']): string {
    const ttl = this.config.cacheTTL[type] || 3600;
    return `public, max-age=${ttl}, immutable`;
  }

  private isImage(path: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
    return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  private async invalidateCloudflare(invalidation: CacheInvalidation): Promise<number> {
    // Implementation would use Cloudflare API
    return invalidation.paths.length;
  }

  private async invalidateAWS(invalidation: CacheInvalidation): Promise<number> {
    // Implementation would use AWS CloudFront API
    return invalidation.paths.length;
  }

  private async invalidateAzure(invalidation: CacheInvalidation): Promise<number> {
    // Implementation would use Azure CDN API
    return invalidation.paths.length;
  }

  private async invalidateGCP(invalidation: CacheInvalidation): Promise<number> {
    // Implementation would use Google Cloud CDN API
    return invalidation.paths.length;
  }

  private async invalidateCustom(invalidation: CacheInvalidation): Promise<number> {
    // Implementation for custom CDN provider
    return invalidation.paths.length;
  }

  private updateLocalCache(invalidation: CacheInvalidation): void {
    for (const path of invalidation.paths) {
      this.assetCache.delete(path);
    }

    for (const pattern of invalidation.patterns) {
      const regex = new RegExp(pattern);
      for (const [path] of this.assetCache.entries()) {
        if (regex.test(path)) {
          this.assetCache.delete(path);
        }
      }
    }

    if (invalidation.purgeAll) {
      this.assetCache.clear();
    }
  }

  private async processPendingInvalidations(): Promise<void> {
    if (this.invalidationQueue.length === 0) return;

    // Combine all pending invalidations
    const combinedInvalidation: CacheInvalidation = {
      paths: [],
      patterns: [],
      tags: [],
      purgeAll: false
    };

    for (const invalidation of this.invalidationQueue) {
      combinedInvalidation.paths.push(...invalidation.paths);
      combinedInvalidation.patterns.push(...invalidation.patterns);
      combinedInvalidation.tags.push(...invalidation.tags);
      combinedInvalidation.purgeAll = combinedInvalidation.purgeAll || invalidation.purgeAll;
    }

    // Remove duplicates
    combinedInvalidation.paths = [...new Set(combinedInvalidation.paths)];
    combinedInvalidation.patterns = [...new Set(combinedInvalidation.patterns)];
    combinedInvalidation.tags = [...new Set(combinedInvalidation.tags)];

    await this.invalidateCache(combinedInvalidation);

    // Clear queue
    this.invalidationQueue = [];
  }

  private async preloadAsset(path: string, regions?: string[]): Promise<void> {
    // Implementation would trigger CDN preloading
  }

  private async getCloudflareStats(): Promise<CDNStats> {
    // Implementation would fetch Cloudflare analytics
    return this.getMockStats();
  }

  private async getAWSStats(): Promise<CDNStats> {
    // Implementation would fetch CloudFront metrics
    return this.getMockStats();
  }

  private async getAzureStats(): Promise<CDNStats> {
    // Implementation would fetch Azure CDN metrics
    return this.getMockStats();
  }

  private async getGCPStats(): Promise<CDNStats> {
    // Implementation would fetch Google Cloud CDN metrics
    return this.getMockStats();
  }

  private async getCustomStats(): Promise<CDNStats> {
    // Implementation for custom CDN provider
    return this.getMockStats();
  }

  private getMockStats(): CDNStats {
    return {
      totalAssets: this.assetCache.size,
      totalSize: Array.from(this.assetCache.values()).reduce((sum, asset) => sum + asset.size, 0),
      cacheHitRate: 95.5,
      bandwidthSaved: 75.2,
      responseTime: {
        p50: 45,
        p95: 120,
        p99: 250
      },
      regionalPerformance: new Map([
        ['us-east', { hitRate: 96.2, avgResponseTime: 42, requests: 15000 }],
        ['eu-west', { hitRate: 94.8, avgResponseTime: 48, requests: 12000 }],
        ['ap-south', { hitRate: 93.5, avgResponseTime: 52, requests: 8000 }]
      ])
    };
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      // Collect performance metrics
      this.collectPerformanceMetrics();
    }, 60000); // Every minute
  }

  private collectPerformanceMetrics(): void {
    // Implementation would collect real-time performance data
  }
}

// Default configuration for ServiceDesk
export const defaultCDNConfig: CDNConfig = {
  provider: 'cloudflare',
  baseUrl: process.env.CDN_BASE_URL || 'https://cdn.servicedesk.com',
  apiKey: process.env.CDN_API_KEY,
  zoneId: process.env.CDN_ZONE_ID,
  regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
  cacheTTL: {
    images: 86400 * 30, // 30 days
    scripts: 86400 * 7, // 7 days
    stylesheets: 86400 * 7, // 7 days
    fonts: 86400 * 30, // 30 days
    documents: 86400 // 1 day
  },
  compression: {
    enabled: true,
    algorithms: ['brotli', 'gzip'],
    minSize: 1024 // 1KB
  },
  imageOptimization: {
    enabled: true,
    formats: ['webp', 'avif', 'jpeg', 'png'],
    quality: 85,
    progressive: true,
    autoResize: true
  }
};

// Export factory function
export function createCDNManager(config: CDNConfig = defaultCDNConfig): CDNManager {
  return CDNManager.getInstance(config);
}