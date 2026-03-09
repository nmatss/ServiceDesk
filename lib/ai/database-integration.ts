import { executeQuery, executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import {
  AIClassification,
  AISuggestion,
  AITrainingData,
  VectorEmbedding,
  CreateAIClassification,
  CreateAISuggestion,
  CreateAITrainingData,
  CreateVectorEmbedding
} from '../types/database';
import {
  AIOperationContext
} from './types';

// ========================================
// AI CLASSIFICATIONS
// ========================================

export async function saveClassification(
  classification: CreateAIClassification & { ticket_id?: number; suggested_category_id?: number; suggested_priority_id?: number; suggested_category?: string; reasoning?: string },
  context?: AIOperationContext
): Promise<number> {
  const result = await executeRun(`
    INSERT INTO ai_classifications (
      ticket_id, suggested_category_id, suggested_priority_id,
      suggested_category, confidence_score, reasoning,
      model_name, model_version, probability_distribution,
      input_tokens, output_tokens, processing_time_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    classification.ticket_id,
    classification.suggested_category_id,
    classification.suggested_priority_id,
    classification.suggested_category,
    classification.confidence_score,
    classification.reasoning,
    classification.model_name,
    classification.model_version,
    classification.probability_distribution,
    classification.input_tokens,
    classification.output_tokens,
    classification.processing_time_ms
  ]);

  const id = result.lastInsertRowid!;

  // Log audit trail
  if (context) {
    await logAuditTrail(
      'ai_classification',
      id,
      'create',
      null,
      JSON.stringify(classification),
      context
    );
  }

  return id;
}

export async function getClassificationByTicket(ticketId: number): Promise<AIClassification | null> {
  const result = await executeQueryOne<AIClassification>(`
    SELECT * FROM ai_classifications
    WHERE ticket_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [ticketId]);
  return result ?? null;
}

export async function updateClassificationFeedback(
  classificationId: number,
  wasAccepted: boolean,
  correctedCategoryId?: number,
  correctedPriorityId?: number,
  feedbackBy?: number,
  context?: AIOperationContext
): Promise<void> {
  const oldValues = await executeQueryOne<any>(`
    SELECT was_accepted, corrected_category_id, corrected_priority_id
    FROM ai_classifications WHERE id = ?
  `, [classificationId]);

  await executeRun(`
    UPDATE ai_classifications
    SET was_accepted = ?, corrected_category_id = ?, corrected_priority_id = ?,
        feedback_by = ?, feedback_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [wasAccepted, correctedCategoryId, correctedPriorityId, feedbackBy, classificationId]);

  // Log feedback audit
  if (context) {
    await logAuditTrail(
      'ai_classification',
      classificationId,
      'feedback',
      JSON.stringify(oldValues),
      JSON.stringify({ wasAccepted, correctedCategoryId, correctedPriorityId }),
      context
    );
  }
}

// ========================================
// AI SUGGESTIONS
// ========================================

export async function saveSuggestion(
  suggestion: CreateAISuggestion & { ticket_id?: number; content?: string },
  context?: AIOperationContext
): Promise<number> {
  const result = await executeRun(`
    INSERT INTO ai_suggestions (
      ticket_id, suggestion_type, content, confidence_score,
      model_name, source_type, source_references, reasoning
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    suggestion.ticket_id,
    suggestion.suggestion_type,
    suggestion.content,
    suggestion.confidence_score,
    suggestion.model_name,
    suggestion.source_type,
    suggestion.source_references,
    suggestion.reasoning
  ]);

  const id = result.lastInsertRowid!;

  // Log audit trail
  if (context) {
    await logAuditTrail(
      'ai_suggestion',
      id,
      'create',
      null,
      JSON.stringify(suggestion),
      context
    );
  }

  return id;
}

export async function getSuggestionsByTicket(
  ticketId: number,
  suggestionType?: string
): Promise<AISuggestion[]> {
  let query = `
    SELECT * FROM ai_suggestions
    WHERE ticket_id = ?
  `;
  const params: any[] = [ticketId];

  if (suggestionType) {
    query += ` AND suggestion_type = ?`;
    params.push(suggestionType);
  }

  query += ` ORDER BY created_at DESC`;

  return await executeQuery<AISuggestion>(query, params);
}

export async function updateSuggestionFeedback(
  suggestionId: number,
  wasUsed: boolean,
  wasHelpful?: boolean,
  feedbackComment?: string,
  usedBy?: number,
  feedbackBy?: number,
  context?: AIOperationContext
): Promise<void> {
  const oldValues = await executeQueryOne<any>(`
    SELECT was_used, was_helpful, feedback_comment
    FROM ai_suggestions WHERE id = ?
  `, [suggestionId]);

  const updateData: any = { was_used: wasUsed };
  let updateQuery = `UPDATE ai_suggestions SET was_used = ?`;
  const params: (boolean | number | string)[] = [wasUsed];

  if (wasUsed && usedBy) {
    updateQuery += `, used_by = ?, used_at = CURRENT_TIMESTAMP`;
    params.push(usedBy);
    updateData.used_by = usedBy;
  }

  if (wasHelpful !== undefined) {
    updateQuery += `, was_helpful = ?`;
    params.push(wasHelpful);
    updateData.was_helpful = wasHelpful;
  }

  if (feedbackComment) {
    updateQuery += `, feedback_comment = ?`;
    params.push(feedbackComment);
    updateData.feedback_comment = feedbackComment;
  }

  if (feedbackBy) {
    updateQuery += `, feedback_by = ?, feedback_at = CURRENT_TIMESTAMP`;
    params.push(feedbackBy);
    updateData.feedback_by = feedbackBy;
  }

  updateQuery += ` WHERE id = ?`;
  params.push(suggestionId);

  await executeRun(updateQuery, params);

  // Log feedback audit
  if (context) {
    await logAuditTrail(
      'ai_suggestion',
      suggestionId,
      'feedback',
      JSON.stringify(oldValues),
      JSON.stringify(updateData),
      context
    );
  }
}

// ========================================
// TRAINING DATA
// ========================================

export async function saveTrainingData(
  trainingData: CreateAITrainingData,
  context?: AIOperationContext
): Promise<number> {
  const result = await executeRun(`
    INSERT INTO ai_training_data (
      input, output, feedback, model_version, data_type,
      quality_score, source_entity_type, source_entity_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    trainingData.input,
    trainingData.output,
    trainingData.feedback,
    trainingData.model_version,
    trainingData.data_type,
    trainingData.quality_score,
    trainingData.source_entity_type,
    trainingData.source_entity_id,
    trainingData.created_by
  ]);

  const id = result.lastInsertRowid!;

  if (context) {
    await logAuditTrail(
      'ai_training_data',
      id,
      'create',
      null,
      JSON.stringify(trainingData),
      context
    );
  }

  return id;
}

export async function getTrainingData(
  dataType?: string,
  isValidated?: boolean,
  limit?: number
): Promise<AITrainingData[]> {
  let query = `SELECT * FROM ai_training_data WHERE 1=1`;
  const params: any[] = [];

  if (dataType) {
    query += ` AND data_type = ?`;
    params.push(dataType);
  }

  if (isValidated !== undefined) {
    query += ` AND is_validated = ?`;
    params.push(isValidated);
  }

  query += ` ORDER BY created_at DESC`;

  if (limit) {
    query += ` LIMIT ?`;
    params.push(limit);
  }

  return await executeQuery<AITrainingData>(query, params);
}

export async function validateTrainingData(
  trainingDataId: number,
  reviewedBy: number,
  isValidated: boolean,
  context?: AIOperationContext
): Promise<void> {
  const oldValues = await executeQueryOne<any>(`
    SELECT is_validated, reviewed_by FROM ai_training_data WHERE id = ?
  `, [trainingDataId]);

  await executeRun(`
    UPDATE ai_training_data
    SET is_validated = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [isValidated, reviewedBy, trainingDataId]);

  if (context) {
    await logAuditTrail(
      'ai_training_data',
      trainingDataId,
      'validate',
      JSON.stringify(oldValues),
      JSON.stringify({ is_validated: isValidated, reviewed_by: reviewedBy }),
      context
    );
  }
}

// ========================================
// VECTOR EMBEDDINGS
// ========================================

export async function saveEmbedding(
  embedding: CreateVectorEmbedding,
  context?: AIOperationContext
): Promise<number> {
  // Check if embedding already exists
  const existing = await executeQueryOne<any>(`
    SELECT id FROM vector_embeddings
    WHERE entity_type = ? AND entity_id = ? AND model_name = ?
  `, [embedding.entity_type, embedding.entity_id, embedding.model_name]);

  let id: number;

  if (existing) {
    // Update existing embedding
    await executeRun(`
      UPDATE vector_embeddings
      SET embedding_vector = ?, vector_dimension = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [embedding.embedding_vector, embedding.vector_dimension, existing.id]);

    id = existing.id;
  } else {
    // Create new embedding
    const result = await executeRun(`
      INSERT INTO vector_embeddings (
        entity_type, entity_id, embedding_vector, model_name,
        model_version, vector_dimension
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      embedding.entity_type,
      embedding.entity_id,
      embedding.embedding_vector,
      embedding.model_name,
      embedding.model_version,
      embedding.vector_dimension
    ]);

    id = result.lastInsertRowid!;
  }

  if (context) {
    await logAuditTrail(
      'vector_embedding',
      id,
      existing ? 'update' : 'create',
      null,
      JSON.stringify(embedding),
      context
    );
  }

  return id;
}

export async function getEmbedding(
  entityType: string,
  entityId: number,
  modelName?: string
): Promise<VectorEmbedding | null> {
  let query = `
    SELECT * FROM vector_embeddings
    WHERE entity_type = ? AND entity_id = ?
  `;
  const params: any[] = [entityType, entityId];

  if (modelName) {
    query += ` AND model_name = ?`;
    params.push(modelName);
  }

  query += ` ORDER BY updated_at DESC LIMIT 1`;

  const result = await executeQueryOne<VectorEmbedding>(query, params);
  return result ?? null;
}

export async function deleteEmbedding(entityType: string, entityId: number): Promise<void> {
  await executeRun(`
    DELETE FROM vector_embeddings
    WHERE entity_type = ? AND entity_id = ?
  `, [entityType, entityId]);
}

// ========================================
// PERFORMANCE METRICS
// ========================================

export async function getClassificationMetrics(
  periodStart: string,
  periodEnd: string
): Promise<any> {
  return await executeQueryOne<any>(`
    SELECT
      COUNT(*) as total_classifications,
      AVG(confidence_score) as avg_confidence,
      AVG(processing_time_ms) as avg_processing_time,
      COUNT(CASE WHEN was_accepted = 1 THEN 1 END) as accepted_count,
      COUNT(CASE WHEN was_accepted = 0 THEN 1 END) as rejected_count,
      AVG(input_tokens) as avg_input_tokens,
      AVG(output_tokens) as avg_output_tokens
    FROM ai_classifications
    WHERE created_at BETWEEN ? AND ?
  `, [periodStart, periodEnd]);
}

export async function getSuggestionMetrics(
  periodStart: string,
  periodEnd: string
): Promise<any> {
  return await executeQueryOne<any>(`
    SELECT
      COUNT(*) as total_suggestions,
      AVG(confidence_score) as avg_confidence,
      COUNT(CASE WHEN was_used = 1 THEN 1 END) as used_count,
      COUNT(CASE WHEN was_helpful = 1 THEN 1 END) as helpful_count,
      COUNT(CASE WHEN was_helpful = 0 THEN 1 END) as not_helpful_count
    FROM ai_suggestions
    WHERE created_at BETWEEN ? AND ?
  `, [periodStart, periodEnd]);
}

export async function getSentimentMetrics(
  periodStart: string,
  periodEnd: string
): Promise<any> {
  return await executeQueryOne<any>(`
    SELECT
      COUNT(*) as total_analyses,
      COUNT(CASE WHEN content LIKE '%"sentiment":"positive"%' THEN 1 END) as positive_count,
      COUNT(CASE WHEN content LIKE '%"sentiment":"neutral"%' THEN 1 END) as neutral_count,
      COUNT(CASE WHEN content LIKE '%"sentiment":"negative"%' THEN 1 END) as negative_count,
      COUNT(CASE WHEN content LIKE '%"immediateAttentionRequired":true%' THEN 1 END) as urgent_count
    FROM ai_suggestions
    WHERE created_at BETWEEN ? AND ?
      AND suggestion_type = 'sentiment_analysis'
  `, [periodStart, periodEnd]);
}

export async function getModelUsageStats(
  periodStart: string,
  periodEnd: string
): Promise<any[]> {
  return await executeQuery<any>(`
    SELECT
      model_name,
      COUNT(*) as usage_count,
      AVG(confidence_score) as avg_confidence,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      AVG(processing_time_ms) as avg_processing_time
    FROM (
      SELECT model_name, confidence_score, input_tokens, output_tokens, processing_time_ms
      FROM ai_classifications
      WHERE created_at BETWEEN ? AND ?
      UNION ALL
      SELECT model_name, confidence_score, 0 as input_tokens, 0 as output_tokens, 0 as processing_time_ms
      FROM ai_suggestions
      WHERE created_at BETWEEN ? AND ?
        AND model_name IS NOT NULL
    ) combined
    GROUP BY model_name
    ORDER BY usage_count DESC
  `, [periodStart, periodEnd, periodStart, periodEnd]);
}

// ========================================
// AUDIT TRAIL
// ========================================

async function logAuditTrail(
  entityType: string,
  entityId: number,
  action: string,
  oldValues: string | null,
  newValues: string | null,
  context: AIOperationContext
): Promise<void> {
  await executeRun(`
    INSERT INTO audit_advanced (
      entity_type, entity_id, action, old_values, new_values,
      user_id, session_id, ip_address, request_id, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    entityType,
    entityId,
    action,
    oldValues,
    newValues,
    context.userId,
    context.sessionId,
    context.ipAddress,
    context.requestId,
    context.organizationId || 1
  ]);
}

// ========================================
// BATCH OPERATIONS
// ========================================

export async function batchCreateTrainingData(
  trainingDataList: CreateAITrainingData[],
  context?: AIOperationContext
): Promise<number[]> {
  return await executeTransaction(async (db) => {
    const results: number[] = [];
    for (const trainingData of trainingDataList) {
      const id = await saveTrainingData(trainingData, context);
      results.push(id);
    }
    return results;
  });
}

export async function cleanupOldAIData(olderThanDays: number = 90): Promise<{
  classificationsDeleted: number;
  suggestionsDeleted: number;
  embeddingsDeleted: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffString = cutoffDate.toISOString();

  const classificationsResult = await executeRun(`
    DELETE FROM ai_classifications
    WHERE created_at < ? AND was_accepted IS NULL
  `, [cutoffString]);

  const suggestionsResult = await executeRun(`
    DELETE FROM ai_suggestions
    WHERE created_at < ? AND was_used = 0
  `, [cutoffString]);

  // Don't delete embeddings automatically as they're expensive to regenerate
  const embeddingsResult = { changes: 0 };

  return {
    classificationsDeleted: classificationsResult.changes || 0,
    suggestionsDeleted: suggestionsResult.changes || 0,
    embeddingsDeleted: embeddingsResult.changes || 0
  };
}

// ========================================
// HEALTH CHECK
// ========================================

export async function getAISystemHealth(): Promise<{
  isHealthy: boolean;
  issues: string[];
  stats: any;
}> {
  const issues: string[] = [];
  const stats: any = {};

  const dateExpr24h = getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '24 hours'`
    : `datetime('now', '-24 hours')`;

  const dateExpr7d = getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '7 days'`
    : `datetime('now', '-7 days')`;

  try {
    // Check recent AI operations
    const recentClassifications = await executeQueryOne<any>(`
      SELECT COUNT(*) as count FROM ai_classifications
      WHERE created_at >= ${dateExpr24h}
    `);

    const recentSuggestions = await executeQueryOne<any>(`
      SELECT COUNT(*) as count FROM ai_suggestions
      WHERE created_at >= ${dateExpr24h}
    `);

    const embeddingCount = await executeQueryOne<any>(`
      SELECT COUNT(*) as count FROM vector_embeddings
    `);

    stats.recentClassifications = recentClassifications?.count || 0;
    stats.recentSuggestions = recentSuggestions?.count || 0;
    stats.totalEmbeddings = embeddingCount?.count || 0;

    // Check for issues
    if (stats.recentClassifications === 0) {
      issues.push('No AI classifications in the last 24 hours');
    }

    if (stats.totalEmbeddings === 0) {
      issues.push('No vector embeddings found');
    }

    // Check for high error rates
    const errorRate = await executeQueryOne<any>(`
      SELECT
        COUNT(CASE WHEN was_accepted = 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as error_rate
      FROM ai_classifications
      WHERE created_at >= ${dateExpr7d}
        AND was_accepted IS NOT NULL
    `);

    if (errorRate && errorRate.error_rate > 30) {
      issues.push(`High classification error rate: ${errorRate.error_rate.toFixed(1)}%`);
    }

    stats.errorRate = errorRate?.error_rate || 0;

  } catch (error) {
    issues.push(`Database health check failed: ${error}`);
  }

  return {
    isHealthy: issues.length === 0,
    issues,
    stats
  };
}

// Backward compatibility - export as class-like object
export const aiDatabaseService = {
  saveClassification,
  getClassificationByTicket,
  updateClassificationFeedback,
  saveSuggestion,
  getSuggestionsByTicket,
  updateSuggestionFeedback,
  saveTrainingData,
  getTrainingData,
  validateTrainingData,
  saveEmbedding,
  getEmbedding,
  deleteEmbedding,
  getClassificationMetrics,
  getSuggestionMetrics,
  getSentimentMetrics,
  getModelUsageStats,
  batchCreateTrainingData,
  cleanupOldAIData,
  getAISystemHealth
};

export default aiDatabaseService;
