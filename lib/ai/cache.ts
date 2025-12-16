import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  modelVersion?: string;
}

/**
 * Centralized AI cache manager for embeddings, classifications, and search results
 * Prevents duplicate cache implementations across AI modules
 */
class AICache {
  private embeddingCache: LRUCache<string, CacheEntry<number[]>>;
  private classificationCache: LRUCache<string, CacheEntry<any>>;
  private searchCache: LRUCache<string, CacheEntry<any[]>>;

  constructor() {
    // Embedding cache: 10,000 entries, 1 hour TTL
    this.embeddingCache = new LRUCache({
      max: 10000,
      ttl: 60 * 60 * 1000, // 1 hour
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Classification cache: 5,000 entries, 5 minutes TTL
    this.classificationCache = new LRUCache({
      max: 5000,
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Search results cache: 1,000 entries, 5 minutes TTL
    this.searchCache = new LRUCache({
      max: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
  }

  /**
   * Generate a consistent cache key from data
   */
  generateKey(data: any, prefix: string = ''): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return prefix + crypto.createHash('sha256').update(normalized).digest('hex');
  }

  // ==================== Embeddings ====================

  /**
   * Get cached embedding
   */
  getEmbedding(content: string, model: string): number[] | null {
    const key = this.generateKey({ content, model }, 'emb_');
    const entry = this.embeddingCache.get(key);
    return entry?.data || null;
  }

  /**
   * Cache an embedding
   */
  setEmbedding(content: string, model: string, embedding: number[]): void {
    const key = this.generateKey({ content, model }, 'emb_');
    this.embeddingCache.set(key, {
      data: embedding,
      timestamp: Date.now(),
      modelVersion: model
    });
  }

  /**
   * Clear embeddings cache
   */
  clearEmbeddings(): number {
    const count = this.embeddingCache.size;
    this.embeddingCache.clear();
    return count;
  }

  /**
   * Get embeddings cache stats
   */
  getEmbeddingStats(): { size: number; max: number } {
    return {
      size: this.embeddingCache.size,
      max: this.embeddingCache.max
    };
  }

  // ==================== Classifications ====================

  /**
   * Get cached classification result
   */
  getClassification(text: string): any | null {
    const key = this.generateKey({ text }, 'cls_');
    const entry = this.classificationCache.get(key);
    return entry?.data || null;
  }

  /**
   * Cache a classification result
   */
  setClassification(text: string, classification: any): void {
    const key = this.generateKey({ text }, 'cls_');
    this.classificationCache.set(key, {
      data: classification,
      timestamp: Date.now()
    });
  }

  /**
   * Clear classifications cache
   */
  clearClassifications(): number {
    const count = this.classificationCache.size;
    this.classificationCache.clear();
    return count;
  }

  /**
   * Get classifications cache stats
   */
  getClassificationStats(): { size: number; max: number } {
    return {
      size: this.classificationCache.size,
      max: this.classificationCache.max
    };
  }

  // ==================== Search Results ====================

  /**
   * Get cached search results
   */
  getSearchResults(query: string, filters?: any): any[] | null {
    const key = this.generateKey({ query, filters }, 'src_');
    const entry = this.searchCache.get(key);
    return entry?.data || null;
  }

  /**
   * Cache search results
   */
  setSearchResults(query: string, results: any[], filters?: any): void {
    const key = this.generateKey({ query, filters }, 'src_');
    this.searchCache.set(key, {
      data: results,
      timestamp: Date.now()
    });
  }

  /**
   * Clear search cache
   */
  clearSearches(): number {
    const count = this.searchCache.size;
    this.searchCache.clear();
    return count;
  }

  /**
   * Get search cache stats
   */
  getSearchStats(): { size: number; max: number } {
    return {
      size: this.searchCache.size,
      max: this.searchCache.max
    };
  }

  // ==================== Global Operations ====================

  /**
   * Clear all caches
   */
  clearAll(): { embeddings: number; classifications: number; searches: number } {
    return {
      embeddings: this.clearEmbeddings(),
      classifications: this.clearClassifications(),
      searches: this.clearSearches()
    };
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): {
    embeddings: { size: number; max: number };
    classifications: { size: number; max: number };
    searches: { size: number; max: number };
  } {
    return {
      embeddings: this.getEmbeddingStats(),
      classifications: this.getClassificationStats(),
      searches: this.getSearchStats()
    };
  }
}

// Export singleton instance
export const aiCache = new AICache();
export default aiCache;
