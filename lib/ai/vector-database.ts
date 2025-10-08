import { openAIClient } from './openai-client';
import { VectorEmbedding } from '../types/database';
import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
import { logger } from '../monitoring/logger';

export interface SearchResult {
  entityType: string;
  entityId: number;
  similarityScore: number;
  content?: string;
  metadata?: any;
}

export interface EmbeddingGenerationResult {
  embeddingId: number;
  vectorDimension: number;
  processingTimeMs: number;
  modelName: string;
  modelVersion: string;
}

export interface SimilaritySearchOptions {
  threshold?: number;
  maxResults?: number;
  entityTypes?: string[];
  excludeEntityIds?: number[];
}

export class VectorDatabase {
  private static readonly DEFAULT_MODEL = 'text-embedding-3-small';
  private static readonly DEFAULT_DIMENSION = 1536;
  private static readonly SIMILARITY_THRESHOLD = 0.75;

  private db: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = database;
  }

  /**
   * Gera embedding para um texto e armazena no banco
   */
  async generateAndStoreEmbedding(
    entityType: string,
    entityId: number,
    content: string,
    modelName: string = VectorDatabase.DEFAULT_MODEL
  ): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();

    try {
      // Gerar embedding usando OpenAI
      const embeddingResponse = await openAIClient.createEmbedding(content, modelName);
      const embedding = embeddingResponse.data[0].embedding;

      // Converter para JSON string para armazenar no SQLite
      const embeddingVector = JSON.stringify(embedding);

      // Verificar se já existe embedding para esta entidade
      const existingEmbedding = await this.db.get(`
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

        embeddingId = result.lastID!;
      }

      return {
        embeddingId,
        vectorDimension: embedding.length,
        processingTimeMs: Date.now() - startTime,
        modelName,
        modelVersion: '1.0'
      };

    } catch (error) {
      logger.error('Error generating embedding', error);
      throw new Error('Failed to generate and store embedding');
    }
  }

  /**
   * Busca similaridade usando cosine similarity (implementação simples em SQLite)
   */
  async searchSimilar(
    queryText: string,
    options: SimilaritySearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      threshold = VectorDatabase.SIMILARITY_THRESHOLD,
      maxResults = 10,
      entityTypes,
      excludeEntityIds = []
    } = options;

    try {
      // Gerar embedding para a consulta
      const queryEmbedding = await openAIClient.createEmbedding(queryText);
      const queryVector = queryEmbedding.data[0].embedding;

      // Buscar embeddings existentes
      let whereClause = '';
      const params: any[] = [];

      if (entityTypes && entityTypes.length > 0) {
        whereClause += ` AND entity_type IN (${entityTypes.map(() => '?').join(',')})`;
        params.push(...entityTypes);
      }

      if (excludeEntityIds.length > 0) {
        whereClause += ` AND entity_id NOT IN (${excludeEntityIds.map(() => '?').join(',')})`;
        params.push(...excludeEntityIds);
      }

      const embeddings = await this.db.all(`
        SELECT entity_type, entity_id, embedding_vector
        FROM vector_embeddings
        WHERE model_name = ?${whereClause}
      `, [VectorDatabase.DEFAULT_MODEL, ...params]);

      // Calcular similaridade cosine
      const results: SearchResult[] = [];

      for (const embedding of embeddings) {
        try {
          const storedVector = JSON.parse(embedding.embedding_vector);
          const similarity = this.cosineSimilarity(queryVector, storedVector);

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
      return results
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, maxResults);

    } catch (error) {
      logger.error('Error searching similar embeddings', error);
      return [];
    }
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
        const article = await this.db.get(`
          SELECT title, summary, content
          FROM kb_articles
          WHERE id = ? AND is_published = 1
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
        const ticket = await this.db.get(`
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
      let entities: any[] = [];

      switch (entityType) {
        case 'ticket':
          entities = await this.db.all(`
            SELECT id, title || ' ' || description as content
            FROM tickets
          `);
          break;

        case 'kb_article':
          entities = await this.db.all(`
            SELECT id, title || ' ' || COALESCE(summary, '') || ' ' || content as content
            FROM kb_articles
            WHERE is_published = 1
          `);
          break;

        case 'comment':
          entities = await this.db.all(`
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
   * Calcula similaridade cosine entre dois vetores
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
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
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total FROM vector_embeddings
      `);

      const byTypeResults = await this.db.all(`
        SELECT entity_type, COUNT(*) as count
        FROM vector_embeddings
        GROUP BY entity_type
      `);

      const avgDimensionResult = await this.db.get(`
        SELECT AVG(vector_dimension) as avg_dimension
        FROM vector_embeddings
      `);

      const dateRangeResult = await this.db.get(`
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
        totalEmbeddings: totalResult.total,
        embeddingsByType,
        averageVectorDimension: Math.round(avgDimensionResult.avg_dimension || 0),
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
      let params: any[] = [];

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
            WHERE is_published = 1
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

      const results = await this.db.all(searchQuery, params);

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