/**
 * AI Training System
 * Manages continuous learning, model retraining, and performance tracking
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import logger from '../monitoring/structured-logger';
import type {
  AITrainingDataEntry,
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

const defaultConfig: TrainingConfig = {
  minDataPoints: 1000,
  accuracyThreshold: 0.95,
  retrainingInterval: 24, // 24 hours
  batchSize: 100,
  validationSplit: 0.2,
  autoRetrain: true,
};

let trainingConfig: TrainingConfig = { ...defaultConfig };

/**
 * Configure the training system
 */
export function configure(config?: Partial<TrainingConfig>): void {
  trainingConfig = {
    ...defaultConfig,
    ...config,
  };
}

/**
 * Collect training data from AI operations with feedback
 */
export async function collectTrainingData(
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

  return executeQuery<AITrainingDataEntry>(query, params);
}

/**
 * Add training data from AI operation
 */
export async function addTrainingData(
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

  const result = await executeRun(query, [
    input,
    JSON.stringify(expectedOutput),
    JSON.stringify(actualOutput),
    dataType,
    qualityScore,
    validated ? 1 : 0,
    validationSource || null,
    organizationId || null
  ]);

  return result.lastInsertRowid as number;
}

/**
 * Process feedback and update training data
 */
export async function processFeedback(
  classificationId: number,
  feedback: 'positive' | 'negative',
  correctedCategory?: string,
  correctedPriority?: string,
  userId?: number
): Promise<void> {
  // Get original classification
  const classification = await executeQueryOne<any>(
    'SELECT * FROM ai_classifications WHERE id = ?',
    [classificationId]
  );

  if (!classification) {
    throw new Error('Classification not found');
  }

  // Record feedback
  await executeRun(
    `INSERT INTO ai_feedback (
      classification_id, feedback_type, corrected_category,
      corrected_priority, user_id
    ) VALUES (?, ?, ?, ?, ?)`,
    [classificationId, feedback, correctedCategory, correctedPriority, userId]
  );

  // Update classification with feedback
  await executeRun(
    'UPDATE ai_classifications SET feedback_received = 1 WHERE id = ?',
    [classificationId]
  );

  // If negative feedback with correction, add to training data
  if (feedback === 'negative' && (correctedCategory || correctedPriority)) {
    const ticket = await executeQueryOne<any>(
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

      await addTrainingData(
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
export async function calculatePerformanceMetrics(
  modelVersion: string = 'current',
  organizationId?: number
): Promise<ModelPerformanceMetrics> {
  const whereClause = organizationId
    ? 'WHERE organization_id = ?'
    : '';
  const params = organizationId ? [organizationId] : [];

  // Get total predictions
  const totalResult = await executeQueryOne<any>(
    `SELECT COUNT(*) as total FROM ai_classifications ${whereClause}`,
    params
  );
  const totalPredictions = totalResult?.total || 0;

  // Get feedback stats
  const feedbackResult = await executeQueryOne<any>(
    `SELECT
      COUNT(CASE WHEN af.feedback_type = 'positive' THEN 1 END) as positive,
      COUNT(CASE WHEN af.feedback_type = 'negative' THEN 1 END) as negative
    FROM ai_feedback af
    JOIN ai_classifications ac ON af.classification_id = ac.id
    ${whereClause}`,
    params
  );

  // Calculate accuracy (positive feedback / total feedback)
  const totalFeedback = (feedbackResult?.positive || 0) + (feedbackResult?.negative || 0);
  const accuracy = totalFeedback > 0
    ? feedbackResult.positive / totalFeedback
    : 0;

  // Get average confidence
  const confidenceResult = await executeQueryOne<any>(
    `SELECT AVG(confidence_score) as avg_confidence
    FROM ai_classifications ${whereClause}`,
    params
  );

  return {
    modelVersion,
    totalPredictions,
    correctPredictions: feedbackResult?.positive || 0,
    accuracy,
    avgConfidence: confidenceResult?.avg_confidence || 0,
    feedbackPositive: feedbackResult?.positive || 0,
    feedbackNegative: feedbackResult?.negative || 0,
    lastUpdated: new Date(),
  };
}

/**
 * Check if model needs retraining
 */
export async function shouldRetrain(organizationId?: number): Promise<boolean> {
  if (!trainingConfig.autoRetrain) {
    return false;
  }

  const metrics = await calculatePerformanceMetrics('current', organizationId);

  // Retrain if accuracy is below threshold
  if (metrics.accuracy < trainingConfig.accuracyThreshold && metrics.totalPredictions > 100) {
    return true;
  }

  // Retrain if we have enough new training data
  const intervalHours = trainingConfig.retrainingInterval;
  const dateExpr = getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${intervalHours} hours'`
    : `datetime('now', '-${intervalHours} hours')`;

  const newDataQuery = `
    SELECT COUNT(*) as count
    FROM ai_training_data
    WHERE validated = 1
      AND created_at > ${dateExpr}
      ${organizationId ? 'AND organization_id = ?' : ''}
  `;
  const params = organizationId ? [organizationId] : [];
  const newDataResult = await executeQueryOne<any>(newDataQuery, params);

  if (newDataResult && newDataResult.count >= trainingConfig.minDataPoints) {
    return true;
  }

  return false;
}

/**
 * Train or retrain model with collected data
 */
export async function trainModel(
  operationType: 'classification' | 'suggestion' | 'sentiment',
  organizationId?: number
): Promise<TrainingResult> {
  const startTime = Date.now();

  // Collect training data
  const trainingData = await collectTrainingData(operationType, organizationId);

  if (trainingData.length < trainingConfig.minDataPoints) {
    throw new Error(
      `Insufficient training data. Need ${trainingConfig.minDataPoints}, have ${trainingData.length}`
    );
  }

  // Split into training and validation sets
  const shuffled = trainingData.sort(() => Math.random() - 0.5);
  const splitIndex = Math.floor(shuffled.length * (1 - trainingConfig.validationSplit));
  const trainSet = shuffled.slice(0, splitIndex);
  const validationSet = shuffled.slice(splitIndex);

  // Validate model performance
  const validationResults = await validateModel(validationSet);

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
    improvements: generateImprovementSuggestions(validationResults),
  };

  // Store model metadata
  await storeModelMetadata(result, organizationId);

  return result;
}

/**
 * Validate model performance on validation set
 */
async function validateModel(
  validationSet: AITrainingDataEntry[]
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
    const actual = example.actual_output ? JSON.parse(example.actual_output) : null;

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
function generateImprovementSuggestions(validationResults: any): string[] {
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
async function storeModelMetadata(
  result: TrainingResult,
  organizationId?: number
): Promise<void> {
  await executeRun(
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
      organizationId || null
    ]
  );
}

/**
 * Get model training history
 */
export async function getTrainingHistory(limit: number = 10): Promise<TrainingResult[]> {
  const rows = await executeQuery<any>(
    `SELECT * FROM ai_model_versions
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row: any) => ({
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
export async function autoRetrainCheck(): Promise<TrainingResult | null> {
  const needsRetrain = await shouldRetrain();

  if (needsRetrain) {
    logger.info('Auto-retraining triggered...');
    return await trainModel('classification');
  }

  return null;
}

/**
 * Export training data for external analysis
 */
export async function exportTrainingData(
  operationType: 'classification' | 'suggestion' | 'sentiment',
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const data = await collectTrainingData(operationType);

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
        `"${(row.actual_output ?? '').replace(/"/g, '""')}"`,
        row.quality_score,
      ].join(',')
    ),
  ].join('\n');

  return csv;
}

/**
 * Get data quality statistics
 */
export async function getDataQualityStats(): Promise<{
  total: number;
  validated: number;
  highQuality: number;
  avgQualityScore: number;
  byType: Record<string, number>;
}> {
  const stats = await executeQueryOne<any>(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN validated = 1 THEN 1 END) as validated,
      COUNT(CASE WHEN quality_score >= 0.8 THEN 1 END) as high_quality,
      AVG(quality_score) as avg_quality
    FROM ai_training_data
  `);

  const byType = await executeQuery<any>(`
    SELECT data_type, COUNT(*) as count
    FROM ai_training_data
    GROUP BY data_type
  `);

  const byTypeMap: Record<string, number> = {};
  byType.forEach((row: any) => {
    byTypeMap[row.data_type] = row.count;
  });

  return {
    total: stats?.total || 0,
    validated: stats?.validated || 0,
    highQuality: stats?.high_quality || 0,
    avgQualityScore: stats?.avg_quality || 0,
    byType: byTypeMap,
  };
}

// Backward-compatible export object
export const aiTrainingSystem = {
  configure,
  collectTrainingData,
  addTrainingData,
  processFeedback,
  calculatePerformanceMetrics,
  shouldRetrain,
  trainModel,
  getTrainingHistory,
  autoRetrainCheck,
  exportTrainingData,
  getDataQualityStats,
};

export default aiTrainingSystem;
