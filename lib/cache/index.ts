import db from '../db/connection';

// Interface para cache
interface CacheEntry {
  key: string;
  value: string;
  expires_at: string;
  created_at: string;
}

// Interface para configuração de cache
interface CacheConfig {
  defaultTTL: number; // Time to live em segundos
  maxSize: number; // Número máximo de entradas
  enabled: boolean;
}

// Configuração padrão
const defaultConfig: CacheConfig = {
  defaultTTL: 300, // 5 minutos
  maxSize: 1000,
  enabled: true
};

let config = { ...defaultConfig };

/**
 * Create cache table if it doesn't exist
 */
function createCacheTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for cleanup
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)
    `);
  } catch (error) {
    console.error('Error creating cache table:', error);
  }
}

/**
 * Configura o sistema de cache
 */
export function configureCacheSystem(newConfig: Partial<CacheConfig>): void {
  config = { ...config, ...newConfig };
  console.log('Cache system configured:', config);
}

/**
 * Verifica se o cache está habilitado
 */
export function isCacheEnabled(): boolean {
  return config.enabled;
}

/**
 * Gera chave de cache única
 */
function generateCacheKey(prefix: string, params: any = {}): string {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');

  return paramString ? `${prefix}:${paramString}` : prefix;
}

/**
 * Busca valor no cache
 */
export function getFromCache<T>(key: string): T | null {
  if (!isCacheEnabled()) return null;

  try {
    // Check if cache table exists first
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='cache'
    `).get();

    if (!tableExists) {
      createCacheTable();
    }

    const entry = db.prepare(`
      SELECT value, expires_at
      FROM cache
      WHERE key = ?
    `).get(key) as CacheEntry | undefined;

    if (!entry) {
      return null;
    }

    // Verificar se expirou
    if (new Date(entry.expires_at) < new Date()) {
      // Remove entrada expirada
      db.prepare('DELETE FROM cache WHERE key = ?').run(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  } catch (error) {
    console.error('Error getting from cache:', error);
    return null;
  }
}

/**
 * Armazena valor no cache
 */
export function setCache<T>(key: string, value: T, ttl: number = config.defaultTTL): boolean {
  if (!isCacheEnabled()) return false;

  try {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const valueString = JSON.stringify(value);

    // Verificar se precisa limpar cache por limite de tamanho
    cleanupCacheIfNeeded();

    // Inserir ou atualizar
    db.prepare(`
      INSERT OR REPLACE INTO cache (key, value, expires_at)
      VALUES (?, ?, ?)
    `).run(key, valueString, expiresAt);

    return true;
  } catch (error) {
    console.error('Error setting cache:', error);
    return false;
  }
}

/**
 * Remove entrada do cache
 */
export function removeFromCache(key: string): boolean {
  if (!isCacheEnabled()) return false;

  try {
    const result = db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    return result.changes > 0;
  } catch (error) {
    console.error('Error removing from cache:', error);
    return false;
  }
}

/**
 * Remove entradas do cache por padrão
 */
export function removeCachePattern(pattern: string): number {
  if (!isCacheEnabled()) return 0;

  try {
    const result = db.prepare('DELETE FROM cache WHERE key LIKE ?').run(pattern);
    return result.changes;
  } catch (error) {
    console.error('Error removing cache pattern:', error);
    return 0;
  }
}

/**
 * Limpa cache expirado
 */
export function cleanupExpiredCache(): number {
  try {
    const result = db.prepare(`
      DELETE FROM cache
      WHERE expires_at < datetime('now')
    `).run();

    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired cache entries`);
    }

    return result.changes;
  } catch (error) {
    console.error('Error cleaning up expired cache:', error);
    return 0;
  }
}

/**
 * Limpa cache se necessário por limite de tamanho
 */
function cleanupCacheIfNeeded(): void {
  try {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM cache').get() as { count: number };

    if (count >= config.maxSize) {
      // Remove as entradas mais antigas
      const entriesToRemove = Math.floor(config.maxSize * 0.2); // Remove 20%

      db.prepare(`
        DELETE FROM cache
        WHERE key IN (
          SELECT key FROM cache
          ORDER BY created_at ASC
          LIMIT ?
        )
      `).run(entriesToRemove);

      console.log(`Cleaned up ${entriesToRemove} cache entries due to size limit`);
    }
  } catch (error) {
    console.error('Error in cache cleanup:', error);
  }
}

/**
 * Limpa todo o cache
 */
export function clearAllCache(): number {
  try {
    const result = db.prepare('DELETE FROM cache').run();
    console.log(`Cleared all cache: ${result.changes} entries removed`);
    return result.changes;
  } catch (error) {
    console.error('Error clearing all cache:', error);
    return 0;
  }
}

/**
 * Busca estatísticas do cache
 */
export function getCacheStats(): {
  total_entries: number;
  expired_entries: number;
  size_mb: number;
  hit_rate?: number;
} {
  try {
    // Total de entradas
    const { total_entries } = db.prepare(`
      SELECT COUNT(*) as total_entries FROM cache
    `).get() as { total_entries: number };

    // Entradas expiradas
    const { expired_entries } = db.prepare(`
      SELECT COUNT(*) as expired_entries
      FROM cache
      WHERE expires_at < datetime('now')
    `).get() as { expired_entries: number };

    // Tamanho aproximado em MB
    const { total_size } = db.prepare(`
      SELECT SUM(LENGTH(value)) as total_size FROM cache
    `).get() as { total_size: number };

    const size_mb = total_size ? (total_size / 1024 / 1024) : 0;

    return {
      total_entries,
      expired_entries,
      size_mb: Math.round(size_mb * 100) / 100
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      total_entries: 0,
      expired_entries: 0,
      size_mb: 0
    };
  }
}

// Funções específicas para cache de dados do sistema

/**
 * Cache para busca de tickets
 */
export function cacheTicketSearch<T>(searchParams: any, data: T, ttl: number = 60): void {
  const key = generateCacheKey('tickets:search', searchParams);
  setCache(key, data, ttl);
}

export function getCachedTicketSearch<T>(searchParams: any): T | null {
  const key = generateCacheKey('tickets:search', searchParams);
  return getFromCache<T>(key);
}

/**
 * Cache para estatísticas
 */
export function cacheStats<T>(statsType: string, data: T, ttl: number = 300): void {
  const key = generateCacheKey('stats', { type: statsType });
  setCache(key, data, ttl);
}

export function getCachedStats<T>(statsType: string): T | null {
  const key = generateCacheKey('stats', { type: statsType });
  return getFromCache<T>(key);
}

/**
 * Cache para relatórios
 */
export function cacheReport<T>(reportType: string, filters: any, data: T, ttl: number = 600): void {
  const key = generateCacheKey('reports', { type: reportType, ...filters });
  setCache(key, data, ttl);
}

export function getCachedReport<T>(reportType: string, filters: any): T | null {
  const key = generateCacheKey('reports', { type: reportType, ...filters });
  return getFromCache<T>(key);
}

/**
 * Cache para dados de usuário
 */
export function cacheUserData<T>(userId: number, dataType: string, data: T, ttl: number = 300): void {
  const key = generateCacheKey('user', { id: userId, type: dataType });
  setCache(key, data, ttl);
}

export function getCachedUserData<T>(userId: number, dataType: string): T | null {
  const key = generateCacheKey('user', { id: userId, type: dataType });
  return getFromCache<T>(key);
}

/**
 * Cache para configurações do sistema
 */
export function cacheSystemSettings<T>(data: T, ttl: number = 1800): void {
  const key = 'system:settings';
  setCache(key, data, ttl);
}

export function getCachedSystemSettings<T>(): T | null {
  const key = 'system:settings';
  return getFromCache<T>(key);
}

/**
 * Invalida cache relacionado a um ticket
 */
export function invalidateTicketCache(ticketId: number): void {
  removeCachePattern(`tickets:search:%`);
  removeCachePattern(`reports:%`);
  removeCachePattern(`stats:%`);
  removeFromCache(`ticket:${ticketId}`);
  console.log(`Invalidated cache for ticket ${ticketId}`);
}

/**
 * Invalida cache relacionado a um usuário
 */
export function invalidateUserCache(userId: number): void {
  removeCachePattern(`user:${userId}:%`);
  removeCachePattern(`tickets:search:%`);
  console.log(`Invalidated cache for user ${userId}`);
}

/**
 * Invalida cache de estatísticas
 */
export function invalidateStatsCache(): void {
  removeCachePattern('stats:%');
  removeCachePattern('reports:%');
  console.log('Invalidated stats cache');
}

/**
 * Wrapper para cache de funções
 */
export function withCache<T>(
  cacheKey: string,
  fn: () => T | Promise<T>,
  ttl: number = config.defaultTTL
): Promise<T> {
  return new Promise(async (resolve) => {
    // Tentar buscar do cache primeiro
    const cached = getFromCache<T>(cacheKey);
    if (cached !== null) {
      resolve(cached);
      return;
    }

    try {
      // Executar função e cachear resultado
      const result = await fn();
      setCache(cacheKey, result, ttl);
      resolve(result);
    } catch (error) {
      console.error('Error in withCache:', error);
      throw error;
    }
  });
}

/**
 * Middleware para cache automático de funções
 */
export function cached<T extends (...args: any[]) => any>(
  ttl: number = config.defaultTTL,
  keyGenerator?: (...args: Parameters<T>) => string
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      if (!isCacheEnabled()) {
        return method.apply(this, args);
      }

      const cacheKey = keyGenerator
        ? keyGenerator(...(args as any))
        : generateCacheKey(`${target.constructor.name}:${propertyName}`, args);

      return withCache(cacheKey, () => method.apply(this, args), ttl);
    };

    return descriptor;
  };
}

/**
 * Inicialização do sistema de cache
 */
export function initializeCacheSystem(): void {
  try {
    // Criar tabela de cache se não existir
    db.prepare(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    // Criar índice para limpeza eficiente
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_cache_created_at ON cache(created_at)
    `).run();

    // Limpeza inicial
    cleanupExpiredCache();

    console.log('Cache system initialized successfully');
  } catch (error) {
    console.error('Error initializing cache system:', error);
  }
}

/**
 * Processo automático de limpeza de cache
 */
export function startCacheCleanupProcess(): void {
  // Limpeza a cada 5 minutos
  setInterval(() => {
    cleanupExpiredCache();
  }, 5 * 60 * 1000);

  console.log('Cache cleanup process started');
}

// Exportar configuração atual
export function getCacheConfig(): CacheConfig {
  return { ...config };
}