import { LRUCache } from 'lru-cache';

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000, // 1 minuto
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        tokenCount[0] = (tokenCount[0] ?? 0) + 1;

        const currentUsage = tokenCount[0] ?? 0;
        const isRateLimited = currentUsage >= limit;

        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'));
        } else {
          resolve();
        }
      }),
  };
}

// Instância global para rate limiting
export const rateLimiter = rateLimit({
  uniqueTokenPerInterval: 500,
  interval: 60000, // 1 minuto
});

// Função para rate limiting por IP
export async function checkRateLimit(ip: string, limit: number = 5): Promise<boolean> {
  try {
    await rateLimiter.check(limit, ip);
    return true;
  } catch (error) {
    return false;
  }
}

// Rate limiting específico para autenticação
export const authRateLimit = rateLimit({
  uniqueTokenPerInterval: 100,
  interval: 300000, // 5 minutos
});

// Função para rate limiting de autenticação
export async function checkAuthRateLimit(ip: string, limit: number = 5): Promise<boolean> {
  try {
    await authRateLimit.check(limit, ip);
    return true;
  } catch (error) {
    return false;
  }
}

