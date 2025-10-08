/**
 * AI Training System
 * Manages continuous learning, model retraining, and performance tracking
 */

import { openAIClient } from './openai-client';
import { Database } from '../db/connection';
import { logger } from '../monitoring/logger';
import type {
  AITrainingDataEntry,
  AIFeedbackEntry,
  AIPerformanceMetrics,
  AIModelConfig,
} from './types';

export interface TrainingConfig {
  minDataPoints: number;
  accuracyThreshold: number;
  retrainingInterval: number; // hours
  batchSize: number;
  validationSplit: number;
  autoRetrain: boolean;
}

export interface TrainingResult {
  modelVersion: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDataSize: number;
  validationDataSize: number;
  trainingTime: number;
  improvements: string[];
}

export interface ModelPerformanceMetrics {
  modelVersion: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  feedbackPositive: number;
  feedbackNegative: number;
  lastUpdated: Date;
}

export class AITrainingSystem {
  private db: Database;
  private config: TrainingConfig;

  constructor(db: Database, config?: Partial<TrainingConfig>) {
    this.db = db;
    this.config = {
      minDataPoints: config?.minDataPoints || 1000,
      accuracyThreshold: config?.accuracyThreshold || 0.95,
      retrainingInterval: config?.retrainingInterval || 24, // 24 hours
      batchSize: config?.batchSize || 100,
      validationSplit: config?.validationSplit || 0.2,
      autoRetrain: config?.autoRetrain ?? true,
    };
  }

  /**
   * Collect training data from AI operations with feedback
   */
  async collectTrainingData(
    operationType: 'classification' | 'suggestion' | 'sentiment',
    organizationId?: number
  ): Promise<AITrainingDataEntry[]> {
    const query = `
      SELECT
        atd.id,
        atd.input_text,
        atd.expected_output,
        atd.actual_output,
        atd.data_type,
        atd.quality_score,
        atd.validated,
        atd.validation_source,
        atd.created_at
      FROM ai_training_data atd
      WHERE atd.data_type = ?
        AND atd.validated = 1
        AND atd.quality_score >= 0.7
        ${organizationId ? 'AND atd.organization_id = ?' : ''}
      ORDER BY atd.created_at DESC
    `;

    const params = organizationId
      ? [operationType, organizationId]
      : [operationType];

    const rows = await this.db.all(query, params);
    return rows as AITrainingDataEntry[];
  }

  /**
   * Add training data from AI operation
   */
  async addTrainingData(
    input: string,
    expectedOutput: any,
    actualOutput: any,
    dataType: 'classification' | 'suggestion' | 'sentiment',
    qualityScore: number,
    validated: boolean = false,
    validationSource?: 'user' | 'expert' | 'automated',
    organizationId?: number
  ): Promise<number> {
    const query = `
      INSERT INTO ai_training_data (
        input_text, expected_output, actual_output, data_type,
        quality_score, validated, validation_source, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(query, [
      input,
      JSON.stringify(expectedOutput),
      JSON.stringify(actualOutput),
      dataType,
      qualityScore,
      validated ? 1 : 0,
      validationSource || null,
      organizationId || null,
    ]);

    return result.lastID;
  }

  /**
   * Process feedback and update training data
   */
  async processFeedback(
    classificationId: number,
    feedback: 'positive' | 'negative',
    correctedCategory?: string,
    correctedPriority?: string,
    userId?: number
  ): Promise<void> {
    // Get original classification
    const classification = await this.db.get(
      'SELECT * FROM ai_classifications WHERE id = ?',
      [classificationId]
    );

    if (!classification) {
      throw new Error('Classification not found');
    }

    // Record feedback
    await this.db.run(
      `INSERT INTO ai_feedback (
        classification_id, feedback_type, corrected_category,
        corrected_priority, user_id
      ) VALUES (?, ?, ?, ?, ?)`,
      [classificationId, feedback, correctedCategory, correctedPriority, userId]
    );

    // Update classification with feedback
    await this.db.run(
      'UPDATE ai_classifications SET feedback_received = 1 WHERE id = ?',
      [classificationId]
    );

    // If negative feedback with correction, add to training data
    if (feedback === 'negative' && (correctedCategory || correctedPriority)) {
      const ticket = await this.db.get(
        'SELECT title, description FROM tickets WHERE id = ?',
        [classification.ticket_id]
      );

      if (ticket) {
        const inputText = `${ticket.title}\n${ticket.description}`;
        const expectedOutput = {
          category: correctedCategory || classification.suggested_category,
          priority: correctedPriority || classification.suggested_priority,
        };
        const actualOutput = {
          category: classification.suggested_category,
          priority: classification.suggested_priority,
        };

        await this.addTrainingData(
          inputText,
          expectedOutput,
          actualOutput,
          'classification',
          1.0, // High quality since it's user-corrected
          true,
          'user',
          classification.organization_id
        );
      }
    }
  }

  /**
   * Calculate model performance metrics
   */
  async calculatePerformanceMetrics(
    modelVersion: string = 'current',
    organizationId?: number
  ): Promise<ModelPerformanceMetrics> {
    const whereClause = organizationId
      ? 'WHERE organization_id = ?'
      : '';
    const params = organizationId ? [organizationId] : [];

    // Get total predictions
    const totalQuery = `
      SELECT COUNT(*) as total FROM ai_classifications ${whereClause}
    `;
    const totalResult = await this.db.get(totalQuery, params);
    const totalPredictions = totalResult.total || 0;

    // Get feedback stats
    const feedbackQuery = `
      SELECT
        COUNT(CASE WHEN af.feedback_type = 'positive' THEN 1 END) as positive,
        COUNT(CASE WHEN af.feedback_type = 'negative' THEN 1 END) as negative
      FROM ai_feedback af
      JOIN ai_classifications ac ON af.classification_id = ac.id
      ${whereClause}
    `;
    const feedbackResult = await this.db.get(feedbackQuery, params);

    // Calculate accuracy (positive feedback / total feedback)
    const totalFeedback = (feedbackResult.positive || 0) + (feedbackResult.negative || 0);
    const accuracy = totalFeedback > 0
      ? feedbackResult.positive / totalFeedback
      : 0;

    // Get average confidence
    const confidenceQuery = `
      SELECT AVG(confidence_score) as avg_confidence
      FROM ai_classifications ${whereClause}
    `;
    const confidenceResult = await this.db.get(confidenceQuery, params);

    return {
      modelVersion,
      totalPredictions,
      correctPredictions: feedbackResult.positive || 0,
      accuracy,
      avgConfidence: confidenceResult.avg_confidence || 0,
      feedbackPositive: feedbackResult.positive || 0,
      feedbackNegative: feedbackResult.negative || 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check if model needs retraining
   */
  async shouldRetrain(organizationId?: number): Promise<boolean> {
    if (!this.config.autoRetrain) {
      return false;
    }

    const metrics = await this.calculatePerformanceMetrics('current', organizationId);

    // Retrain if accuracy is below threshold
    if (metrics.accuracy < this.config.accuracyThreshold && metrics.totalPredictions > 100) {
      return true;
    }

    // Retrain if we have enough new training data
    const newDataQuery = `
      SELECT COUNT(*) as count
      FROM ai_training_data
      WHERE validated = 1
        AND created_at > datetime('now', '-${this.config.retrainingInterval} hours')
        ${organizationId ? 'AND organization_id = ?' : ''}
    `;
    const params = organizationId ? [organizationId] : [];
    const newDataResult = await this.db.get(newDataQuery, params);

    if (newDataResult.count >= this.config.minDataPoints) {
      return true;
    }

    return false;
  }

  /**
   * Train or retrain model with collected data
   */
  async trainModel(
    operationType: 'classification' | 'suggestion' | 'sentiment',
    organizationId?: number
  ): Promise<TrainingResult> {
    const startTime = Date.now();

    // Collect training data
    const trainingData = await this.collectTrainingData(operationType, organizationId);

    if (trainingData.length < this.config.minDataPoints) {
      throw new Error(
        `Insufficient training data. Need ${this.config.minDataPoints}, have ${trainingData.length}`
      );
    }

    // Split into training and validation sets
    const shuffled = trainingData.sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * (1 - this.config.validationSplit));
    const trainSet = shuffled.slice(0, splitIndex);
    const validationSet = shuffled.slice(splitIndex);

    // For now, we'll use OpenAI's models which are pre-trained
    // In production, you would fine-tune here or train a custom model
    // This is a placeholder for the actual training logic

    // Validate model performance
    const validationResults = await this.validateModel(validationSet, operationType);

    const modelVersion = `v${Date.now()}`;
    const trainingTime = Date.now() - startTime;

    const result: TrainingResult = {
      modelVersion,
      accuracy: validationResults.accuracy,
      precision: validationResults.precision,
      recall: validationResults.recall,
      f1Score: validationResults.f1Score,
      trainingDataSize: trainSet.length,
      validationDataSize: validationSet.length,
      trainingTime,
      improvements: this.generateImprovementSuggestions(validationResults),
    };

    // Store model metadata
    await this.storeModelMetadata(result, organizationId);

    return result;
  }

  /**
   * Validate model performance on validation set
   */
  private async validateModel(
    validationSet: AITrainingDataEntry[],
    operationType: string
  ): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  }> {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let correct = 0;

    // Test each validation example
    for (const example of validationSet) {
      const expected = JSON.parse(example.expected_output);
      const actual = JSON.parse(example.actual_output);

      // Simple comparison (in production, use more sophisticated metrics)
      const isCorrect = JSON.stringify(expected) === JSON.stringify(actual);
      if (isCorrect) {
        correct++;
        truePositives++;
      } else {
        falsePositives++;
        falseNegatives++;
      }
    }

    const accuracy = validationSet.length > 0 ? correct / validationSet.length : 0;
    const precision = (truePositives + falsePositives) > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;
    const recall = (truePositives + falseNegatives) > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
    const f1Score = (precision + recall) > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    return { accuracy, precision, recall, f1Score };
  }

  /**
   * Generate improvement suggestions based on validation results
   */
  private generateImprovementSuggestions(validationResults: any): string[] {
    const suggestions: string[] = [];

    if (validationResults.accuracy < 0.9) {
      suggestions.push('Collect more diverse training examples');
    }

    if (validationResults.precision < 0.85) {
      suggestions.push('Reduce false positives with stricter classification thresholds');
    }

    if (validationResults.recall < 0.85) {
      suggestions.push('Improve feature extraction to catch more true positives');
    }

    if (validationResults.f1Score < 0.87) {
      suggestions.push('Balance precision and recall through threshold tuning');
    }

    return suggestions;
  }

  /**
   * Store model metadata in database
   */
  private async storeModelMetadata(
    result: TrainingResult,
    organizationId?: number
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO ai_model_versions (
        version, accuracy, precision, recall, f1_score,
        training_size, validation_size, training_time_ms,
        improvements, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.modelVersion,
        result.accuracy,
        result.precision,
        result.recall,
        result.f1Score,
        result.trainingDataSize,
        result.validationDataSize,
        result.trainingTime,
        JSON.stringify(result.improvements),
        organizationId || null,
      ]
    );
  }

  /**
   * Get model training history
   */
  async getTrainingHistory(limit: number = 10): Promise<TrainingResult[]> {
    const rows = await this.db.all(
      `SELECT * FROM ai_model_versions
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map(row => ({
      modelVersion: row.version,
      accuracy: row.accuracy,
      precision: row.precision,
      recall: row.recall,
      f1Score: row.f1_score,
      trainingDataSize: row.training_size,
      validationDataSize: row.validation_size,
      trainingTime: row.training_time_ms,
      improvements: JSON.parse(row.improvements || '[]'),
    }));
  }

  /**
   * Auto-retrain scheduler (call periodically)
   */
  async autoRetrainCheck(): Promise<TrainingResult | null> {
    const shouldRetrain = await this.shouldRetrain();

    if (shouldRetrain) {
      logger.info('Auto-retraining triggered...');
      return await this.trainModel('classification');
    }

    return null;
  }

  /**
   * Export training data for external analysis
   */
  async exportTrainingData(
    operationType: 'classification' | 'suggestion' | 'sentiment',
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const data = await this.collectTrainingData(operationType);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    const headers = ['id', 'input_text', 'expected_output', 'actual_output', 'quality_score'];
    const csv = [
      headers.join(','),
      ...data.map(row =>
        [
          row.id,
          `"${row.input_text.replace(/"/g, '""')}"`,
          `"${row.expected_output.replace(/"/g, '""')}"`,
          `"${row.actual_output.replace(/"/g, '""')}"`,
          row.quality_score,
        ].join(',')
      ),
    ].join('\n');

    return csv;
  }

  /**
   * Get data quality statistics
   */
  async getDataQualityStats(): Promise<{
    total: number;
    validated: number;
    highQuality: number;
    avgQualityScore: number;
    byType: Record<string, number>;
  }> {
    const stats = await this.db.get(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN validated = 1 THEN 1 END) as validated,
        COUNT(CASE WHEN quality_score >= 0.8 THEN 1 END) as high_quality,
        AVG(quality_score) as avg_quality
      FROM ai_training_data
    `);

    const byType = await this.db.all(`
      SELECT data_type, COUNT(*) as count
      FROM ai_training_data
      GROUP BY data_type
    `);

    const byTypeMap: Record<string, number> = {};
    byType.forEach(row => {
      byTypeMap[row.data_type] = row.count;
    });

    return {
      total: stats.total || 0,
      validated: stats.validated || 0,
      highQuality: stats.high_quality || 0,
      avgQualityScore: stats.avg_quality || 0,
      byType: byTypeMap,
    };
  }
}

export default AITrainingSystem;
