/**
 * AI Model Management API
 * Endpoints for model versioning, deployment, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne } from '@/lib/db/adapter';
import { createModelManager } from '@/lib/ai/factories';
import { verifyToken } from '@/lib/auth/auth-service';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // Using imported db connection
    const modelManager = createModelManager();
    await modelManager.initialize();

    switch (action) {
      case 'register':
        // Register new model version
        const { version, name, type, provider, modelId, config } = body;
        const model = await modelManager.registerModel(
          version,
          name,
          type,
          provider,
          modelId,
          config
        );
        return NextResponse.json({
          success: true,
          model,
          message: 'Model registered successfully',
        });

      case 'deploy':
        // Deploy model version
        const { deployVersion, deploymentConfig } = body;
        await modelManager.deployModel(deployVersion, deploymentConfig);
        return NextResponse.json({
          success: true,
          message: `Model ${deployVersion} deployed successfully`,
        });

      case 'deprecate':
        // Deprecate model version
        const { deprecateVersion } = body;
        await modelManager.deprecateModel(deprecateVersion);
        return NextResponse.json({
          success: true,
          message: `Model ${deprecateVersion} deprecated`,
        });

      case 'ab-test':
        // Setup A/B test
        const { versionA, versionB, splitPercentage } = body;
        await modelManager.setupABTest(versionA, versionB, splitPercentage);
        return NextResponse.json({
          success: true,
          message: 'A/B test configured successfully',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: register, deploy, deprecate, ab-test' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('Model Management Error', error);
    return NextResponse.json(
      { error: error.message || 'Operation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Using imported db connection
    const modelManager = createModelManager();
    await modelManager.initialize();

    switch (action) {
      case 'list':
        // Get all models
        const type = searchParams.get('type') || undefined;
        const models = await modelManager.getAllModels(type);
        return NextResponse.json({ success: true, models });

      case 'active':
        // Get active model for type
        const activeType = searchParams.get('type');
        if (!activeType) {
          return NextResponse.json(
            { error: 'Type parameter required' },
            { status: 400 }
          );
        }
        const activeModel = modelManager.getActiveModel(activeType);
        return NextResponse.json({ success: true, model: activeModel });

      case 'version':
        // Get specific version
        const version = searchParams.get('version');
        if (!version) {
          return NextResponse.json(
            { error: 'Version parameter required' },
            { status: 400 }
          );
        }
        const model = await modelManager.getModelByVersion(version);
        return NextResponse.json({ success: true, model });

      case 'compare':
        // Compare model versions
        const versions = searchParams.get('versions')?.split(',') || [];
        if (versions.length < 2) {
          return NextResponse.json(
            { error: 'At least 2 versions required for comparison' },
            { status: 400 }
          );
        }
        const comparison = await modelManager.compareModels(versions);
        return NextResponse.json({ success: true, comparison });

      case 'ab-results':
        // Get A/B test results
        const versionA = searchParams.get('versionA');
        const versionB = searchParams.get('versionB');
        if (!versionA || !versionB) {
          return NextResponse.json(
            { error: 'Both versionA and versionB required' },
            { status: 400 }
          );
        }
        const results = await modelManager.getABTestResults(versionA, versionB);
        return NextResponse.json({ success: true, results });

      case 'health':
        // Get model health
        const healthVersion = searchParams.get('version');
        if (!healthVersion) {
          return NextResponse.json(
            { error: 'Version parameter required' },
            { status: 400 }
          );
        }
        const health = await modelManager.getModelHealth(healthVersion);
        return NextResponse.json({ success: true, health });

      case 'deployments':
        // Get deployment history
        const limit = parseInt(searchParams.get('limit') || '10');
        const deployments = await modelManager.getDeploymentHistory(limit);
        return NextResponse.json({ success: true, deployments });

      case 'export':
        // Export model config
        const exportVersion = searchParams.get('version');
        if (!exportVersion) {
          return NextResponse.json(
            { error: 'Version parameter required' },
            { status: 400 }
          );
        }
        const config = await modelManager.exportModelConfig(exportVersion);
        return new NextResponse(config, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename=model-${exportVersion}.json`,
          },
        });

      default:
        return NextResponse.json(
          {
            error: 'Invalid action. Use: list, active, version, compare, ab-results, health, deployments, export',
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('Model Management GET Error', error);
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}
