/**
 * Cache Statistics API
 * Provides cache performance metrics and debugging information
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { defaultCacheManager } from '@/lib/api/cache'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/cache/stats - Get cache statistics
 * Admin only
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify admin authentication
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] })
    if (guard.response) return guard.response

    // Get cache statistics
    const stats = await defaultCacheManager.getStats()

    // Calculate derived metrics
    const hitRatePercentage = (stats.hitRate * 100).toFixed(2)
    const missRate = 1 - stats.hitRate
    const missRatePercentage = (missRate * 100).toFixed(2)

    return NextResponse.json({
      success: true,
      cache_stats: {
        ...stats,
        hit_rate_percentage: `${hitRatePercentage}%`,
        miss_rate_percentage: `${missRatePercentage}%`,
        total_requests: stats.hits + stats.misses,
      },
      server_time: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error fetching cache stats:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao obter estatísticas do cache' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cache/stats - Clear cache
 * Admin only
 */
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify admin authentication
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] })
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url)
    const pattern = searchParams.get('pattern')

    if (pattern) {
      // Clear cache by pattern
      await defaultCacheManager.invalidateByPattern(pattern)
      return NextResponse.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
      })
    } else {
      // Clear all cache
      await defaultCacheManager.clear()
      return NextResponse.json({
        success: true,
        message: 'All cache cleared',
      })
    }
  } catch (error) {
    logger.error('Error clearing cache:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao limpar cache' },
      { status: 500 }
    )
  }
}
