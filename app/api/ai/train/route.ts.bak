/**
 * AI Training API
 * Endpoints for model training, retraining, and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import AITrainingSystem from '@/lib/ai/training-system';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';
import { createRateLimitMiddleware } from '@/lib/rate-limit';

// Rate limiting muito restritivo para treinamento de AI (máximo 3 requests por hora)
const trainRateLimit = createRateLimitMiddleware('auth-strict')

export async function POST(request: NextRequest) {
  // Aplicar rate limiting
  const rateLimitResult = await trainRateLimit(request, '/api/ai/train')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limit exceeded
  }
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, operationType, organizationId, config } = body;

    const trainingSystem = new AITrainingSystem(db, config);

    switch (action) {
      case 'train':
        // Train new model
        const result = await trainingSystem.trainModel(
          operationType || 'classification',
          organizationId
        );
        return NextResponse.json({
          success: true,
          result,
          message: `Model trained successfully with ${result.accuracy * 100}% accuracy`,
        });

      case 'auto-retrain-check':
        // Check if model needs retraining
        const shouldRetrain = await trainingSystem.shouldRetrain(organizationId);
        return NextResponse.json({
          success: true,
          shouldRetrain,
          message: shouldRetrain
            ? 'Model retraining recommended'
            : 'Model performance is acceptable',
        });

      case 'auto-retrain':
        // Execute auto-retrain if needed
        const autoResult = await trainingSystem.autoRetrainCheck();
        return NextResponse.json({
          success: true,
          result: autoResult,
          message: autoResult
            ? 'Model auto-retrained successfully'
            : 'No retraining needed',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: train, auto-retrain-check, auto-retrain' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('AI Training Error', error);
    return NextResponse.json(
      { error: error.message || 'Training failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Aplicar rate limiting
  const rateLimitResult = await trainRateLimit(request, '/api/ai/train')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limit exceeded
  }

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const organizationId = searchParams.get('organizationId');

    const trainingSystem = new AITrainingSystem(db);

    switch (action) {
      case 'metrics':
        // Get performance metrics
        const metrics = await trainingSystem.calculatePerformanceMetrics(
          'current',
          organizationId ? parseInt(organizationId) : undefined
        );
        return NextResponse.json({ success: true, metrics });

      case 'history':
        // Get training history
        const limit = parseInt(searchParams.get('limit') || '10');
        const history = await trainingSystem.getTrainingHistory(limit);
        return NextResponse.json({ success: true, history });

      case 'data-quality':
        // Get data quality stats
        const stats = await trainingSystem.getDataQualityStats();
        return NextResponse.json({ success: true, stats });

      case 'export':
        // Export training data
        const operationType = searchParams.get('operationType') || 'classification';
        const format = (searchParams.get('format') || 'json') as 'json' | 'csv';
        const data = await trainingSystem.exportTrainingData(operationType as any, format);

        return new NextResponse(data, {
          headers: {
            'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
            'Content-Disposition': `attachment; filename=training-data-${operationType}.${format}`,
          },
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: metrics, history, data-quality, export' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('AI Training GET Error', error);
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}
