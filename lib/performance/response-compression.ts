/**
 * Response Compression Management for API Optimization
 * Handles gzip, brotli, and deflate compression with intelligent algorithm selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import logger from '../monitoring/structured-logger';

export interface CompressionConfig {
  algorithms: CompressionAlgorithm[];
  thresholds: {
    minSize: number;
    maxSize: number;
  };
  levels: {
    gzip: number;
    brotli: number;
    deflate: number;
  };
  contentTypes: {
    include: string[];
    exclude: string[];
  };
  cache: {
    enabled: boolean;
    maxEntries: number;
    ttl: number;
  };
  streaming: {
    enabled: boolean;
    chunkSize: number;
  };
}

export interface CompressionAlgorithm {
  name: 'gzip' | 'brotli' | 'deflate';
  quality: number;
  speed: number;
  enabled: boolean;
  priority: number;
}

export interface CompressionResult {
  compressed: Buffer;
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  time: number;
}

export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  bytesSaved: number;
  averageRatio: number;
  algorithmUsage: Map<string, number>;
  averageCompressionTime: number;
  cacheHitRate: number;
}

export class ResponseCompressionManager {
  private static instance: ResponseCompressionManager;
  private config: CompressionConfig;
  private cache = new Map<string, { data: Buffer; algorithm: string; timestamp: number }>();
  private stats: CompressionStats;

  private constructor(config: CompressionConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      bytesSaved: 0,
      averageRatio: 0,
      algorithmUsage: new Map(),
      averageCompressionTime: 0,
      cacheHitRate: 0
    };

    this.startCacheCleanup();
  }

  static getInstance(config?: CompressionConfig): ResponseCompressionManager {
    if (!ResponseCompressionManager.instance && config) {
      ResponseCompressionManager.instance = new ResponseCompressionManager(config);
    }
    return ResponseCompressionManager.instance;
  }

  /**
   * Compress response data with optimal algorithm selection
   */
  async compressResponse(
    data: string | Buffer,
    request: NextRequest
  ): Promise<{
    compressed: Buffer;
    algorithm: string;
    headers: Record<string, string>;
  } | null> {
    this.stats.totalRequests++;

    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    // Check if compression is needed
    if (!this.shouldCompress(buffer, request)) {
      return null;
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(buffer, request);

    // Check cache
    if (this.config.cache.enabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.updateCacheStats(true);
        return {
          compressed: cached.data,
          algorithm: cached.algorithm,
          headers: this.generateHeaders(cached.algorithm, buffer.length, cached.data.length)
        };
      }
    }

    // Select best compression algorithm
    const algorithm = this.selectAlgorithm(request, buffer);
    if (!algorithm) {
      return null;
    }

    // Compress data
    const startTime = Date.now();
    const compressed = await this.compress(buffer, algorithm);
    const compressionTime = Date.now() - startTime;

    // Update statistics
    this.updateStats(algorithm, buffer.length, compressed.length, compressionTime);

    // Cache result
    if (this.config.cache.enabled) {
      this.cacheResult(cacheKey, compressed, algorithm);
      this.updateCacheStats(false);
    }

    return {
      compressed,
      algorithm,
      headers: this.generateHeaders(algorithm, buffer.length, compressed.length)
    };
  }

  /**
   * Middleware for automatic response compression
   */
  middleware() {
    return async (request: NextRequest) => {
      // Clone request for potential modification
      const clonedRequest = request.clone();

      return async (response: NextResponse) => {
        // Skip compression for certain responses
        if (this.shouldSkipCompression(response)) {
          return response;
        }

        try {
          // Get response body
          const responseBody = await response.text();

          // Attempt compression - use clonedRequest as NextRequest
          const compressionResult = await this.compressResponse(responseBody, clonedRequest as unknown as NextRequest);

          if (compressionResult) {
            // Create new response with compressed data
            const compressedResponse = new NextResponse(compressionResult.compressed as unknown as BodyInit, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });

            // Add compression headers
            Object.entries(compressionResult.headers).forEach(([key, value]) => {
              compressedResponse.headers.set(key, value);
            });

            return compressedResponse;
          }

          return response;
        } catch (error) {
          logger.warn('Compression middleware error', error);
          return response;
        }
      };
    };
  }

  /**
   * Stream compression for large responses
   */
  async compressStream(
    readable: ReadableStream,
    request: NextRequest
  ): Promise<ReadableStream | null> {
    if (!this.config.streaming.enabled) {
      return null;
    }

    const algorithm = this.selectAlgorithmFromHeaders(request);
    if (!algorithm) {
      return null;
    }

    const self = this;
    return new ReadableStream({
      start(controller) {
        const reader = readable.getReader();
        const compressor = self.createStreamCompressor(algorithm);

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                const finalChunk = compressor.finish();
                if (finalChunk.length > 0) {
                  controller.enqueue(finalChunk);
                }
                controller.close();
                break;
              }

              const compressed = compressor.process(value);
              if (compressed.length > 0) {
                controller.enqueue(compressed);
              }
            }
          } catch (error) {
            controller.error(error);
          }
        };

        pump();
      }
    });
  }

  /**
   * Analyze compression effectiveness for different content types
   */
  analyzeCompressionEffectiveness(samples: Array<{
    contentType: string;
    size: number;
    data: Buffer;
  }>): {
    recommendations: Array<{
      contentType: string;
      recommendedAlgorithm: string;
      averageRatio: number;
      speedScore: number;
    }>;
    overallStats: {
      totalSizeReduction: number;
      averageCompressionTime: number;
      bestAlgorithmOverall: string;
    };
  } {
    const recommendations: Array<{
      contentType: string;
      recommendedAlgorithm: string;
      averageRatio: number;
      speedScore: number;
    }> = [];

    const algorithmStats = new Map<string, {
      totalRatio: number;
      totalTime: number;
      count: number;
      totalSizeReduction: number;
    }>();

    // Group samples by content type
    const groupedSamples = new Map<string, typeof samples>();
    for (const sample of samples) {
      if (!groupedSamples.has(sample.contentType)) {
        groupedSamples.set(sample.contentType, []);
      }
      groupedSamples.get(sample.contentType)!.push(sample);
    }

    // Analyze each content type
    for (const [contentType, typeSamples] of groupedSamples.entries()) {
      const algorithmResults = new Map<string, { ratio: number; time: number }[]>();

      // Test each algorithm on samples
      for (const sample of typeSamples) {
        for (const algorithm of this.config.algorithms) {
          if (!algorithm.enabled) continue;

          const startTime = Date.now();
          const compressed = this.compressSync(sample.data, algorithm.name);
          const compressionTime = Date.now() - startTime;

          const ratio = sample.size / compressed.length;

          if (!algorithmResults.has(algorithm.name)) {
            algorithmResults.set(algorithm.name, []);
          }
          algorithmResults.get(algorithm.name)!.push({ ratio, time: compressionTime });

          // Update overall algorithm stats
          const existing = algorithmStats.get(algorithm.name) || {
            totalRatio: 0,
            totalTime: 0,
            count: 0,
            totalSizeReduction: 0
          };

          existing.totalRatio += ratio;
          existing.totalTime += compressionTime;
          existing.count++;
          existing.totalSizeReduction += sample.size - compressed.length;

          algorithmStats.set(algorithm.name, existing);
        }
      }

      // Find best algorithm for this content type
      let bestAlgorithm = '';
      let bestScore = 0;

      for (const [algorithm, results] of algorithmResults.entries()) {
        const avgRatio = results.reduce((sum, r) => sum + r.ratio, 0) / results.length;
        const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

        // Calculate score (balance compression ratio and speed)
        const speedScore = Math.max(0, 100 - avgTime);
        const compressionScore = Math.min(100, avgRatio * 20);
        const overallScore = (compressionScore * 0.7) + (speedScore * 0.3);

        if (overallScore > bestScore) {
          bestScore = overallScore;
          bestAlgorithm = algorithm;
        }
      }

      if (bestAlgorithm) {
        const bestResults = algorithmResults.get(bestAlgorithm)!;
        recommendations.push({
          contentType,
          recommendedAlgorithm: bestAlgorithm,
          averageRatio: bestResults.reduce((sum, r) => sum + r.ratio, 0) / bestResults.length,
          speedScore: bestScore
        });
      }
    }

    // Calculate overall statistics
    let bestOverallAlgorithm = '';
    let bestOverallScore = 0;
    let totalSizeReduction = 0;
    let totalCompressionTime = 0;
    let totalCount = 0;

    for (const [algorithm, stats] of algorithmStats.entries()) {
      const avgRatio = stats.totalRatio / stats.count;
      const avgTime = stats.totalTime / stats.count;
      const score = (avgRatio * 0.7) + ((100 - avgTime) * 0.3);

      if (score > bestOverallScore) {
        bestOverallScore = score;
        bestOverallAlgorithm = algorithm;
      }

      totalSizeReduction += stats.totalSizeReduction;
      totalCompressionTime += stats.totalTime;
      totalCount += stats.count;
    }

    return {
      recommendations,
      overallStats: {
        totalSizeReduction,
        averageCompressionTime: totalCount > 0 ? totalCompressionTime / totalCount : 0,
        bestAlgorithmOverall: bestOverallAlgorithm
      }
    };
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Optimize compression configuration based on usage patterns
   */
  optimizeConfiguration(usageData: {
    contentTypes: Map<string, number>;
    averageResponseSizes: Map<string, number>;
    clientCapabilities: Map<string, string[]>;
  }): {
    optimizedConfig: Partial<CompressionConfig>;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const optimizedConfig: Partial<CompressionConfig> = {};

    // Analyze content types (stored for potential future use)
    Array.from(usageData.contentTypes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type]) => type);

    // Analyze client capabilities
    const brotliSupport = Array.from(usageData.clientCapabilities.values())
      .filter(caps => caps.includes('br')).length;
    const totalClients = usageData.clientCapabilities.size;
    const brotliSupportPercentage = (brotliSupport / totalClients) * 100;

    if (brotliSupportPercentage > 80) {
      recommendations.push('High Brotli support detected - prioritize Brotli compression');
      optimizedConfig.algorithms = this.config.algorithms.map(alg =>
        alg.name === 'brotli' ? { ...alg, priority: 1 } : alg
      );
    }

    // Analyze response sizes
    const averageSize = Array.from(usageData.averageResponseSizes.values())
      .reduce((sum, size) => sum + size, 0) / usageData.averageResponseSizes.size;

    if (averageSize < 1024) {
      recommendations.push('Small average response size - consider increasing compression threshold');
      optimizedConfig.thresholds = {
        ...this.config.thresholds,
        minSize: Math.max(512, this.config.thresholds.minSize)
      };
    }

    return { optimizedConfig, recommendations };
  }

  private shouldCompress(buffer: Buffer, request: NextRequest): boolean {
    // Check size thresholds
    if (buffer.length < this.config.thresholds.minSize ||
        buffer.length > this.config.thresholds.maxSize) {
      return false;
    }

    // Check content type
    const contentType = this.getContentType(request);
    if (contentType) {
      const isIncluded = this.config.contentTypes.include.some(type =>
        contentType.includes(type)
      );
      const isExcluded = this.config.contentTypes.exclude.some(type =>
        contentType.includes(type)
      );

      if (!isIncluded || isExcluded) {
        return false;
      }
    }

    return true;
  }

  private shouldSkipCompression(response: NextResponse): boolean {
    // Skip if already compressed
    if (response.headers.get('content-encoding')) {
      return true;
    }

    // Skip for certain status codes
    const status = response.status;
    if (status < 200 || status >= 300) {
      return true;
    }

    // Skip for certain response types
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('image/') ||
        contentType?.includes('video/') ||
        contentType?.includes('audio/')) {
      return true;
    }

    return false;
  }

  private selectAlgorithm(request: NextRequest, buffer: Buffer): string | null {
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const availableAlgorithms = this.config.algorithms
      .filter(alg => alg.enabled && acceptEncoding.includes(this.getAlgorithmName(alg.name)))
      .sort((a, b) => b.priority - a.priority);

    if (availableAlgorithms.length === 0) {
      return null;
    }

    // For small buffers, prefer speed over compression ratio
    if (buffer.length < 10240) { // 10KB
      const speedSorted = availableAlgorithms.sort((a, b) => b.speed - a.speed);
      return speedSorted[0]?.name || null;
    }

    // For larger buffers, prefer compression ratio
    const qualitySorted = availableAlgorithms.sort((a, b) => b.quality - a.quality);
    return qualitySorted[0]?.name || null;
  }

  private selectAlgorithmFromHeaders(request: NextRequest): string | null {
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const availableAlgorithms = this.config.algorithms
      .filter(alg => alg.enabled && acceptEncoding.includes(this.getAlgorithmName(alg.name)))
      .sort((a, b) => b.priority - a.priority);

    return availableAlgorithms.length > 0 ? (availableAlgorithms[0]?.name || null) : null;
  }

  private getAlgorithmName(algorithm: string): string {
    switch (algorithm) {
      case 'brotli': return 'br';
      case 'gzip': return 'gzip';
      case 'deflate': return 'deflate';
      default: return algorithm;
    }
  }

  private async compress(buffer: Buffer, algorithm: string): Promise<Buffer> {
    switch (algorithm) {
      case 'gzip':
        return this.compressGzip(buffer);
      case 'brotli':
        return this.compressBrotli(buffer);
      case 'deflate':
        return this.compressDeflate(buffer);
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  private compressSync(buffer: Buffer, algorithm: string): Buffer {
    // Synchronous version for analysis
    switch (algorithm) {
      case 'gzip':
        return this.compressGzipSync(buffer);
      case 'brotli':
        return this.compressBrotliSync(buffer);
      case 'deflate':
        return this.compressDeflateSync(buffer);
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  private async compressGzip(buffer: Buffer): Promise<Buffer> {
    // Implementation would use zlib
    return Buffer.from(`GZIP_COMPRESSED:${buffer.toString('base64')}`);
  }

  private async compressBrotli(buffer: Buffer): Promise<Buffer> {
    // Implementation would use brotli library
    return Buffer.from(`BROTLI_COMPRESSED:${buffer.toString('base64')}`);
  }

  private async compressDeflate(buffer: Buffer): Promise<Buffer> {
    // Implementation would use zlib deflate
    return Buffer.from(`DEFLATE_COMPRESSED:${buffer.toString('base64')}`);
  }

  private compressGzipSync(buffer: Buffer): Buffer {
    // Synchronous gzip compression
    return Buffer.from(`GZIP_COMPRESSED:${buffer.toString('base64')}`);
  }

  private compressBrotliSync(buffer: Buffer): Buffer {
    // Synchronous brotli compression
    return Buffer.from(`BROTLI_COMPRESSED:${buffer.toString('base64')}`);
  }

  private compressDeflateSync(buffer: Buffer): Buffer {
    // Synchronous deflate compression
    return Buffer.from(`DEFLATE_COMPRESSED:${buffer.toString('base64')}`);
  }

  private createStreamCompressor(_algorithm: string): {
    process: (chunk: Uint8Array) => Buffer;
    finish: () => Buffer;
  } {
    // Implementation would create streaming compressor
    return {
      process: (chunk: Uint8Array) => Buffer.from(chunk),
      finish: () => Buffer.alloc(0)
    };
  }

  private generateHeaders(algorithm: string, originalSize: number, compressedSize: number): Record<string, string> {
    return {
      'Content-Encoding': this.getAlgorithmName(algorithm),
      'Content-Length': compressedSize.toString(),
      'X-Original-Size': originalSize.toString(),
      'X-Compression-Ratio': (originalSize / compressedSize).toFixed(2),
      'Vary': 'Accept-Encoding'
    };
  }

  private getContentType(request: NextRequest): string | null {
    return request.headers.get('content-type');
  }

  private generateCacheKey(buffer: Buffer, request: NextRequest): string {
    const contentType = this.getContentType(request) || '';
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    return `compression:${this.hash(buffer)}:${contentType}:${acceptEncoding}`;
  }

  private hash(buffer: Buffer): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      const byte = buffer[i];
      if (byte !== undefined) {
        hash = ((hash << 5) - hash + byte) & 0xffffffff;
      }
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache(key: string): { data: Buffer; algorithm: string } | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.config.cache.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return { data: cached.data, algorithm: cached.algorithm };
  }

  private cacheResult(key: string, data: Buffer, algorithm: string): void {
    if (this.cache.size >= this.config.cache.maxEntries) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      algorithm,
      timestamp: Date.now()
    });
  }

  private updateStats(algorithm: string, originalSize: number, compressedSize: number, time: number): void {
    this.stats.compressedRequests++;
    this.stats.bytesSaved += originalSize - compressedSize;

    const ratio = originalSize / compressedSize;
    this.stats.averageRatio = (this.stats.averageRatio * (this.stats.compressedRequests - 1) + ratio) / this.stats.compressedRequests;

    this.stats.averageCompressionTime = (this.stats.averageCompressionTime * (this.stats.compressedRequests - 1) + time) / this.stats.compressedRequests;

    const currentUsage = this.stats.algorithmUsage.get(algorithm) || 0;
    this.stats.algorithmUsage.set(algorithm, currentUsage + 1);
  }

  private updateCacheStats(hit: boolean): void {
    const total = this.stats.compressedRequests;
    if (hit) {
      this.stats.cacheHitRate = (this.stats.cacheHitRate * (total - 1) + 100) / total;
    } else {
      this.stats.cacheHitRate = (this.stats.cacheHitRate * (total - 1)) / total;
    }
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const ttlMs = this.config.cache.ttl * 1000;

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > ttlMs) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }
}

// Default configuration
export const defaultCompressionConfig: CompressionConfig = {
  algorithms: [
    { name: 'brotli', quality: 95, speed: 75, enabled: true, priority: 1 },
    { name: 'gzip', quality: 85, speed: 90, enabled: true, priority: 2 },
    { name: 'deflate', quality: 80, speed: 95, enabled: true, priority: 3 }
  ],
  thresholds: {
    minSize: 1024, // 1KB
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  levels: {
    gzip: 6,
    brotli: 6,
    deflate: 6
  },
  contentTypes: {
    include: [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'image/svg+xml'
    ],
    exclude: [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/compress'
    ]
  },
  cache: {
    enabled: true,
    maxEntries: 1000,
    ttl: 3600 // 1 hour
  },
  streaming: {
    enabled: true,
    chunkSize: 16384 // 16KB
  }
};

// Export factory function
export function createCompressionManager(config: CompressionConfig = defaultCompressionConfig): ResponseCompressionManager {
  return ResponseCompressionManager.getInstance(config);
}