// Vector embeddings para similarity search
import openAIClient from '../ai/openai-client';
import db from '../db/connection';
import type { VectorEmbedding } from '../types/database';
import logger from '../monitoring/structured-logger';

interface VectorSearchConfig {
  model: string;
  dimension: number;
  similarityThreshold: number;
  maxResults: number;
}


interface SimilarityMatch {
  entity_type: string;
  entity_id: number;
  similarity: number;
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
}

export class VectorSearchEngine {
  private config: VectorSearchConfig;

  constructor(config: Partial<VectorSearchConfig> = {}) {
    this.config = {
      model: 'text-embedding-3-small',
      dimension: 1536,
      similarityThreshold: 0.7,
      maxResults: 10,
      ...config
    };
  }

  /**
   * Gera embedding para um texto
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openAIClient.createEmbedding(
        text.replace(/\n/g, ' ').trim(),
        this.config.model
      );

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('Embedding não retornado pela API');
      }

      return embedding;
    } catch (error) {
      logger.error('Erro ao gerar embedding', error);
      throw new Error('Falha ao gerar embedding vetorial');
    }
  }

  /**
   * Salva embedding no banco de dados
   */
  async saveEmbedding(
    entityType: string,
    entityId: number,
    text: string,
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(text);

      // Remove embedding existente se houver
      db.prepare(`
        DELETE FROM vector_embeddings
        WHERE entity_type = ? AND entity_id = ? AND model_name = ?
      `).run(entityType, entityId, this.config.model);

      // Insere novo embedding
      db.prepare(`
        INSERT INTO vector_embeddings (
          entity_type, entity_id, embedding_vector, model_name,
          model_version, vector_dimension
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        entityType,
        entityId,
        JSON.stringify(embedding),
        this.config.model,
        '1.0',
        this.config.dimension
      );

      logger.info(`Embedding salvo para ${entityType}:${entityId}`);
    } catch (error) {
      logger.error('Erro ao salvar embedding', error);
      throw error;
    }
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vetores devem ter o mesmo tamanho');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) * (a[i] ?? 0);
      normB += (b[i] ?? 0) * (b[i] ?? 0);
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Busca por similaridade semântica
   */
  async semanticSearch(
    query: string,
    entityTypes?: string[],
    options?: {
      threshold?: number;
      maxResults?: number;
      includeContent?: boolean;
    }
  ): Promise<SimilarityMatch[]> {
    try {
      // Gera embedding para a query
      const queryEmbedding = await this.generateEmbedding(query);

      // Busca todos os embeddings do banco
      let sql = `
        SELECT ve.*,
               CASE
                 WHEN ve.entity_type = 'kb_article' THEN
                   (SELECT json_object(
                     'title', title,
                     'content', content,
                     'summary', summary,
                     'category', (SELECT name FROM kb_categories WHERE id = category_id)
                   ) FROM kb_articles WHERE id = ve.entity_id)
                 WHEN ve.entity_type = 'ticket' THEN
                   (SELECT json_object(
                     'title', title,
                     'description', description,
                     'category', (SELECT name FROM categories WHERE id = category_id)
                   ) FROM tickets WHERE id = ve.entity_id)
                 WHEN ve.entity_type = 'comment' THEN
                   (SELECT json_object(
                     'content', content,
                     'ticket_title', (SELECT title FROM tickets WHERE id = ticket_id)
                   ) FROM comments WHERE id = ve.entity_id)
               END as content_data
        FROM vector_embeddings ve
        WHERE model_name = ?
      `;

      const params: (string | number)[] = [this.config.model];

      if (entityTypes && entityTypes.length > 0) {
        sql += ` AND entity_type IN (${entityTypes.map(() => '?').join(',')})`;
        params.push(...entityTypes);
      }

      const embeddings = db.prepare(sql).all(...params) as Array<VectorEmbedding & { content_data?: string }>;

      // Calcula similaridade para cada embedding
      const similarities: SimilarityMatch[] = [];

      for (const embedding of embeddings) {
        try {
          const embeddingVector = JSON.parse(embedding.embedding_vector) as number[];
          const similarity = this.cosineSimilarity(queryEmbedding, embeddingVector);

          const threshold = options?.threshold ?? this.config.similarityThreshold;
          if (similarity >= threshold) {
            const contentData = embedding.content_data ? JSON.parse(embedding.content_data) as Record<string, unknown> : {};

            similarities.push({
              entity_type: embedding.entity_type,
              entity_id: embedding.entity_id,
              similarity,
              content: this.extractContent(contentData, embedding.entity_type),
              title: typeof contentData.title === 'string' ? contentData.title : undefined,
              category: typeof contentData.category === 'string' ? contentData.category : undefined,
              tags: typeof contentData.tags === 'string' ? JSON.parse(contentData.tags) as string[] : []
            });
          }
        } catch (error) {
          logger.error(`Erro ao processar embedding ${embedding.id}:`, error);
          continue;
        }
      }

      // Ordena por similaridade e limita resultados
      const maxResults = options?.maxResults ?? this.config.maxResults;
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);

    } catch (error) {
      logger.error('Erro na busca semântica', error);
      throw error;
    }
  }

  /**
   * Extrai conteúdo relevante baseado no tipo de entidade
   */
  private extractContent(contentData: Record<string, unknown>, entityType: string): string {
    switch (entityType) {
      case 'kb_article':
        return (typeof contentData.summary === 'string' ? contentData.summary : '') ||
               (typeof contentData.content === 'string' ? contentData.content.substring(0, 500) : '') || '';
      case 'ticket':
        return (typeof contentData.description === 'string' ? contentData.description.substring(0, 300) : '') || '';
      case 'comment':
        return (typeof contentData.content === 'string' ? contentData.content.substring(0, 200) : '') || '';
      default:
        return '';
    }
  }

  /**
   * Indexa conteúdo de um artigo da KB
   */
  async indexKnowledgeArticle(articleId: number): Promise<void> {
    try {
      const article = db.prepare(`
        SELECT ka.*, kc.name as category_name
        FROM kb_articles ka
        LEFT JOIN kb_categories kc ON ka.category_id = kc.id
        WHERE ka.id = ?
      `).get(articleId) as {
        id: number;
        title: string;
        summary?: string;
        content: string;
        search_keywords?: string;
        category_name?: string;
        tags?: string;
      } | undefined;

      if (!article) {
        throw new Error(`Artigo ${articleId} não encontrado`);
      }

      // Combina título, conteúdo e metadados para indexação
      const indexText = [
        article.title,
        article.summary || '',
        article.content,
        article.search_keywords || '',
        article.category_name || ''
      ].join(' ');

      await this.saveEmbedding('kb_article', articleId, indexText, {
        title: article.title,
        category: article.category_name,
        tags: article.tags ? JSON.parse(article.tags) : []
      });

    } catch (error) {
      logger.error('Erro ao indexar artigo', error);
      throw error;
    }
  }

  /**
   * Indexa ticket resolvido
   */
  async indexTicket(ticketId: number): Promise<void> {
    try {
      const ticket = db.prepare(`
        SELECT t.*, c.name as category_name, p.name as priority_name,
               GROUP_CONCAT(com.content, ' ') as comments_content
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN comments com ON t.id = com.ticket_id
        WHERE t.id = ? AND t.resolved_at IS NOT NULL
        GROUP BY t.id
      `).get(ticketId) as {
        id: number;
        title: string;
        description: string;
        category_name?: string;
        priority_name?: string;
        comments_content?: string;
      } | undefined;

      if (!ticket) {
        return; // Só indexa tickets resolvidos
      }

      // Combina informações do ticket para indexação
      const indexText = [
        ticket.title,
        ticket.description,
        ticket.category_name || '',
        ticket.comments_content || ''
      ].join(' ');

      await this.saveEmbedding('ticket', ticketId, indexText, {
        title: ticket.title,
        category: ticket.category_name,
        priority: ticket.priority_name
      });

    } catch (error) {
      logger.error('Erro ao indexar ticket', error);
      throw error;
    }
  }

  /**
   * Busca artigos relacionados baseado em similaridade
   */
  async findRelatedArticles(
    articleId: number,
    maxResults: number = 5
  ): Promise<SimilarityMatch[]> {
    try {
      // Busca o embedding do artigo atual
      const currentEmbedding = db.prepare(`
        SELECT embedding_vector FROM vector_embeddings
        WHERE entity_type = 'kb_article' AND entity_id = ? AND model_name = ?
      `).get(articleId, this.config.model) as { embedding_vector: string } | undefined;

      if (!currentEmbedding) {
        return [];
      }

      const currentVector = JSON.parse(currentEmbedding.embedding_vector) as number[];

      // Busca outros embeddings de artigos
      const otherEmbeddings = db.prepare(`
        SELECT ve.*, ka.title, ka.summary, kc.name as category_name
        FROM vector_embeddings ve
        JOIN kb_articles ka ON ve.entity_id = ka.id
        LEFT JOIN kb_categories kc ON ka.category_id = kc.id
        WHERE ve.entity_type = 'kb_article'
          AND ve.entity_id != ?
          AND ve.model_name = ?
          AND ka.is_published = 1
      `).all(articleId, this.config.model) as Array<VectorEmbedding & {
        title: string;
        summary?: string;
        category_name?: string;
      }>;

      // Calcula similaridade
      const similarities: SimilarityMatch[] = [];

      for (const embedding of otherEmbeddings) {
        try {
          const embeddingVector = JSON.parse(embedding.embedding_vector) as number[];
          const similarity = this.cosineSimilarity(currentVector, embeddingVector);

          if (similarity >= 0.6) { // Threshold menor para artigos relacionados
            similarities.push({
              entity_type: 'kb_article',
              entity_id: embedding.entity_id,
              similarity,
              content: embedding.summary || '',
              title: embedding.title,
              category: embedding.category_name
            });
          }
        } catch (error) {
          logger.error(`Erro ao processar embedding ${embedding.id}:`, error);
          continue;
        }
      }

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);

    } catch (error) {
      logger.error('Erro ao buscar artigos relacionados', error);
      return [];
    }
  }

  /**
   * Reindexação em massa de todos os artigos
   */
  async reindexAllArticles(): Promise<void> {
    try {
      logger.info('Iniciando reindexação de artigos...');

      const articles = db.prepare(`
        SELECT id FROM kb_articles WHERE status = 'published'
      `).all() as Array<{ id: number }>;

      for (const article of articles) {
        await this.indexKnowledgeArticle(article.id);
        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Reindexação completa: ${articles.length} artigos processados`);
    } catch (error) {
      logger.error('Erro na reindexação', error);
      throw error;
    }
  }

  /**
   * Limpa embeddings antigos ou inválidos
   */
  async cleanupEmbeddings(): Promise<void> {
    try {
      // Remove embeddings de artigos deletados
      db.prepare(`
        DELETE FROM vector_embeddings
        WHERE entity_type = 'kb_article'
          AND entity_id NOT IN (SELECT id FROM kb_articles)
      `).run();

      // Remove embeddings de tickets deletados
      db.prepare(`
        DELETE FROM vector_embeddings
        WHERE entity_type = 'ticket'
          AND entity_id NOT IN (SELECT id FROM tickets)
      `).run();

      logger.info('Limpeza de embeddings concluída');
    } catch (error) {
      logger.error('Erro na limpeza de embeddings', error);
      throw error;
    }
  }

  /**
   * Estatísticas do índice vetorial
   */
  async getIndexStats(): Promise<{
    total_embeddings: number;
    by_entity_type: Record<string, number>;
    model_name: string;
    avg_vector_dimension: number;
  }> {
    try {
      const stats = db.prepare(`
        SELECT
          entity_type,
          COUNT(*) as count,
          AVG(vector_dimension) as avg_dimension
        FROM vector_embeddings
        WHERE model_name = ?
        GROUP BY entity_type
      `).all(this.config.model) as Array<{
        entity_type: string;
        count: number;
        avg_dimension: number | null;
      }>;

      const total = db.prepare(`
        SELECT COUNT(*) as total FROM vector_embeddings WHERE model_name = ?
      `).get(this.config.model) as { total: number } | undefined;

      const byEntityType: Record<string, number> = {};
      let avgDimension = 0;

      for (const stat of stats) {
        byEntityType[stat.entity_type] = stat.count;
        avgDimension = stat.avg_dimension || 0;
      }

      return {
        total_embeddings: total?.total || 0,
        by_entity_type: byEntityType,
        model_name: this.config.model,
        avg_vector_dimension: avgDimension
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas', error);
      throw error;
    }
  }
}

// Instância singleton
export const vectorSearchEngine = new VectorSearchEngine();