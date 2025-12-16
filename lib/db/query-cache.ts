/**
 * LRU Query Cache for Database Operations
 * Provides high-performance caching with automatic invalidation
 */

import logger from '../monitoring/structured-logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // tamanho estimado em bytes
}

interface CacheConfig {
  maxSize: number; // tamanho máximo em bytes
  maxEntries: number; // número máximo de entradas
  defaultTTL: number; // TTL padrão em segundos
  enableStats: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  currentSize: number;
  currentEntries: number;
  hitRate: number;
}

class LRUQueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private accessOrder: string[] = []; // LRU tracking
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 50 * 1024 * 1024, // 50MB default
      maxEntries: config?.maxEntries ?? 10000,
      defaultTTL: config?.defaultTTL ?? 300, // 5 minutes
      enableStats: config?.enableStats ?? true,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      currentSize: 0,
      currentEntries: 0,
      hitRate: 0,
    };

    // Iniciar limpeza periódica
    this.startCleanupTask();
  }

  /**
   * Obtém valor do cache
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      if (this.config.enableStats) this.stats.misses++;
      return undefined;
    }

    // Verificar expiração
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      if (this.config.enableStats) this.stats.misses++;
      return undefined;
    }

    // Atualizar acesso
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Atualizar LRU order
    this.updateAccessOrder(key);

    if (this.config.enableStats) {
      this.stats.hits++;
      this.updateHitRate();
    }

    return entry.value;
  }

  /**
   * Define valor no cache
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.config.defaultTTL;
    const expiresAt = Date.now() + ttl * 1000;
    const size = this.estimateSize(value);

    // Verificar se precisa fazer eviction
    if (this.cache.has(key)) {
      // Atualizar entrada existente
      const oldEntry = this.cache.get(key)!;
      this.stats.currentSize -= oldEntry.size;
    } else {
      // Nova entrada - verificar limites
      this.makeRoom(size);
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    this.stats.currentSize += size;
    this.stats.currentEntries = this.cache.size;

    if (this.config.enableStats) this.stats.sets++;
  }

  /**
   * Remove valor do cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.stats.currentSize -= entry.size;
    this.stats.currentEntries = this.cache.size;

    // Remover da ordem de acesso
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    return true;
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.currentSize = 0;
    this.stats.currentEntries = 0;
  }

  /**
   * Invalida cache baseado em padrão
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string'
      ? new RegExp(pattern.replace(/\*/g, '.*'))
      : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Wrapper para funções que usa cache
   */
  async cached<T>(
    key: string,
    fn: () => T | Promise<T>,
    options?: { ttl?: number; forceRefresh?: boolean }
  ): Promise<T> {
    // Verificar cache primeiro (a menos que forceRefresh)
    if (!options?.forceRefresh) {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Executar função
    const result = await fn();

    // Armazenar no cache
    this.set(key, result, options?.ttl);

    return result;
  }

  /**
   * Cria função de cache com key generator
   */
  createCachedFunction<Args extends unknown[], Result>(
    fn: (...args: Args) => Result | Promise<Result>,
    options: {
      keyGenerator: (...args: Args) => string;
      ttl?: number;
    }
  ): (...args: Args) => Promise<Result> {
    return async (...args: Args): Promise<Result> => {
      const key = options.keyGenerator(...args);
      return this.cached(key, () => fn(...args), { ttl: options.ttl });
    };
  }

  /**
   * Atualiza ordem de acesso (LRU)
   */
  private updateAccessOrder(key: string): void {
    // Remover da posição atual
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    // Adicionar ao final (mais recente)
    this.accessOrder.push(key);
  }

  /**
   * Faz espaço no cache removendo entradas antigas
   */
  private makeRoom(requiredSize: number): void {
    // Verificar limite de entradas
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    // Verificar limite de tamanho
    while (this.stats.currentSize + requiredSize > this.config.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Remove entrada menos recentemente usada
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder[0];
    if (keyToEvict) {
      this.delete(keyToEvict);
    }

    if (this.config.enableStats) this.stats.evictions++;
  }

  /**
   * Estima tamanho de um objeto em bytes
   */
  private estimateSize(value: unknown): number {
    if (value === null || value === undefined) return 8;

    const type = typeof value;

    if (type === 'boolean') return 4;
    if (type === 'number') return 8;
    if (type === 'string') return (value as string).length * 2; // UTF-16

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 24); // array overhead
    }

    if (type === 'object') {
      let size = 24; // object overhead
      for (const [key, val] of Object.entries(value as object)) {
        size += key.length * 2; // key size
        size += this.estimateSize(val); // value size
      }
      return size;
    }

    return 8; // default
  }

  /**
   * Remove entradas expiradas
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Inicia tarefa de limpeza periódica
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // A cada 1 minuto

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Para tarefa de limpeza
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Atualiza hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Retorna estatísticas
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Retorna informações detalhadas
   */
  getDetailedInfo() {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      size: entry.size,
      expiresIn: Math.max(0, entry.expiresAt - Date.now()),
      lastAccessed: new Date(entry.lastAccessed),
    }));

    // Ordenar por access count (mais acessados)
    entries.sort((a, b) => b.accessCount - a.accessCount);

    return {
      stats: this.getStats(),
      config: this.config,
      mostAccessed: entries.slice(0, 20),
      lruOrder: this.accessOrder.slice(-20), // últimas 20 chaves acessadas
    };
  }

  /**
   * Warm up cache com dados pré-carregados
   */
  async warmup(entries: Array<{ key: string; fn: () => unknown | Promise<unknown>; ttl?: number }>): Promise<void> {
    logger.info(`Warming up cache with ${entries.length} entries`);

    const promises = entries.map(async ({ key, fn, ttl }) => {
      try {
        const value = await fn();
        this.set(key, value, ttl);
      } catch (error) {
        logger.error(`Failed to warmup cache for key: ${key}`, error);
      }
    });

    await Promise.all(promises);

    logger.info('Cache warmup completed', {
      entries: this.cache.size,
      size: this.stats.currentSize,
    });
  }
}

// Singleton instance
const queryCache = new LRUQueryCache({
  maxSize: parseInt(process.env.QUERY_CACHE_MAX_SIZE || String(50 * 1024 * 1024), 10),
  maxEntries: parseInt(process.env.QUERY_CACHE_MAX_ENTRIES || '10000', 10),
  defaultTTL: parseInt(process.env.QUERY_CACHE_DEFAULT_TTL || '300', 10),
  enableStats: process.env.NODE_ENV !== 'production', // Stats apenas em dev/staging
});

export default queryCache;
export { LRUQueryCache, type CacheEntry, type CacheConfig, type CacheStats };
