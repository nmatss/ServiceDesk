import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '../monitoring/structured-logger';

// Interface para cache
interface CacheEntry {
  key: string;
  value: string;
  expires_at: string;
  created_at: string;
}

// Interface para configuracao de cache
interface CacheConfig {
  defaultTTL: number; // Time to live em segundos
  maxSize: number; // Numero maximo de entradas
  enabled: boolean;
}

// Configuracao padrao
const defaultConfig: CacheConfig = {
  defaultTTL: 300, // 5 minutos
  maxSize: 1000,
  enabled: true
};

let config = { ...defaultConfig };

/**
 * Configura o sistema de cache
 */
export function configureCacheSystem(newConfig: Partial<CacheConfig>): void {
  config = { ...config, ...newConfig };
  logger.info('Cache system configured', config);
}

/**
 * Verifica se o cache esta habilitado
 */
export function isCacheEnabled(): boolean {
  return config.enabled;
}

/**
 * Gera chave de cache unica
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
export async function getFromCache<T>(key: string): Promise<T | null> {
  if (!isCacheEnabled()) return null;

  try {
    // Try to query the cache table; if it doesn't exist, create it
    let entry: CacheEntry | undefined;
    try {
      entry = await executeQueryOne<CacheEntry>(`
        SELECT value, expires_at
        FROM cache
        WHERE key = ?
      `, [key]);
    } catch {
      // Table likely doesn't exist, create it
      await initializeCacheSystem();
      return null;
    }

    if (!entry) {
      return null;
    }

    // Verificar se expirou
    if (new Date(entry.expires_at) < new Date()) {
      // Remove entrada expirada
      await executeRun('DELETE FROM cache WHERE key = ?', [key]);
      return null;
    }

    return JSON.parse(entry.value) as T;
  } catch (error) {
    logger.error('Error getting from cache', error);
    return null;
  }
}

/**
 * Armazena valor no cache
 */
export async function setCache<T>(key: string, value: T, ttl: number = config.defaultTTL): Promise<boolean> {
  if (!isCacheEnabled()) return false;

  try {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const valueString = JSON.stringify(value);

    // Verificar se precisa limpar cache por limite de tamanho
    await cleanupCacheIfNeeded();

    // Inserir ou atualizar
    await executeRun(`
      INSERT OR REPLACE INTO cache (key, value, expires_at)
      VALUES (?, ?, ?)
    `, [key, valueString, expiresAt]);

    return true;
  } catch (error) {
    logger.error('Error setting cache', error);
    return false;
  }
}

/**
 * Remove entrada do cache
 */
export async function removeFromCache(key: string): Promise<boolean> {
  if (!isCacheEnabled()) return false;

  try {
    const result = await executeRun('DELETE FROM cache WHERE key = ?', [key]);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error removing from cache', error);
    return false;
  }
}

/**
 * Remove entradas do cache por padrao
 */
export async function removeCachePattern(pattern: string): Promise<number> {
  if (!isCacheEnabled()) return 0;

  try {
    const result = await executeRun('DELETE FROM cache WHERE key LIKE ?', [pattern]);
    return result.changes;
  } catch (error) {
    logger.error('Error removing cache pattern', error);
    return 0;
  }
}

/**
 * Limpa cache expirado
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await executeRun(`
      DELETE FROM cache
      WHERE expires_at < datetime('now')
    `, []);

    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired cache entries`);
    }

    return result.changes;
  } catch (error) {
    logger.error('Error cleaning up expired cache', error);
    return 0;
  }
}

/**
 * Limpa cache se necessario por limite de tamanho
 */
async function cleanupCacheIfNeeded(): Promise<void> {
  try {
    const countResult = await executeQueryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM cache',
      []
    );
    const count = countResult?.count ?? 0;

    if (count >= config.maxSize) {
      // Remove as entradas mais antigas
      const entriesToRemove = Math.floor(config.maxSize * 0.2); // Remove 20%

      await executeRun(`
        DELETE FROM cache
        WHERE key IN (
          SELECT key FROM cache
          ORDER BY created_at ASC
          LIMIT ?
        )
      `, [entriesToRemove]);

      logger.info(`Cleaned up ${entriesToRemove} cache entries due to size limit`);
    }
  } catch (error) {
    logger.error('Error in cache cleanup', error);
  }
}

/**
 * Limpa todo o cache
 */
export async function clearAllCache(): Promise<number> {
  try {
    const result = await executeRun('DELETE FROM cache', []);
    logger.info(`Cleared all cache: ${result.changes} entries removed`);
    return result.changes;
  } catch (error) {
    logger.error('Error clearing all cache', error);
    return 0;
  }
}

/**
 * Busca estatisticas do cache
 */
export async function getCacheStats(): Promise<{
  total_entries: number;
  expired_entries: number;
  size_mb: number;
  hit_rate?: number;
}> {
  try {
    // Total de entradas
    const totalResult = await executeQueryOne<{ total_entries: number }>(`
      SELECT COUNT(*) as total_entries FROM cache
    `, []);

    // Entradas expiradas
    const expiredResult = await executeQueryOne<{ expired_entries: number }>(`
      SELECT COUNT(*) as expired_entries
      FROM cache
      WHERE expires_at < datetime('now')
    `, []);

    // Tamanho aproximado em MB
    const sizeResult = await executeQueryOne<{ total_size: number }>(`
      SELECT SUM(LENGTH(value)) as total_size FROM cache
    `, []);

    const size_mb = sizeResult?.total_size ? (sizeResult.total_size / 1024 / 1024) : 0;

    return {
      total_entries: totalResult?.total_entries ?? 0,
      expired_entries: expiredResult?.expired_entries ?? 0,
      size_mb: Math.round(size_mb * 100) / 100
    };
  } catch (error) {
    logger.error('Error getting cache stats', error);
    return {
      total_entries: 0,
      expired_entries: 0,
      size_mb: 0
    };
  }
}

// Funcoes especificas para cache de dados do sistema

/**
 * Cache para busca de tickets
 */
export async function cacheTicketSearch<T>(searchParams: any, data: T, ttl: number = 60): Promise<void> {
  const key = generateCacheKey('tickets:search', searchParams);
  await setCache(key, data, ttl);
}

export async function getCachedTicketSearch<T>(searchParams: any): Promise<T | null> {
  const key = generateCacheKey('tickets:search', searchParams);
  return getFromCache<T>(key);
}

/**
 * Cache para estatisticas
 */
export async function cacheStats<T>(statsType: string, data: T, ttl: number = 300): Promise<void> {
  const key = generateCacheKey('stats', { type: statsType });
  await setCache(key, data, ttl);
}

export async function getCachedStats<T>(statsType: string): Promise<T | null> {
  const key = generateCacheKey('stats', { type: statsType });
  return getFromCache<T>(key);
}

/**
 * Cache para relatorios
 */
export async function cacheReport<T>(reportType: string, filters: any, data: T, ttl: number = 600): Promise<void> {
  const key = generateCacheKey('reports', { type: reportType, ...filters });
  await setCache(key, data, ttl);
}

export async function getCachedReport<T>(reportType: string, filters: any): Promise<T | null> {
  const key = generateCacheKey('reports', { type: reportType, ...filters });
  return getFromCache<T>(key);
}

/**
 * Cache para dados de usuario
 */
export async function cacheUserData<T>(userId: number, dataType: string, data: T, ttl: number = 300): Promise<void> {
  const key = generateCacheKey('user', { id: userId, type: dataType });
  await setCache(key, data, ttl);
}

export async function getCachedUserData<T>(userId: number, dataType: string): Promise<T | null> {
  const key = generateCacheKey('user', { id: userId, type: dataType });
  return getFromCache<T>(key);
}

/**
 * Cache para configuracoes do sistema
 */
export async function cacheSystemSettings<T>(data: T, ttl: number = 1800): Promise<void> {
  const key = 'system:settings';
  await setCache(key, data, ttl);
}

export async function getCachedSystemSettings<T>(): Promise<T | null> {
  const key = 'system:settings';
  return getFromCache<T>(key);
}

/**
 * Invalida cache relacionado a um ticket
 */
export async function invalidateTicketCache(ticketId: number): Promise<void> {
  await removeCachePattern(`tickets:search:%`);
  await removeCachePattern(`reports:%`);
  await removeCachePattern(`stats:%`);
  await removeFromCache(`ticket:${ticketId}`);
  logger.info(`Invalidated cache for ticket ${ticketId}`);
}

/**
 * Invalida cache relacionado a um usuario
 */
export async function invalidateUserCache(userId: number): Promise<void> {
  await removeCachePattern(`user:${userId}:%`);
  await removeCachePattern(`tickets:search:%`);
  logger.info(`Invalidated cache for user ${userId}`);
}

/**
 * Invalida cache de estatisticas
 */
export async function invalidateStatsCache(): Promise<void> {
  await removeCachePattern('stats:%');
  await removeCachePattern('reports:%');
  logger.info('Invalidated stats cache');
}

/**
 * Wrapper para cache de funcoes
 */
export async function withCache<T>(
  cacheKey: string,
  fn: () => T | Promise<T>,
  ttl: number = config.defaultTTL
): Promise<T> {
  // Tentar buscar do cache primeiro
  const cachedValue = await getFromCache<T>(cacheKey);
  if (cachedValue !== null) {
    return cachedValue;
  }

  // Executar funcao e cachear resultado
  const result = await fn();
  await setCache(cacheKey, result, ttl);
  return result;
}

/**
 * Middleware para cache automatico de funcoes
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
 * Inicializacao do sistema de cache
 */
export async function initializeCacheSystem(): Promise<void> {
  try {
    // Criar tabela de cache se nao existir
    await executeRun(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, []);

    // Criar indice para limpeza eficiente
    await executeRun(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)
    `, []);

    await executeRun(`
      CREATE INDEX IF NOT EXISTS idx_cache_created_at ON cache(created_at)
    `, []);

    // Limpeza inicial
    await cleanupExpiredCache();

    logger.info('Cache system initialized successfully');
  } catch (error) {
    logger.error('Error initializing cache system', error);
  }
}

/**
 * Processo automatico de limpeza de cache
 */
export function startCacheCleanupProcess(): void {
  // Limpeza a cada 5 minutos
  setInterval(() => {
    cleanupExpiredCache();
  }, 5 * 60 * 1000);

  logger.info('Cache cleanup process started');
}

// Exportar configuracao atual
export function getCacheConfig(): CacheConfig {
  return { ...config };
}
