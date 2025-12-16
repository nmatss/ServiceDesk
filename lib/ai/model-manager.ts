/**
 * AI Model Manager
 * Manages AI model lifecycle, versioning, and deployment
 */

import * as Database from 'better-sqlite3';
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

export class AIModelManager {
  private db: Database.Database;
  private activeModels: Map<string, ModelVersion>;

  constructor(db: Database.Database) {
    this.db = db;
    this.activeModels = new Map();
  }

  /**
   * Initialize model manager and load active models
   */
  async initialize(): Promise<void> {
    await this.createModelVersionsTable();
    await this.loadActiveModels();
  }

  /**
   * Create model versions table if not exists
   */
  private async createModelVersionsTable(): Promise<void> {
    this.db.prepare(`
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
    `).run();

    this.db.prepare(`
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
    `).run();

    this.db.prepare(`
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
    `).run();
  }

  /**
   * Load active models into memory
   */
  private async loadActiveModels(): Promise<void> {
    const models = this.db.prepare(
      `SELECT * FROM ai_model_versions WHERE status = 'active'`
    ).all();

    for (const model of models) {
      this.activeModels.set((model as DatabaseRow).type, this.mapToModelVersion(model));
    }
  }

  /**
   * Register a new model version
   */
  async registerModel(
    version: string,
    name: string,
    type: 'classification' | 'suggestion' | 'sentiment' | 'embedding',
    provider: 'openai' | 'anthropic' | 'local' | 'custom',
    modelId: string,
    config?: Record<string, unknown>
  ): Promise<ModelVersion> {
    this.db.prepare(
      `INSERT INTO ai_model_versions (
        version, name, type, provider, model_id, config, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'training')`
    ).run(version, name, type, provider, modelId, JSON.stringify(config || {}));

    return this.getModelByVersion(version);
  }

  /**
   * Deploy a model version
   */
  async deployModel(
    version: string,
    deploymentConfig?: Partial<ModelDeploymentConfig>
  ): Promise<void> {
    const model = await this.getModelByVersion(version);

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
    const currentActive = this.db.prepare(
      `SELECT version FROM ai_model_versions
       WHERE type = ? AND status = 'active'`
    ).get(model.type) as DatabaseRow | undefined;

    if (currentActive && currentActive.version !== version) {
      await this.deprecateModel(currentActive.version);
    }

    // Deploy new version
    this.db.prepare(
      `UPDATE ai_model_versions
       SET status = 'active', deployed_at = CURRENT_TIMESTAMP
       WHERE version = ?`
    ).run(version);

    // Record deployment
    this.db.prepare(
      `INSERT INTO ai_model_deployments (
        model_version, rollout_percentage, max_concurrency,
        timeout_ms, fallback_model, ab_test_enabled
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      version,
      deploymentConfig?.rolloutPercentage || 100,
      deploymentConfig?.maxConcurrency || 10,
      deploymentConfig?.timeoutMs || 30000,
      deploymentConfig?.fallbackModel || null,
      deploymentConfig?.abTestEnabled ? 1 : 0
    );

    // Reload active models
    await this.loadActiveModels();
  }

  /**
   * Deprecate a model version
   */
  async deprecateModel(version: string): Promise<void> {
    this.db.prepare(
      `UPDATE ai_model_versions SET status = 'deprecated' WHERE version = ?`
    ).run(version);

    // Remove from active models cache
    const model = await this.getModelByVersion(version);
    if (model) {
      this.activeModels.delete(model.type);
    }
  }

  /**
   * Get active model for a specific type
   */
  getActiveModel(type: string): ModelVersion | undefined {
    return this.activeModels.get(type);
  }

  /**
   * Get model by version
   */
  async getModelByVersion(version: string): Promise<ModelVersion> {
    const model = this.db.prepare(
      `SELECT * FROM ai_model_versions WHERE version = ?`
    ).get(version) as DatabaseRow | undefined;

    if (!model) {
      throw new Error(`Model version ${version} not found`);
    }

    return this.mapToModelVersion(model);
  }

  /**
   * Log model inference for performance tracking
   */
  async logInference(
    modelVersion: string,
    inputHash: string,
    responseTimeMs: number,
    confidenceScore: number,
    success: boolean = true,
    errorMessage?: string,
    cost: number = 0
  ): Promise<void> {
    this.db.prepare(
      `INSERT INTO ai_inference_logs (
        model_version, input_hash, response_time_ms,
        confidence_score, success, error_message, cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      modelVersion,
      inputHash,
      responseTimeMs,
      confidenceScore,
      success ? 1 : 0,
      errorMessage || null,
      cost
    );

    // Update model performance stats asynchronously
    this.updateModelPerformance(modelVersion).catch(err => logger.error('Error updating model performance', err));
  }

  /**
   * Update model performance statistics
   */
  async updateModelPerformance(version: string): Promise<void> {
    const stats = this.db.prepare(
      `SELECT
        COUNT(*) as total,
        AVG(response_time_ms) as avg_time,
        AVG(confidence_score) as avg_confidence,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as error_rate,
        AVG(cost) as avg_cost
      FROM ai_inference_logs
      WHERE model_version = ?
        AND created_at > datetime('now', '-24 hours')`
    ).get(version) as StatsRow | undefined;

    if (stats && stats.total > 0) {
      this.db.prepare(
        `UPDATE ai_model_versions SET
          total_inferences = ?,
          avg_response_time = ?,
          avg_confidence = ?,
          success_rate = ?,
          error_rate = ?,
          cost_per_inference = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE version = ?`
      ).run(
        stats.total,
        stats.avg_time,
        stats.avg_confidence,
        stats.success_rate,
        stats.error_rate,
        stats.avg_cost,
        version
      );
    }
  }

  /**
   * Get model performance comparison
   */
  async compareModels(versions: string[]): Promise<Record<string, ModelPerformanceStats>> {
    const comparison: Record<string, ModelPerformanceStats> = {};

    for (const version of versions) {
      const model = await this.getModelByVersion(version);
      comparison[version] = model.performance;
    }

    return comparison;
  }

  /**
   * A/B test two model versions
   */
  async setupABTest(
    versionA: string,
    versionB: string,
    splitPercentage: number = 50
  ): Promise<void> {
    // Deploy version A with split percentage
    await this.deployModel(versionA, {
      rolloutPercentage: splitPercentage,
      abTestEnabled: true,
    });

    // Deploy version B with remaining percentage
    await this.deployModel(versionB, {
      rolloutPercentage: 100 - splitPercentage,
      abTestEnabled: true,
    });
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(
    versionA: string,
    versionB: string
  ): Promise<{
    versionA: ModelPerformanceStats;
    versionB: ModelPerformanceStats;
    winner: string | null;
    confidenceLevel: number;
  }> {
    const comparison = await this.compareModels([versionA, versionB]);

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
  async getAllModels(type?: string): Promise<ModelVersion[]> {
    const models = type
      ? this.db.prepare(`SELECT * FROM ai_model_versions WHERE type = ? ORDER BY created_at DESC`).all(type)
      : this.db.prepare(`SELECT * FROM ai_model_versions ORDER BY created_at DESC`).all();

    return models.map(model => this.mapToModelVersion(model));
  }

  /**
   * Get model deployment history
   */
  async getDeploymentHistory(limit: number = 10): Promise<DeploymentHistoryRow[]> {
    return this.db.prepare(
      `SELECT
        d.*,
        m.name as model_name,
        m.type as model_type,
        u.name as deployed_by_name
      FROM ai_model_deployments d
      LEFT JOIN ai_model_versions m ON d.model_version = m.version
      LEFT JOIN users u ON d.deployed_by = u.id
      ORDER BY d.deployed_at DESC
      LIMIT ?`
    ).all(limit) as DeploymentHistoryRow[];
  }

  /**
   * Clean up old inference logs (data retention)
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    const result = this.db.prepare(
      `DELETE FROM ai_inference_logs
       WHERE created_at < datetime('now', '-' || ? || ' days')`
    ).run(retentionDays);

    return result.changes || 0;
  }

  /**
   * Export model configuration
   */
  async exportModelConfig(version: string): Promise<string> {
    const model = await this.getModelByVersion(version);
    const deployment = this.db.prepare(
      `SELECT * FROM ai_model_deployments
       WHERE model_version = ?
       ORDER BY deployed_at DESC
       LIMIT 1`
    ).get(version) as DatabaseRow | undefined;

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
  private mapToModelVersion(row: unknown): ModelVersion {
    const r = row as DatabaseRow;
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
  async getModelHealth(version: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  }> {
    const model = await this.getModelByVersion(version);
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
}

export default AIModelManager;
