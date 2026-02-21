/**
 * Embedding Utilities
 *
 * Provides utility functions for working with embeddings, including:
 * - Text preprocessing for optimal embedding generation
 * - Incremental embedding updates
 * - Embedding quality metrics
 * - Auto-embedding for new content
 */

import { VectorDatabase, BatchEmbeddingJob, BatchProcessingResult } from './vector-database';
import logger from '../monitoring/structured-logger';
import { executeQuery, executeQueryOne } from '../db/adapter';

export interface TextPreprocessingOptions {
  maxLength?: number;
  removeStopWords?: boolean;
  normalizeWhitespace?: boolean;
  removeDuplicateSpaces?: boolean;
  toLowerCase?: boolean;
}

export interface EmbeddingQualityMetrics {
  textLength: number;
  wordCount: number;
  hasSubstantiveContent: boolean;
  estimatedQuality: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface IncrementalUpdateOptions {
  entityTypes?: string[];
  olderThanHours?: number;
  batchSize?: number;
  priority?: number;
}

/**
 * Preprocess text for optimal embedding generation
 */
export function preprocessTextForEmbedding(
  text: string,
  options: TextPreprocessingOptions = {}
): string {
  const {
    maxLength = 8000,
    removeStopWords = false,
    normalizeWhitespace = true,
    removeDuplicateSpaces = true,
    toLowerCase = false
  } = options;

  let processed = text;

  // Normalize whitespace
  if (normalizeWhitespace) {
    processed = processed.replace(/\s+/g, ' ').trim();
  }

  // Remove duplicate spaces
  if (removeDuplicateSpaces) {
    processed = processed.replace(/  +/g, ' ');
  }

  // Convert to lowercase if requested
  if (toLowerCase) {
    processed = processed.toLowerCase();
  }

  // Remove common stop words (optional)
  if (removeStopWords) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'o', 'a', 'e', 'de', 'da', 'do', 'em', 'para', 'com', 'por'
    ]);

    const words = processed.split(' ');
    processed = words
      .filter(word => !stopWords.has(word.toLowerCase()))
      .join(' ');
  }

  // Truncate to max length (preserve word boundaries)
  if (processed.length > maxLength) {
    processed = processed.substring(0, maxLength);
    const lastSpaceIndex = processed.lastIndexOf(' ');
    if (lastSpaceIndex > 0) {
      processed = processed.substring(0, lastSpaceIndex);
    }
    processed += '...';
  }

  return processed;
}

/**
 * Analyze text quality for embedding generation
 */
export function analyzeEmbeddingQuality(text: string): EmbeddingQualityMetrics {
  const warnings: string[] = [];
  const textLength = text.length;
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  // Check for minimum content
  let hasSubstantiveContent = true;
  if (textLength < 10) {
    warnings.push('Text is very short (< 10 characters)');
    hasSubstantiveContent = false;
  }

  if (wordCount < 3) {
    warnings.push('Text has very few words (< 3)');
    hasSubstantiveContent = false;
  }

  // Check for excessive length
  if (textLength > 8000) {
    warnings.push('Text is very long (> 8000 characters), will be truncated');
  }

  // Check for repetitive content
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniquenessRatio = uniqueWords.size / wordCount;
  if (uniquenessRatio < 0.3 && wordCount > 10) {
    warnings.push('Text appears highly repetitive');
  }

  // Estimate quality
  let estimatedQuality: 'high' | 'medium' | 'low';
  if (!hasSubstantiveContent || warnings.length > 2) {
    estimatedQuality = 'low';
  } else if (warnings.length > 0 || uniquenessRatio < 0.5) {
    estimatedQuality = 'medium';
  } else {
    estimatedQuality = 'high';
  }

  return {
    textLength,
    wordCount,
    hasSubstantiveContent,
    estimatedQuality,
    warnings
  };
}

/**
 * Prepare content for embedding (combine title and description)
 */
export function prepareTicketContent(
  title: string,
  description: string,
  options: TextPreprocessingOptions = {}
): string {
  const combined = `${title}\n\n${description}`;
  return preprocessTextForEmbedding(combined, options);
}

/**
 * Prepare knowledge base article for embedding
 */
export function prepareKnowledgeArticleContent(
  title: string,
  summary: string | null,
  content: string,
  options: TextPreprocessingOptions = {}
): string {
  const parts = [title];
  if (summary) parts.push(summary);
  parts.push(content);

  const combined = parts.join('\n\n');
  return preprocessTextForEmbedding(combined, options);
}

/**
 * Get entities that need embeddings generated
 */
export async function getEntitiesNeedingEmbeddings(
  _vectorDb: VectorDatabase,
  options: IncrementalUpdateOptions = {}
): Promise<BatchEmbeddingJob[]> {
  const {
    entityTypes = ['ticket', 'kb_article'],
    olderThanHours = 24,
    batchSize = 100,
    priority = 5
  } = options;

  const jobs: BatchEmbeddingJob[] = [];
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

  try {
    // Get tickets needing embeddings
    if (entityTypes.includes('ticket')) {
      const tickets = await executeQuery<{
        id: number;
        title: string;
        description: string | null;
      }>(`
        SELECT t.id, t.title, t.description
        FROM tickets t
        LEFT JOIN vector_embeddings ve ON ve.entity_type = 'ticket'
          AND ve.entity_id = t.id
        WHERE ve.id IS NULL
          OR ve.updated_at < ?
        ORDER BY t.created_at DESC
        LIMIT ?
      `, [cutoffTime, batchSize]);

      for (const ticket of tickets) {
        const content = prepareTicketContent(ticket.title, ticket.description || '');
        const quality = analyzeEmbeddingQuality(content);

        if (quality.hasSubstantiveContent) {
          jobs.push({
            entityType: 'ticket',
            entityId: ticket.id,
            content,
            priority: quality.estimatedQuality === 'high' ? priority + 2 : priority
          });
        }
      }
    }

    // Get knowledge base articles needing embeddings
    if (entityTypes.includes('kb_article')) {
      const articles = await executeQuery<{
        id: number;
        title: string;
        summary: string | null;
        content: string | null;
      }>(`
        SELECT ka.id, ka.title, ka.summary, ka.content
        FROM kb_articles ka
        LEFT JOIN vector_embeddings ve ON ve.entity_type = 'kb_article'
          AND ve.entity_id = ka.id
        WHERE ka.status = 'published'
          AND (ve.id IS NULL OR ve.updated_at < ?)
        ORDER BY ka.updated_at DESC
        LIMIT ?
      `, [cutoffTime, batchSize]);

      for (const article of articles) {
        const content = prepareKnowledgeArticleContent(
          article.title,
          article.summary,
          article.content || ''
        );
        const quality = analyzeEmbeddingQuality(content);

        if (quality.hasSubstantiveContent) {
          jobs.push({
            entityType: 'kb_article',
            entityId: article.id,
            content,
            priority: priority + 3 // KB articles get higher priority
          });
        }
      }
    }

    // Get comments needing embeddings (lower priority)
    if (entityTypes.includes('comment')) {
      const comments = await executeQuery<{
        id: number;
        content: string;
      }>(`
        SELECT c.id, c.content
        FROM comments c
        LEFT JOIN vector_embeddings ve ON ve.entity_type = 'comment'
          AND ve.entity_id = c.id
        WHERE ve.id IS NULL
          OR ve.updated_at < ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `, [cutoffTime, Math.floor(batchSize / 2)]); // Fewer comments

      for (const comment of comments) {
        const content = preprocessTextForEmbedding(comment.content);
        const quality = analyzeEmbeddingQuality(content);

        if (quality.hasSubstantiveContent) {
          jobs.push({
            entityType: 'comment',
            entityId: comment.id,
            content,
            priority: priority - 2 // Lower priority for comments
          });
        }
      }
    }

    logger.info('Found entities needing embeddings', {
      total: jobs.length,
      byType: jobs.reduce((acc, job) => {
        acc[job.entityType] = (acc[job.entityType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

  } catch (error) {
    logger.error('Error finding entities needing embeddings', error);
  }

  return jobs;
}

/**
 * Auto-generate embeddings for new content
 */
export async function autoGenerateEmbeddings(
  vectorDb: VectorDatabase,
  options: IncrementalUpdateOptions = {}
): Promise<BatchProcessingResult> {
  try {
    logger.info('Starting auto-generate embeddings');

    // Get entities that need embeddings
    const jobs = await getEntitiesNeedingEmbeddings(vectorDb, options);

    if (jobs.length === 0) {
      logger.info('No entities need embeddings');
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        processingTimeMs: 0
      };
    }

    // Batch process
    const result = await vectorDb.batchGenerateEmbeddings(jobs);

    logger.info('Auto-generate embeddings completed', result);
    return result;

  } catch (error) {
    logger.error('Error in auto-generate embeddings', error);
    throw error;
  }
}

/**
 * Update embeddings for specific entity when content changes
 */
export async function updateEmbeddingOnChange(
  vectorDb: VectorDatabase,
  entityType: 'ticket' | 'kb_article' | 'comment',
  entityId: number
): Promise<boolean> {
  try {
    let content = '';

    // Fetch entity content
    if (entityType === 'ticket') {
      const ticket = await executeQueryOne<{ title: string; description: string | null }>(
        'SELECT title, description FROM tickets WHERE id = ?'
      , [entityId]);
      if (ticket) {
        content = prepareTicketContent(ticket.title, ticket.description || '');
      }
    } else if (entityType === 'kb_article') {
      const article = await executeQueryOne<{ title: string; summary: string | null; content: string | null }>(
        'SELECT title, summary, content FROM kb_articles WHERE id = ?'
      , [entityId]);
      if (article) {
        content = prepareKnowledgeArticleContent(
          article.title,
          article.summary,
          article.content || ''
        );
      }
    } else if (entityType === 'comment') {
      const comment = await executeQueryOne<{ content: string }>(
        'SELECT content FROM comments WHERE id = ?'
      , [entityId]);
      if (comment) {
        content = preprocessTextForEmbedding(comment.content);
      }
    }

    if (!content) {
      logger.warn('Entity not found for embedding update', { entityType, entityId });
      return false;
    }

    // Check quality
    const quality = analyzeEmbeddingQuality(content);
    if (!quality.hasSubstantiveContent) {
      logger.warn('Content quality too low for embedding', { entityType, entityId, quality });
      return false;
    }

    // Generate and store embedding
    await vectorDb.generateAndStoreEmbedding(entityType, entityId, content);
    logger.info('Embedding updated on content change', { entityType, entityId });

    return true;

  } catch (error) {
    logger.error('Error updating embedding on change', error);
    return false;
  }
}

/**
 * Schedule periodic embedding updates (can be called from a cron job)
 */
export async function schedulePeriodicEmbeddingUpdates(
  vectorDb: VectorDatabase
): Promise<BatchProcessingResult> {
  try {
    logger.info('Starting scheduled embedding updates');

    // Update older embeddings (more than 7 days old)
    const result = await autoGenerateEmbeddings(vectorDb, {
      entityTypes: ['ticket', 'kb_article', 'comment'],
      olderThanHours: 168, // 7 days
      batchSize: 50,
      priority: 3
    });

    return result;

  } catch (error) {
    logger.error('Error in scheduled embedding updates', error);
    throw error;
  }
}

/**
 * Export utility functions
 */
export default {
  preprocessTextForEmbedding,
  analyzeEmbeddingQuality,
  prepareTicketContent,
  prepareKnowledgeArticleContent,
  getEntitiesNeedingEmbeddings,
  autoGenerateEmbeddings,
  updateEmbeddingOnChange,
  schedulePeriodicEmbeddingUpdates
};
