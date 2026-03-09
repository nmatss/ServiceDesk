/**
 * AI Model Manager
 * Manages AI model lifecycle, versioning, and deployment
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import logger from '../monitoring/structured-logger';

/**
 * Database row interface for type safety
 */
interface DatabaseRow {
  id: number;
  version: string;
  name: string;
  type: string;
  provider: string;
  model_id: string;
  config: string;
  status: string;
  accuracy: number;
  total_inferences: number;
  avg_response_time: number;
  avg_confidence: number;
  success_rate: number;
  error_rate: number;
  cost_per_inference: number;
  deployed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Statistics row interface
 */
interface StatsRow {
  total: number;
  avg_time: number;
  avg_confidence: number;
  success_rate: number;
  error_rate: number;
  avg_cost: number;
}

/**
 * Deployment history row interface
 */
interface DeploymentHistoryRow {
  id: number;
  model_version: string;
  rollout_percentage: number;
  max_concurrency: number;
  timeout_ms: number;
  fallback_model: string | null;
  ab_test_enabled: number;
  deployed_by: number | null;
  deployed_at: string;
  model_name: string;
  model_type: string;
  deployed_by_name: string | null;
}

export interface ModelVersion {
  id: number;
  version: string;
  name: string;
  type: 'classification' | 'suggestion' | 'sentiment' | 'embedding';
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  modelId: string;
  config: Record<string, unknown>;
  status: 'training' | 'active' | 'deprecated' | 'archived';
  accuracy: number;
  performance: ModelPerformanceStats;
  deployedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPerformanceStats {
  totalInferences: number;
  avgResponseTime: number; // ms
  avgConfidence: number;
  successRate: number;
  errorRate: number;
  costPerInference: number; // USD
}

export interface ModelDeploymentConfig {
  version: string;
  rolloutPercentage: number; // 0-100 for canary deployment
  maxConcurrency: number;
  timeoutMs: number;
  fallbackModel?: string;
  abTestEnabled: boolean;
}

// In-memory cache for active models
const activeModels: Map<string, ModelVersion> = new Map();

/**
 * Initialize model manager and load active models
 */
export async function initialize(): Promise<void> {
  await createModelVersionsTable();
  await loadActiveModels();
}

/**
 * Create model versions table if not exists
 */
async function createModelVersionsTable(): Promise<void> {
  if (getDatabaseType() === 'sqlite') {
    await executeRun(`
      CREATE TABLE IF NOT EXISTS ai_model_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        config TEXT,
        status TEXT DEFAULT 'training',
        accuracy REAL DEFAULT 0,
        total_inferences INTEGER DEFAULT 0,
        avg_response_time REAL DEFAULT 0,
        avg_confidence REAL DEFAULT 0,
        success_rate REAL DEFAULT 0,
        error_rate REAL DEFAULT 0,
        cost_per_inference REAL DEFAULT 0,
        deployed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await executeRun(`
      CREATE TABLE IF NOT EXISTS ai_model_deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_version TEXT NOT NULL,
        rollout_percentage INTEGER DEFAULT 100,
        max_concurrency INTEGER DEFAULT 10,
        timeout_ms INTEGER DEFAULT 30000,
        fallback_model TEXT,
        ab_test_enabled INTEGER DEFAULT 0,
        deployed_by INTEGER,
        deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deployed_by) REFERENCES users(id)
      )
    `);

    await executeRun(`
      CREATE TABLE IF NOT EXISTS ai_inference_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_version TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        response_time_ms REAL NOT NULL,
        confidence_score REAL,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        cost REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  // PostgreSQL tables should be created via schema.postgres.sql
}

/**
 * Load active models into memory
 */
async function loadActiveModels(): Promise<void> {
  const models = await executeQuery<DatabaseRow>(
    `SELECT * FROM ai_model_versions WHERE status = 'active'`
  );

  activeModels.clear();
  for (const model of models) {
    activeModels.set(model.type, mapToModelVersion(model));
  }
}

/**
 * Register a new model version
 */
export async function registerModel(
  version: string,
  name: string,
  type: 'classification' | 'suggestion' | 'sentiment' | 'embedding',
  provider: 'openai' | 'anthropic' | 'local' | 'custom',
  modelId: string,
  config?: Record<string, unknown>
): Promise<ModelVersion> {
  await executeRun(
    `INSERT INTO ai_model_versions (
      version, name, type, provider, model_id, config, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'training')`,
    [version, name, type, provider, modelId, JSON.stringify(config || {})]
  );

  return getModelByVersion(version);
}

/**
 * Deploy a model version
 */
export async function deployModel(
  version: string,
  deploymentConfig?: Partial<ModelDeploymentConfig>
): Promise<void> {
  const model = await getModelByVersion(version);

  if (!model) {
    throw new Error(`Model version ${version} not found`);
  }

  // Check if model meets deployment criteria
  if (model.accuracy < 0.85) {
    throw new Error(
      `Model accuracy (${model.accuracy}) is below deployment threshold (0.85)`
    );
  }

  // If deploying same type, deprecate old version
  const currentActive = await executeQueryOne<DatabaseRow>(
    `SELECT version FROM ai_model_versions
     WHERE type = ? AND status = 'active'`,
    [model.type]
  );

  if (currentActive && currentActive.version !== version) {
    await deprecateModel(currentActive.version);
  }

  // Deploy new version
  await executeRun(
    `UPDATE ai_model_versions
     SET status = 'active', deployed_at = CURRENT_TIMESTAMP
     WHERE version = ?`,
    [version]
  );

  // Record deployment
  await executeRun(
    `INSERT INTO ai_model_deployments (
      model_version, rollout_percentage, max_concurrency,
      timeout_ms, fallback_model, ab_test_enabled
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      version,
      deploymentConfig?.rolloutPercentage || 100,
      deploymentConfig?.maxConcurrency || 10,
      deploymentConfig?.timeoutMs || 30000,
      deploymentConfig?.fallbackModel || null,
      deploymentConfig?.abTestEnabled ? 1 : 0
    ]
  );

  // Reload active models
  await loadActiveModels();
}

/**
 * Deprecate a model version
 */
export async function deprecateModel(version: string): Promise<void> {
  await executeRun(
    `UPDATE ai_model_versions SET status = 'deprecated' WHERE version = ?`,
    [version]
  );

  // Remove from active models cache
  const model = await getModelByVersion(version);
  if (model) {
    activeModels.delete(model.type);
  }
}

/**
 * Get active model for a specific type
 */
export function getActiveModel(type: string): ModelVersion | undefined {
  return activeModels.get(type);
}

/**
 * Get model by version
 */
export async function getModelByVersion(version: string): Promise<ModelVersion> {
  const model = await executeQueryOne<DatabaseRow>(
    `SELECT * FROM ai_model_versions WHERE version = ?`,
    [version]
  );

  if (!model) {
    throw new Error(`Model version ${version} not found`);
  }

  return mapToModelVersion(model);
}

/**
 * Log model inference for performance tracking
 */
export async function logInference(
  modelVersion: string,
  inputHash: string,
  responseTimeMs: number,
  confidenceScore: number,
  success: boolean = true,
  errorMessage?: string,
  cost: number = 0
): Promise<void> {
  await executeRun(
    `INSERT INTO ai_inference_logs (
      model_version, input_hash, response_time_ms,
      confidence_score, success, error_message, cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      modelVersion,
      inputHash,
      responseTimeMs,
      confidenceScore,
      success ? 1 : 0,
      errorMessage || null,
      cost
    ]
  );

  // Update model performance stats asynchronously
  updateModelPerformance(modelVersion).catch(err => logger.error('Error updating model performance', err));
}

/**
 * Update model performance statistics
 */
export async function updateModelPerformance(version: string): Promise<void> {
  const dateExpr = getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '24 hours'`
    : `datetime('now', '-24 hours')`;

  const stats = await executeQueryOne<StatsRow>(
    `SELECT
      COUNT(*) as total,
      AVG(response_time_ms) as avg_time,
      AVG(confidence_score) as avg_confidence,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0) as success_rate,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0) as error_rate,
      AVG(cost) as avg_cost
    FROM ai_inference_logs
    WHERE model_version = ?
      AND created_at > ${dateExpr}`,
    [version]
  );

  if (stats && stats.total > 0) {
    await executeRun(
      `UPDATE ai_model_versions SET
        total_inferences = ?,
        avg_response_time = ?,
        avg_confidence = ?,
        success_rate = ?,
        error_rate = ?,
        cost_per_inference = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE version = ?`,
      [
        stats.total,
        stats.avg_time,
        stats.avg_confidence,
        stats.success_rate,
        stats.error_rate,
        stats.avg_cost,
        version
      ]
    );
  }
}

/**
 * Get model performance comparison
 */
export async function compareModels(versions: string[]): Promise<Record<string, ModelPerformanceStats>> {
  const comparison: Record<string, ModelPerformanceStats> = {};

  for (const version of versions) {
    const model = await getModelByVersion(version);
    comparison[version] = model.performance;
  }

  return comparison;
}

/**
 * A/B test two model versions
 */
export async function setupABTest(
  versionA: string,
  versionB: string,
  splitPercentage: number = 50
): Promise<void> {
  // Deploy version A with split percentage
  await deployModel(versionA, {
    rolloutPercentage: splitPercentage,
    abTestEnabled: true,
  });

  // Deploy version B with remaining percentage
  await deployModel(versionB, {
    rolloutPercentage: 100 - splitPercentage,
    abTestEnabled: true,
  });
}

/**
 * Get A/B test results
 */
export async function getABTestResults(
  versionA: string,
  versionB: string
): Promise<{
  versionA: ModelPerformanceStats;
  versionB: ModelPerformanceStats;
  winner: string | null;
  confidenceLevel: number;
}> {
  const comparison = await compareModels([versionA, versionB]);

  const statsA = comparison[versionA];
  const statsB = comparison[versionB];

  // Ensure both stats exist
  if (!statsA || !statsB) {
    throw new Error('Unable to retrieve performance stats for one or both model versions');
  }

  // Simple winner determination (in production, use statistical significance tests)
  let winner: string | null = null;
  let confidenceLevel = 0;

  if (statsA.successRate > statsB.successRate && statsA.avgConfidence > statsB.avgConfidence) {
    winner = versionA;
    confidenceLevel = Math.abs(statsA.successRate - statsB.successRate);
  } else if (statsB.successRate > statsA.successRate && statsB.avgConfidence > statsA.avgConfidence) {
    winner = versionB;
    confidenceLevel = Math.abs(statsB.successRate - statsA.successRate);
  }

  return {
    versionA: statsA,
    versionB: statsB,
    winner,
    confidenceLevel,
  };
}

/**
 * Get all model versions
 */
export async function getAllModels(type?: string): Promise<ModelVersion[]> {
  const models = type
    ? await executeQuery<DatabaseRow>(`SELECT * FROM ai_model_versions WHERE type = ? ORDER BY created_at DESC`, [type])
    : await executeQuery<DatabaseRow>(`SELECT * FROM ai_model_versions ORDER BY created_at DESC`);

  return models.map(model => mapToModelVersion(model));
}

/**
 * Get model deployment history
 */
export async function getDeploymentHistory(limit: number = 10): Promise<DeploymentHistoryRow[]> {
  return executeQuery<DeploymentHistoryRow>(
    `SELECT
      d.*,
      m.name as model_name,
      m.type as model_type,
      u.name as deployed_by_name
    FROM ai_model_deployments d
    LEFT JOIN ai_model_versions m ON d.model_version = m.version
    LEFT JOIN users u ON d.deployed_by = u.id
    ORDER BY d.deployed_at DESC
    LIMIT ?`,
    [limit]
  );
}

/**
 * Clean up old inference logs (data retention)
 */
export async function cleanupOldLogs(retentionDays: number = 30): Promise<number> {
  const dateExpr = getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${retentionDays} days'`
    : `datetime('now', '-' || ? || ' days')`;

  const params = getDatabaseType() === 'postgresql' ? [] : [retentionDays];

  const result = await executeRun(
    `DELETE FROM ai_inference_logs
     WHERE created_at < ${dateExpr}`,
    params
  );

  return result.changes || 0;
}

/**
 * Export model configuration
 */
export async function exportModelConfig(version: string): Promise<string> {
  const model = await getModelByVersion(version);
  const deployment = await executeQueryOne<DatabaseRow>(
    `SELECT * FROM ai_model_deployments
     WHERE model_version = ?
     ORDER BY deployed_at DESC
     LIMIT 1`,
    [version]
  );

  const config = {
    version: model.version,
    name: model.name,
    type: model.type,
    provider: model.provider,
    modelId: model.modelId,
    config: model.config,
    performance: model.performance,
    deployment: deployment || null,
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Map database row to ModelVersion
 */
function mapToModelVersion(r: DatabaseRow): ModelVersion {
  return {
    id: r.id,
    version: r.version,
    name: r.name,
    type: r.type as 'classification' | 'suggestion' | 'sentiment' | 'embedding',
    provider: r.provider as 'openai' | 'anthropic' | 'local' | 'custom',
    modelId: r.model_id,
    config: JSON.parse(r.config || '{}') as Record<string, unknown>,
    status: r.status as 'training' | 'active' | 'deprecated' | 'archived',
    accuracy: r.accuracy || 0,
    performance: {
      totalInferences: r.total_inferences || 0,
      avgResponseTime: r.avg_response_time || 0,
      avgConfidence: r.avg_confidence || 0,
      successRate: r.success_rate || 0,
      errorRate: r.error_rate || 0,
      costPerInference: r.cost_per_inference || 0,
    },
    deployedAt: r.deployed_at ? new Date(r.deployed_at) : undefined,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/**
 * Get model health status
 */
export async function getModelHealth(version: string): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  recommendations: string[];
}> {
  const model = await getModelByVersion(version);
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check success rate
  if (model.performance.successRate < 0.95) {
    issues.push(`Low success rate: ${(model.performance.successRate * 100).toFixed(2)}%`);
    recommendations.push('Review error logs and consider retraining');
  }

  // Check response time
  if (model.performance.avgResponseTime > 5000) {
    issues.push(`High response time: ${model.performance.avgResponseTime.toFixed(0)}ms`);
    recommendations.push('Optimize model or increase compute resources');
  }

  // Check confidence
  if (model.performance.avgConfidence < 0.7) {
    issues.push(`Low confidence: ${(model.performance.avgConfidence * 100).toFixed(2)}%`);
    recommendations.push('Collect more training data or adjust classification threshold');
  }

  // Determine overall health
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (issues.length > 2) {
    status = 'unhealthy';
  } else if (issues.length > 0) {
    status = 'degraded';
  }

  return { status, issues, recommendations };
}

// Backward-compatible export object
export const aiModelManager = {
  initialize,
  registerModel,
  deployModel,
  deprecateModel,
  getActiveModel,
  getModelByVersion,
  logInference,
  updateModelPerformance,
  compareModels,
  setupABTest,
  getABTestResults,
  getAllModels,
  getDeploymentHistory,
  cleanupOldLogs,
  exportModelConfig,
  getModelHealth,
};

export default aiModelManager;
