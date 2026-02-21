import { openAIClient } from './openai-client';
import logger from '../monitoring/structured-logger';
import { aiCache } from './cache';
import { cosineSimilarity } from './utils';
import { createHash } from 'crypto';
import { getDatabase, type DatabaseAdapter } from '../db/adapter';

export interface SearchResult {
  entityType: string;
  entityId: number;
  similarityScore: number;
  content?: string;
  metadata?: Record<string, unknown>;
  distance?: number;
}

export interface EmbeddingGenerationResult {
  embeddingId: number;
  vectorDimension: number;
  processingTimeMs: number;
  modelName: string;
  modelVersion: string;
  cached?: boolean;
}

export interface SimilaritySearchOptions {
  threshold?: number;
  maxResults?: number;
  entityTypes?: string[];
  excludeEntityIds?: number[];
  includeMetadata?: boolean;
  useCache?: boolean;
}

export interface BatchEmbeddingJob {
  entityType: string;
  entityId: number;
  content: string;
  priority?: number;
}

export interface BatchProcessingResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ entityId: number; error: string }>;
  processingTimeMs: number;
}

type VectorDatabaseClient = Pick<DatabaseAdapter, 'get' | 'all' | 'run'>;

export class VectorDatabase {
  private static readonly DEFAULT_MODEL = 'text-embedding-3-small';
  private static readonly SIMILARITY_THRESHOLD = 0.75;
  private static readonly BATCH_SIZE = 20;

  private db: VectorDatabaseClient;

  constructor(database?: VectorDatabaseClient) {
    this.db = database ?? getDatabase();
  }

  /**
   * Gera embedding para um texto e armazena no banco (com cache)
   */
  async generateAndStoreEmbedding(
    entityType: string,
    entityId: number,
    content: string,
    modelName: string = VectorDatabase.DEFAULT_MODEL,
    useCache: boolean = true
  ): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();

    try {
      let embedding: number[] | undefined;
      let cached = false;

      // Check cache first if enabled
      if (useCache) {
        const cachedEmbedding = aiCache.getEmbedding(content, modelName);
        if (cachedEmbedding) {
          embedding = cachedEmbedding;
          cached = true;
          logger.debug('Using cached embedding', { entityType, entityId });
        }
      }

      // Generate embedding if not cached
      if (!embedding) {
        const embeddingResponse = await openAIClient.createEmbedding(content, modelName);
        const embeddingData = embeddingResponse.data[0]?.embedding;

        if (!embeddingData) {
          throw new Error('Failed to generate embedding: no data returned');
        }

        embedding = embeddingData;
        cached = false;

        // Store in cache for future use
        if (useCache) {
          aiCache.setEmbedding(content, modelName, embedding);
        }
      }

      // Converter para JSON string para armazenar no SQLite
      const embeddingVector = JSON.stringify(embedding);

      // Verificar se já existe embedding para esta entidade
      const existingEmbedding = await this.db.get<{ id: number }>(`
        SELECT id FROM vector_embeddings
        WHERE entity_type = ? AND entity_id = ? AND model_name = ?
      `, [entityType, entityId, modelName]);

      let embeddingId: number;

      if (existingEmbedding) {
        // Atualizar embedding existente
        await this.db.run(`
          UPDATE vector_embeddings
          SET embedding_vector = ?, vector_dimension = ?, updated_at = CURRENT_TIMESTAMP
          WHERE entity_type = ? AND entity_id = ? AND model_name = ?
        `, [embeddingVector, embedding.length, entityType, entityId, modelName]);

        embeddingId = existingEmbedding.id;
      } else {
        // Criar novo embedding
        const result = await this.db.run(`
          INSERT INTO vector_embeddings (
            entity_type, entity_id, embedding_vector, model_name,
            model_version, vector_dimension
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          entityType,
          entityId,
          embeddingVector,
          modelName,
          '1.0',
          embedding.length
        ]);

        if (typeof result.lastInsertRowid === 'number') {
          embeddingId = result.lastInsertRowid;
        } else {
          const insertedEmbedding = await this.db.get<{ id: number }>(`
            SELECT id FROM vector_embeddings
            WHERE entity_type = ? AND entity_id = ? AND model_name = ?
          `, [entityType, entityId, modelName]);

          if (!insertedEmbedding) {
            throw new Error('Failed to resolve inserted embedding id');
          }

          embeddingId = insertedEmbedding.id;
        }
      }

      return {
        embeddingId,
        vectorDimension: embedding.length,
        processingTimeMs: Date.now() - startTime,
        modelName,
        modelVersion: '1.0',
        cached
      };

    } catch (error) {
      logger.error('Error generating embedding', error);
      throw new Error('Failed to generate and store embedding');
    }
  }

  /**
   * Batch process embeddings for multiple entities
   */
  async batchGenerateEmbeddings(
    jobs: BatchEmbeddingJob[],
    modelName: string = VectorDatabase.DEFAULT_MODEL
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const results: BatchProcessingResult = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      processingTimeMs: 0
    };

    try {
      // Sort by priority (higher priority first)
      const sortedJobs = jobs.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Process in batches to respect rate limits
      for (let i = 0; i < sortedJobs.length; i += VectorDatabase.BATCH_SIZE) {
        const batch = sortedJobs.slice(i, i + VectorDatabase.BATCH_SIZE);

        // Process batch concurrently (but limited)
        const batchPromises = batch.map(async (job) => {
          try {
            // Check if embedding already exists and is recent
            const existing = await this.db.get<{ id: number; updated_at: string }>(`
              SELECT id, updated_at FROM vector_embeddings
              WHERE entity_type = ? AND entity_id = ? AND model_name = ?
            `, [job.entityType, job.entityId, modelName]);

            // Skip if updated recently (within 24 hours)
            if (existing) {
              const updatedAt = new Date(existing.updated_at);
              const now = new Date();
              const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

              if (hoursSinceUpdate < 24) {
                results.skipped++;
                return;
              }
            }

            await this.generateAndStoreEmbedding(
              job.entityType,
              job.entityId,
              job.content,
              modelName
            );
            results.successful++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              entityId: job.entityId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            logger.error(`Failed to generate embedding for ${job.entityType} ${job.entityId}`, error);
          }
        });

        await Promise.all(batchPromises);

        // Rate limiting pause between batches
        if (i + VectorDatabase.BATCH_SIZE < sortedJobs.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      logger.error('Error in batch embedding generation', error);
      throw error;
    }

    results.processingTimeMs = Date.now() - startTime;
    return results;
  }

  /**
   * Busca similaridade usando cosine similarity (com cache)
   */
  async searchSimilar(
    queryText: string,
    options: SimilaritySearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      threshold = VectorDatabase.SIMILARITY_THRESHOLD,
      maxResults = 10,
      entityTypes,
      excludeEntityIds = [],
      useCache = true
    } = options;

    try {
      // Check search cache
      if (useCache) {
        const cached = aiCache.getSearchResults(queryText, options);
        if (cached) {
          logger.debug('Search cache hit', { queryText });
          return cached;
        }
      }

      // Gerar embedding para a consulta (use cache for embeddings)
      let queryVector: number[];
      const cachedEmbedding = aiCache.getEmbedding(queryText, VectorDatabase.DEFAULT_MODEL);

      if (cachedEmbedding) {
        queryVector = cachedEmbedding;
      } else {
        const queryEmbedding = await openAIClient.createEmbedding(queryText);
        const embeddingData = queryEmbedding.data[0]?.embedding;

        if (!embeddingData) {
          throw new Error('Failed to generate query embedding: no data returned');
        }

        queryVector = embeddingData;
        aiCache.setEmbedding(queryText, VectorDatabase.DEFAULT_MODEL, queryVector);
      }

      // Buscar embeddings existentes
      let whereClause = '';
      const params: (string | number)[] = [];

      if (entityTypes && entityTypes.length > 0) {
        whereClause += ` AND entity_type IN (${entityTypes.map(() => '?').join(',')})`;
        params.push(...entityTypes);
      }

      if (excludeEntityIds.length > 0) {
        whereClause += ` AND entity_id NOT IN (${excludeEntityIds.map(() => '?').join(',')})`;
        params.push(...excludeEntityIds);
      }

      const embeddings = await this.db.all<{ entity_type: string; entity_id: number; embedding_vector: string }>(`
        SELECT entity_type, entity_id, embedding_vector
        FROM vector_embeddings
        WHERE model_name = ?${whereClause}
      `, [VectorDatabase.DEFAULT_MODEL, ...params]);

      // Calcular similaridade cosine
      const results: SearchResult[] = [];

      for (const embedding of embeddings) {
        try {
          const storedVector = JSON.parse(embedding.embedding_vector);
          const similarity = cosineSimilarity(queryVector, storedVector);

          if (similarity >= threshold) {
            results.push({
              entityType: embedding.entity_type,
              entityId: embedding.entity_id,
              similarityScore: similarity
            });
          }
        } catch (error) {
          logger.warn('Failed to parse embedding vector', error);
        }
      }

      // Ordenar por similaridade (maior primeiro) e limitar resultados
      const sortedResults = results
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, maxResults);

      // Cache search results
      if (useCache && sortedResults.length > 0) {
        aiCache.setSearchResults(queryText, sortedResults, options);
      }

      return sortedResults;

    } catch (error) {
      logger.error('Error searching similar embeddings', error);
      return [];
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): { embeddingsClearedCount: number; searchesClearedCount: number } {
    const result = aiCache.clearAll();
    logger.info('Caches cleared', result);
    return {
      embeddingsClearedCount: result.embeddings,
      searchesClearedCount: result.searches
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    embeddings: { size: number; max: number };
    searches: { size: number; max: number };
  } {
    return {
      embeddings: aiCache.getEmbeddingStats(),
      searches: aiCache.getSearchStats()
    };
  }

  /**
   * Busca duplicatas potenciais baseadas em alta similaridade
   */
  async findPotentialDuplicates(
    entityType: string,
    content: string,
    highThreshold: number = 0.9
  ): Promise<SearchResult[]> {
    return this.searchSimilar(content, {
      threshold: highThreshold,
      maxResults: 5,
      entityTypes: [entityType]
    });
  }

  /**
   * Busca artigos da knowledge base relacionados
   */
  async findRelatedKnowledgeArticles(
    queryText: string,
    maxResults: number = 5
  ): Promise<SearchResult[]> {
    const results = await this.searchSimilar(queryText, {
      threshold: 0.6, // Threshold mais baixo para KB
      maxResults,
      entityTypes: ['kb_article']
    });

    // Enriquecer resultados com dados dos artigos
    for (const result of results) {
      try {
        const article = await this.db.get<{ title: string; summary?: string; content?: string }>(`
          SELECT title, summary, content
          FROM kb_articles
          WHERE id = ? AND status = 'published'
        `, [result.entityId]);

        if (article) {
          result.content = article.title;
          result.metadata = {
            summary: article.summary,
            content: article.content?.substring(0, 200) + '...'
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch article data', error);
      }
    }

    return results;
  }

  /**
   * Busca tickets similares
   */
  async findSimilarTickets(
    ticketTitle: string,
    ticketDescription: string,
    excludeTicketId?: number,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    const queryText = `${ticketTitle} ${ticketDescription}`;
    const excludeIds = excludeTicketId ? [excludeTicketId] : [];

    const results = await this.searchSimilar(queryText, {
      threshold: 0.7,
      maxResults,
      entityTypes: ['ticket'],
      excludeEntityIds: excludeIds
    });

    // Enriquecer resultados com dados dos tickets
    for (const result of results) {
      try {
        const ticket = await this.db.get<{
          title: string;
          description?: string;
          category_name: string;
          priority_name: string;
          status_name: string;
          created_at: string;
        }>(`
          SELECT t.title, t.description, c.name as category_name, p.name as priority_name,
                 s.name as status_name, t.created_at
          FROM tickets t
          JOIN categories c ON t.category_id = c.id
          JOIN priorities p ON t.priority_id = p.id
          JOIN statuses s ON t.status_id = s.id
          WHERE t.id = ?
        `, [result.entityId]);

        if (ticket) {
          result.content = ticket.title;
          result.metadata = {
            description: ticket.description?.substring(0, 200) + '...',
            category: ticket.category_name,
            priority: ticket.priority_name,
            status: ticket.status_name,
            createdAt: ticket.created_at
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch ticket data', error);
      }
    }

    return results;
  }

  /**
   * Regenera embeddings para todas as entidades de um tipo
   */
  async regenerateEmbeddings(
    entityType: string,
    batchSize: number = 10
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Buscar entidades que precisam de embeddings
      let entities: Array<{ id: number; content: string }> = [];

      switch (entityType) {
        case 'ticket':
          entities = await this.db.all<{ id: number; content: string }>(`
            SELECT id, title || ' ' || description as content
            FROM tickets
          `);
          break;

        case 'kb_article':
          entities = await this.db.all<{ id: number; content: string }>(`
            SELECT id, title || ' ' || COALESCE(summary, '') || ' ' || content as content
            FROM kb_articles
            WHERE status = 'published'
          `);
          break;

        case 'comment':
          entities = await this.db.all<{ id: number; content: string }>(`
            SELECT id, content
            FROM comments
          `);
          break;

        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }

      // Processar em lotes
      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);

        for (const entity of batch) {
          try {
            await this.generateAndStoreEmbedding(
              entityType,
              entity.id,
              entity.content
            );
            processed++;
          } catch (error) {
            logger.error(`Failed to generate embedding for ${entityType} ${entity.id}:`, error);
            errors++;
          }
        }

        // Pequena pausa entre lotes para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      logger.error('Error regenerating embeddings', error);
      throw error;
    }

    return { processed, errors };
  }

  /**
   * Remove embeddings antigos ou órfãos
   */
  async cleanupEmbeddings(): Promise<number> {
    try {
      // Remover embeddings de entidades que não existem mais
      const result = await this.db.run(`
        DELETE FROM vector_embeddings
        WHERE (entity_type = 'ticket' AND entity_id NOT IN (SELECT id FROM tickets))
           OR (entity_type = 'kb_article' AND entity_id NOT IN (SELECT id FROM kb_articles))
           OR (entity_type = 'comment' AND entity_id NOT IN (SELECT id FROM comments))
      `);

      return result.changes || 0;
    } catch (error) {
      logger.error('Error cleaning up embeddings', error);
      return 0;
    }
  }

  /**
   * Obtém estatísticas do banco de embeddings
   */
  async getStats(): Promise<{
    totalEmbeddings: number;
    embeddingsByType: Record<string, number>;
    averageVectorDimension: number;
    oldestEmbedding?: string;
    newestEmbedding?: string;
  }> {
    try {
      const totalResult = await this.db.get<{ total: number }>(`
        SELECT COUNT(*) as total FROM vector_embeddings
      `);

      const byTypeResults = await this.db.all<{ entity_type: string; count: number }>(`
        SELECT entity_type, COUNT(*) as count
        FROM vector_embeddings
        GROUP BY entity_type
      `);

      const avgDimensionResult = await this.db.get<{ avg_dimension: number | null }>(`
        SELECT AVG(vector_dimension) as avg_dimension
        FROM vector_embeddings
      `);

      const dateRangeResult = await this.db.get<{ oldest?: string; newest?: string }>(`
        SELECT
          MIN(created_at) as oldest,
          MAX(updated_at) as newest
        FROM vector_embeddings
      `);

      const embeddingsByType: Record<string, number> = {};
      byTypeResults.forEach(row => {
        embeddingsByType[row.entity_type] = row.count;
      });

      return {
        totalEmbeddings: totalResult?.total ?? 0,
        embeddingsByType,
        averageVectorDimension: Math.round(avgDimensionResult?.avg_dimension ?? 0),
        oldestEmbedding: dateRangeResult?.oldest,
        newestEmbedding: dateRangeResult?.newest
      };

    } catch (error) {
      logger.error('Error getting embeddings stats', error);
      return {
        totalEmbeddings: 0,
        embeddingsByType: {},
        averageVectorDimension: 0
      };
    }
  }

  /**
   * Atualiza embeddings quando conteúdo é modificado
   */
  async updateEmbeddingOnContentChange(
    entityType: string,
    entityId: number,
    newContent: string
  ): Promise<boolean> {
    try {
      await this.generateAndStoreEmbedding(entityType, entityId, newContent);
      return true;
    } catch (error) {
      logger.error('Error updating embedding on content change', error);
      return false;
    }
  }

  /**
   * Busca híbrida: combina busca textual com similaridade semântica
   */
  async hybridSearch(
    query: string,
    entityType: string,
    textSearchWeight: number = 0.3,
    semanticSearchWeight: number = 0.7
  ): Promise<SearchResult[]> {
    try {
      // Busca semântica
      const semanticResults = await this.searchSimilar(query, {
        entityTypes: [entityType],
        maxResults: 20
      });

      // Busca textual (implementação básica)
      const textResults = await this.performTextSearch(query, entityType);

      // Combinar resultados e calcular score híbrido
      const hybridResults = new Map<string, SearchResult>();

      // Adicionar resultados semânticos
      semanticResults.forEach(result => {
        const key = `${result.entityType}_${result.entityId}`;
        hybridResults.set(key, {
          ...result,
          similarityScore: result.similarityScore * semanticSearchWeight
        });
      });

      // Adicionar/combinar resultados textuais
      textResults.forEach(result => {
        const key = `${result.entityType}_${result.entityId}`;
        const existing = hybridResults.get(key);

        if (existing) {
          // Combinar scores
          existing.similarityScore += result.similarityScore * textSearchWeight;
        } else {
          hybridResults.set(key, {
            ...result,
            similarityScore: result.similarityScore * textSearchWeight
          });
        }
      });

      // Converter para array, ordenar e retornar top 10
      return Array.from(hybridResults.values())
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 10);

    } catch (error) {
      logger.error('Error in hybrid search', error);
      return [];
    }
  }

  /**
   * Busca textual simples (fallback)
   */
  private async performTextSearch(
    query: string,
    entityType: string
  ): Promise<SearchResult[]> {
    const words = query.toLowerCase().split(' ').filter(w => w.length > 2);
    if (words.length === 0) return [];

    try {
      let searchQuery = '';
      let params: string[] = [];

      switch (entityType) {
        case 'ticket':
          searchQuery = `
            SELECT id, title, description,
                   (CASE
                    WHEN LOWER(title) LIKE ? THEN 0.8
                    WHEN LOWER(description) LIKE ? THEN 0.6
                    ELSE 0.3
                   END) as score
            FROM tickets
            WHERE LOWER(title || ' ' || description) LIKE ?
            ORDER BY score DESC
            LIMIT 20
          `;
          const likePattern = `%${words.join('%')}%`;
          params = [likePattern, likePattern, likePattern];
          break;

        case 'kb_article':
          searchQuery = `
            SELECT id, title, content,
                   (CASE
                    WHEN LOWER(title) LIKE ? THEN 0.9
                    WHEN LOWER(content) LIKE ? THEN 0.7
                    ELSE 0.4
                   END) as score
            FROM kb_articles
            WHERE status = 'published'
              AND LOWER(title || ' ' || content) LIKE ?
            ORDER BY score DESC
            LIMIT 20
          `;
          const kbLikePattern = `%${words.join('%')}%`;
          params = [kbLikePattern, kbLikePattern, kbLikePattern];
          break;

        default:
          return [];
      }

      const results = await this.db.all<{ id: number; score: number; title?: string; content?: string; description?: string }>(searchQuery, params);

      return results.map(row => ({
        entityType,
        entityId: row.id,
        similarityScore: row.score,
        content: row.title || row.content?.substring(0, 100)
      }));

    } catch (error) {
      logger.error('Error in text search', error);
      return [];
    }
  }
}

export default VectorDatabase;
