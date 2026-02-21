import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/auth-service';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { autoGenerateEmbeddings, updateEmbeddingOnChange } from '@/lib/ai/embedding-utils';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Rate limiting for embedding generation (more restrictive)
const embeddingRateLimit = createRateLimitMiddleware('embedding-generation');

// Singleton instance
let vectorDbInstance: VectorDatabase | null = null;

async function getVectorDb(): Promise<VectorDatabase> {
  if (!vectorDbInstance) {
    vectorDbInstance = new VectorDatabase();
  }
  return vectorDbInstance;
}

/**
 * POST /api/embeddings/generate
 * Generate embeddings for entities
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  // Apply rate limiting
  const rateLimitResult = await embeddingRateLimit(request, '/api/embeddings/generate');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only admins can generate embeddings
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      mode = 'auto', // 'auto', 'single', 'batch'
      entityType,
      entityId,
      entityIds,
      entityTypes = ['ticket', 'kb_article'],
      olderThanHours = 24,
      batchSize = 50,
      priority = 5
    } = body;

    const vectorDb = await getVectorDb();

    if (mode === 'single') {
      // Generate embedding for a single entity
      if (!entityType || !entityId) {
        return NextResponse.json(
          { error: 'entityType and entityId are required for single mode' },
          { status: 400 }
        );
      }

      const result = await updateEmbeddingOnChange(vectorDb, entityType, entityId);

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to generate embedding' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: 'single',
        entityType,
        entityId,
        message: 'Embedding generated successfully'
      });

    } else if (mode === 'batch') {
      // Generate embeddings for specific entities
      if (!entityType || !entityIds || !Array.isArray(entityIds)) {
        return NextResponse.json(
          { error: 'entityType and entityIds array are required for batch mode' },
          { status: 400 }
        );
      }

      const jobs = [];
      for (const id of entityIds) {
        jobs.push({
          entityType,
          entityId: id,
          content: '', // Will be fetched by the utility
          priority
        });
      }

      // Process in background
      const result = await vectorDb.batchGenerateEmbeddings(jobs);

      return NextResponse.json({
        success: true,
        mode: 'batch',
        ...result
      });

    } else if (mode === 'auto') {
      // Auto-generate embeddings for entities that need them
      const result = await autoGenerateEmbeddings(vectorDb, {
        entityTypes,
        olderThanHours,
        batchSize,
        priority
      });

      return NextResponse.json({
        success: true,
        mode: 'auto',
        ...result
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "auto", "single", or "batch"' },
        { status: 400 }
      );
    }

  } catch (error) {
    logger.error('Error in embedding generation API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/embeddings/generate/status
 * Get embedding generation status
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const vectorDb = await getVectorDb();

    // Get statistics
    const stats = await vectorDb.getStats();
    const cacheStats = vectorDb.getCacheStats();

    return NextResponse.json({
      success: true,
      embeddings: stats,
      cache: cacheStats
    });

  } catch (error) {
    logger.error('Error getting embedding status', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/embeddings/generate/cache
 * Clear embedding caches
 */
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const vectorDb = await getVectorDb();
    const result = vectorDb.clearCaches();

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Caches cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing caches', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
