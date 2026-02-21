/**
 * Cache Warming System
 * Preloads critical caches on server start for optimal performance
 */

import { executeQuery, executeQueryOne } from '@/lib/db/adapter'
import { logger } from '@/lib/monitoring/logger'

/**
 * Warm critical caches that are frequently accessed
 */
export async function warmCriticalCaches(): Promise<void> {
  const startTime = Date.now()
  logger.info('Starting cache warming...')

  try {
    const results: { cache: string; status: string; time?: number }[] = []

    // Warm statuses cache
    try {
      const statusStart = Date.now()
      const statuses = await executeQuery('SELECT * FROM statuses WHERE is_active_new = 1')
      results.push({
        cache: 'statuses',
        status: 'success',
        time: Date.now() - statusStart,
      })
      logger.info(`Warmed statuses cache: ${statuses.length} items`)
    } catch (error) {
      results.push({ cache: 'statuses', status: 'failed' })
      logger.error('Failed to warm statuses cache', error)
    }

    // Warm priorities cache
    try {
      const priorityStart = Date.now()
      const priorities = await executeQuery('SELECT * FROM priorities WHERE is_active = 1')
      results.push({
        cache: 'priorities',
        status: 'success',
        time: Date.now() - priorityStart,
      })
      logger.info(`Warmed priorities cache: ${priorities.length} items`)
    } catch (error) {
      results.push({ cache: 'priorities', status: 'failed' })
      logger.error('Failed to warm priorities cache', error)
    }

    // Warm categories cache
    try {
      const categoryStart = Date.now()
      const categories = await executeQuery('SELECT * FROM categories WHERE is_active = 1')
      results.push({
        cache: 'categories',
        status: 'success',
        time: Date.now() - categoryStart,
      })
      logger.info(`Warmed categories cache: ${categories.length} items`)
    } catch (error) {
      results.push({ cache: 'categories', status: 'failed' })
      logger.error('Failed to warm categories cache', error)
    }

    // Warm knowledge base articles (published only)
    try {
      const kbStart = Date.now()
      const articles = await executeQuery(
        `SELECT id, title, slug, summary, status, view_count
         FROM kb_articles
         WHERE status = 'published'
         ORDER BY view_count DESC
         LIMIT 100`
      )
      results.push({
        cache: 'knowledge_articles',
        status: 'success',
        time: Date.now() - kbStart,
      })
      logger.info(`Warmed knowledge articles cache: ${articles.length} items`)
    } catch (error) {
      results.push({ cache: 'knowledge_articles', status: 'failed' })
      logger.error('Failed to warm knowledge articles cache', error)
    }

    // Warm service catalog
    try {
      const catalogStart = Date.now()
      const catalogItems = await executeQuery(
        `SELECT * FROM service_catalog_items
         WHERE is_active = 1
         ORDER BY is_featured DESC, display_order ASC`
      )
      results.push({
        cache: 'service_catalog',
        status: 'success',
        time: Date.now() - catalogStart,
      })
      logger.info(`Warmed service catalog cache: ${catalogItems.length} items`)
    } catch (error) {
      results.push({ cache: 'service_catalog', status: 'failed' })
      logger.error('Failed to warm service catalog cache', error)
    }

    // Warm active teams
    try {
      const teamsStart = Date.now()
      const teams = await executeQuery('SELECT * FROM teams WHERE is_active = 1')
      results.push({
        cache: 'teams',
        status: 'success',
        time: Date.now() - teamsStart,
      })
      logger.info(`Warmed teams cache: ${teams.length} items`)
    } catch (error) {
      results.push({ cache: 'teams', status: 'failed' })
      logger.error('Failed to warm teams cache', error)
    }

    const totalTime = Date.now() - startTime
    const successCount = results.filter((r) => r.status === 'success').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    logger.info(
      `Cache warming completed: ${successCount} successful, ${failedCount} failed, ${totalTime}ms total`
    )

    return
  } catch (error) {
    logger.error('Cache warming failed', error)
    throw error
  }
}

/**
 * Warm cache for a specific organization
 */
export async function warmOrganizationCache(organizationId: number): Promise<void> {
  logger.info(`Warming cache for organization ${organizationId}`)

  try {
    // Warm organization-specific data
    const tickets = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM tickets
       WHERE organization_id = ?
       AND created_at >= datetime('now', '-7 days')`,
      [organizationId]
    )

    logger.info(
      `Warmed organization ${organizationId} cache: ${tickets?.count ?? 0} recent tickets`
    )
  } catch (error) {
    logger.error(`Failed to warm organization ${organizationId} cache`, error)
  }
}

/**
 * Schedule periodic cache warming
 * Call this on server start to keep caches fresh
 */
export function scheduleCacheWarming(): void {
  // Warm cache immediately on start
  warmCriticalCaches().catch((error) => {
    logger.error('Initial cache warming failed', error)
  })

  // Warm cache every 30 minutes
  if (process.env.ENABLE_CACHE_WARMING !== 'false') {
    setInterval(
      () => {
        warmCriticalCaches().catch((error) => {
          logger.error('Periodic cache warming failed', error)
        })
      },
      30 * 60 * 1000
    ) // 30 minutes

    logger.info('Cache warming scheduler started (every 30 minutes)')
  }
}
