// Semantic indexer para indexação automática de conteúdo
import { vectorSearchEngine } from './vector-search';
import { elasticsearchIntegration } from './elasticsearch-integration';
import db from '../db/connection';
import logger from '../monitoring/structured-logger';

interface IndexingJob {
  id: string;
  entity_type: string;
  entity_id: number;
  operation: 'index' | 'update' | 'delete';
  priority: number;
  created_at: Date;
  attempts: number;
  max_attempts: number;
  last_error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
  retryDelay: number;
  enableElasticsearch: boolean;
  enableVectorSearch: boolean;
  autoIndexing: boolean;
}

interface IndexingStats {
  total_processed: number;
  successful: number;
  failed: number;
  pending: number;
  processing_time_ms: number;
  last_run: Date;
}

export class SemanticIndexer {
  private queue: Map<string, IndexingJob> = new Map();
  private processing: Set<string> = new Set();
  private config: IndexingConfig;
  private isRunning: boolean = false;
  private stats: IndexingStats;

  constructor(config: Partial<IndexingConfig> = {}) {
    this.config = {
      batchSize: 10,
      maxConcurrency: 3,
      retryDelay: 5000,
      enableElasticsearch: true,
      enableVectorSearch: true,
      autoIndexing: true,
      ...config
    };

    this.stats = {
      total_processed: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      processing_time_ms: 0,
      last_run: new Date()
    };

    if (this.config.autoIndexing) {
      this.startAutoIndexing();
    }
  }

  /**
   * Adiciona job de indexação à fila
   */
  async queueIndexing(
    entityType: string,
    entityId: number,
    operation: 'index' | 'update' | 'delete' = 'index',
    priority: number = 0
  ): Promise<void> {
    const jobId = `${entityType}_${entityId}_${operation}`;

    const job: IndexingJob = {
      id: jobId,
      entity_type: entityType,
      entity_id: entityId,
      operation,
      priority,
      created_at: new Date(),
      attempts: 0,
      max_attempts: 3,
      status: 'pending'
    };

    this.queue.set(jobId, job);
    logger.info(`Job de indexação adicionado: ${jobId}`);

    // Se não estiver processando, inicia o processamento
    if (!this.isRunning) {
      this.processQueue();
    }
  }

  /**
   * Inicia processamento automático da fila
   */
  private startAutoIndexing(): void {
    // Processa a fila a cada 30 segundos
    setInterval(() => {
      if (!this.isRunning && this.queue.size > 0) {
        this.processQueue();
      }
    }, 30000);

    // Indexação em lote a cada 5 minutos
    setInterval(() => {
      this.indexPendingUpdates();
    }, 300000);
  }

  /**
   * Processa a fila de indexação
   */
  async processQueue(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info(`Iniciando processamento da fila: ${this.queue.size} jobs`);

    try {
      const startTime = Date.now();

      // Ordena jobs por prioridade (maior primeiro)
      const sortedJobs = Array.from(this.queue.values())
        .filter(job => job.status === 'pending')
        .sort((a, b) => b.priority - a.priority);

      // Processa em lotes
      for (let i = 0; i < sortedJobs.length; i += this.config.batchSize) {
        const batch = sortedJobs.slice(i, i + this.config.batchSize);
        await this.processBatch(batch);
      }

      const processingTime = Date.now() - startTime;
      this.stats.processing_time_ms = processingTime;
      this.stats.last_run = new Date();

      logger.info(`Processamento concluído em ${processingTime}ms`);
    } catch (error) {
      logger.error('Erro no processamento da fila', error);
    } finally {
      this.isRunning = false;
      this.updateStats();
    }
  }

  /**
   * Processa um lote de jobs
   */
  private async processBatch(jobs: IndexingJob[]): Promise<void> {
    const promises = jobs.map(job => this.processJob(job));
    await Promise.allSettled(promises);
  }

  /**
   * Processa um job individual
   */
  private async processJob(job: IndexingJob): Promise<void> {
    if (this.processing.has(job.id)) {
      return;
    }

    this.processing.add(job.id);
    job.status = 'processing';
    job.attempts++;

    try {
      logger.info(`Processando job: ${job.id} (tentativa ${job.attempts})`);

      switch (job.operation) {
        case 'index':
        case 'update':
          await this.indexEntity(job.entity_type, job.entity_id);
          break;
        case 'delete':
          await this.deleteEntity(job.entity_type, job.entity_id);
          break;
      }

      job.status = 'completed';
      this.queue.delete(job.id);
      this.stats.successful++;

      logger.info(`Job concluído: ${job.id}`);
    } catch (error) {
      logger.error(`Erro no job ${job.id}:`, error);

      job.last_error = error instanceof Error ? error.message : String(error);
      job.status = job.attempts >= job.max_attempts ? 'failed' : 'pending';

      if (job.status === 'failed') {
        this.stats.failed++;
        logger.error(`Job falhou permanentemente: ${job.id}`);
      } else {
        // Reagenda para nova tentativa
        setTimeout(() => {
          if (this.queue.has(job.id)) {
            job.status = 'pending';
          }
        }, this.config.retryDelay * job.attempts);
      }
    } finally {
      this.processing.delete(job.id);
      this.stats.total_processed++;
    }
  }

  /**
   * Indexa uma entidade
   */
  private async indexEntity(entityType: string, entityId: number): Promise<void> {
    const promises: Promise<void>[] = [];

    switch (entityType) {
      case 'kb_article':
        if (this.config.enableVectorSearch) {
          promises.push(vectorSearchEngine.indexKnowledgeArticle(entityId));
        }
        if (this.config.enableElasticsearch) {
          promises.push(elasticsearchIntegration.indexKnowledgeArticle(entityId));
        }
        break;

      case 'ticket':
        if (this.config.enableVectorSearch) {
          promises.push(vectorSearchEngine.indexTicket(entityId));
        }
        // Tickets não são indexados no Elasticsearch por padrão
        break;

      case 'comment':
        // Comentários podem ser indexados para busca contextual
        await this.indexComment(entityId);
        break;

      default:
        throw new Error(`Tipo de entidade não suportado: ${entityType}`);
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Remove entidade dos índices
   */
  private async deleteEntity(entityType: string, entityId: number): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.enableElasticsearch) {
      promises.push(
        elasticsearchIntegration.removeDocument(entityType, entityId)
      );
    }

    if (this.config.enableVectorSearch) {
      promises.push(this.removeVectorEmbedding(entityType, entityId));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Indexa comentário para busca contextual
   */
  private async indexComment(commentId: number): Promise<void> {
    try {
      const comment = db.prepare(`
        SELECT c.*, t.title as ticket_title, t.category_id,
               cat.name as category_name, u.name as author_name
        FROM comments c
        JOIN tickets t ON c.ticket_id = t.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ? AND c.is_internal = 0
      `).get(commentId) as any;

      if (!comment) {
        return; // Não indexa comentários internos
      }

      // Indexa apenas se for uma solução ou resposta relevante
      if (comment.content.length > 50 && this.isRelevantComment(comment.content)) {
        const indexText = [
          comment.ticket_title,
          comment.content,
          comment.category_name || ''
        ].join(' ');

        if (this.config.enableVectorSearch) {
          await vectorSearchEngine.saveEmbedding(
            'comment',
            commentId,
            indexText,
            {
              ticket_title: comment.ticket_title,
              category: comment.category_name,
              author: comment.author_name
            }
          );
        }
      }
    } catch (error) {
      logger.error('Erro ao indexar comentário', error);
      throw error;
    }
  }

  /**
   * Verifica se um comentário é relevante para indexação
   */
  private isRelevantComment(content: string): boolean {
    const solutionKeywords = [
      'solução', 'resolvido', 'funcionou', 'corrigir', 'fix',
      'resolver', 'solution', 'solved', 'worked', 'fixed'
    ];

    const lowerContent = content.toLowerCase();
    return solutionKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Remove embedding vetorial
   */
  private async removeVectorEmbedding(entityType: string, entityId: number): Promise<void> {
    try {
      db.prepare(`
        DELETE FROM vector_embeddings
        WHERE entity_type = ? AND entity_id = ?
      `).run(entityType, entityId);

      logger.info(`Embedding removido: ${entityType}:${entityId}`);
    } catch (error) {
      logger.error('Erro ao remover embedding', error);
      throw error;
    }
  }

  /**
   * Indexa atualizações pendentes detectadas automaticamente
   */
  async indexPendingUpdates(): Promise<void> {
    try {
      logger.info('Verificando atualizações pendentes...');

      // Artigos modificados recentemente
      const recentArticles = db.prepare(`
        SELECT id, updated_at
        FROM kb_articles
        WHERE status = 'published'
          AND updated_at > datetime('now', '-1 day')
          AND id NOT IN (
            SELECT entity_id FROM vector_embeddings
            WHERE entity_type = 'kb_article'
              AND updated_at > datetime('now', '-1 day')
          )
      `).all() as Array<{ id: number; updated_at: string }>;

      for (const article of recentArticles) {
        await this.queueIndexing('kb_article', article.id, 'update', 1);
      }

      // Tickets resolvidos recentemente
      const recentTickets = db.prepare(`
        SELECT id
        FROM tickets
        WHERE resolved_at IS NOT NULL
          AND resolved_at > datetime('now', '-1 day')
          AND id NOT IN (
            SELECT entity_id FROM vector_embeddings
            WHERE entity_type = 'ticket'
              AND updated_at > datetime('now', '-1 day')
          )
      `).all() as Array<{ id: number }>;

      for (const ticket of recentTickets) {
        await this.queueIndexing('ticket', ticket.id, 'index', 0);
      }

      logger.info(`Pendências encontradas: ${recentArticles.length} artigos, ${recentTickets.length} tickets`);
    } catch (error) {
      logger.error('Erro ao verificar atualizações pendentes', error);
    }
  }

  /**
   * Reindexação completa
   */
  async fullReindex(entityTypes?: string[]): Promise<void> {
    try {
      logger.info('Iniciando reindexação completa...');

      const types = entityTypes || ['kb_article', 'ticket'];

      for (const entityType of types) {
        logger.info(`Reindexando ${entityType}...`);

        switch (entityType) {
          case 'kb_article':
            const articles = db.prepare(`
              SELECT id FROM kb_articles WHERE status = 'published'
            `).all() as Array<{ id: number }>;
            for (const article of articles) {
              await this.queueIndexing('kb_article', article.id, 'index', 1);
            }
            break;

          case 'ticket':
            const tickets = db.prepare(`
              SELECT id FROM tickets WHERE resolved_at IS NOT NULL
            `).all() as Array<{ id: number }>;
            for (const ticket of tickets) {
              await this.queueIndexing('ticket', ticket.id, 'index', 0);
            }
            break;
        }
      }

      // Aguarda processamento completar
      while (this.queue.size > 0 || this.isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('Reindexação completa concluída');
    } catch (error) {
      logger.error('Erro na reindexação completa', error);
      throw error;
    }
  }

  /**
   * Limpa índices antigos ou inválidos
   */
  async cleanupIndexes(): Promise<void> {
    try {
      logger.info('Iniciando limpeza de índices...');

      // Limpa embeddings vetoriais
      if (this.config.enableVectorSearch) {
        await vectorSearchEngine.cleanupEmbeddings();
      }

      // Remove entidades deletadas do banco
      const deletedEntities = db.prepare(`
        SELECT DISTINCT ve.entity_type, ve.entity_id
        FROM vector_embeddings ve
        LEFT JOIN kb_articles ka ON ve.entity_type = 'kb_article' AND ve.entity_id = ka.id
        LEFT JOIN tickets t ON ve.entity_type = 'ticket' AND ve.entity_id = t.id
        LEFT JOIN comments c ON ve.entity_type = 'comment' AND ve.entity_id = c.id
        WHERE (ve.entity_type = 'kb_article' AND ka.id IS NULL)
           OR (ve.entity_type = 'ticket' AND t.id IS NULL)
           OR (ve.entity_type = 'comment' AND c.id IS NULL)
      `).all() as Array<{ entity_type: string; entity_id: number }>;

      for (const entity of deletedEntities) {
        await this.queueIndexing(
          entity.entity_type,
          entity.entity_id,
          'delete',
          2
        );
      }

      logger.info(`Limpeza programada: ${deletedEntities.length} entidades para remoção`);
    } catch (error) {
      logger.error('Erro na limpeza de índices', error);
      throw error;
    }
  }

  /**
   * Otimização de índices
   */
  async optimizeIndexes(): Promise<void> {
    try {
      logger.info('Otimizando índices...');

      // Estatísticas dos embeddings
      const embeddingStats = await vectorSearchEngine.getIndexStats();
      logger.info('Estatísticas de embeddings', embeddingStats);

      // Estatísticas do Elasticsearch
      if (this.config.enableElasticsearch) {
        const esStats = await elasticsearchIntegration.getIndexStats();
        logger.info('Estatísticas do Elasticsearch', esStats);
      }

      // Identifica documentos com baixa qualidade para reindexação
      const lowQualityDocs = db.prepare(`
        SELECT entity_type, entity_id, updated_at
        FROM vector_embeddings ve
        WHERE updated_at < datetime('now', '-30 days')
          AND entity_type = 'kb_article'
          AND entity_id IN (
            SELECT id FROM kb_articles
            WHERE helpful_votes < not_helpful_votes
              OR view_count = 0
          )
      `).all() as Array<{ entity_type: string; entity_id: number; updated_at: string }>;

      for (const doc of lowQualityDocs) {
        await this.queueIndexing(doc.entity_type, doc.entity_id, 'update', -1);
      }

      logger.info(`Otimização programada: ${lowQualityDocs.length} documentos para reindexação`);
    } catch (error) {
      logger.error('Erro na otimização de índices', error);
      throw error;
    }
  }

  /**
   * Atualiza estatísticas
   */
  private updateStats(): void {
    this.stats.pending = Array.from(this.queue.values())
      .filter(job => job.status === 'pending').length;
  }

  /**
   * Obtém estatísticas de indexação
   */
  getStats(): IndexingStats & {
    queue_size: number;
    processing_count: number;
    config: IndexingConfig;
  } {
    this.updateStats();

    return {
      ...this.stats,
      queue_size: this.queue.size,
      processing_count: this.processing.size,
      config: this.config
    };
  }

  /**
   * Configura parâmetros do indexador
   */
  updateConfig(newConfig: Partial<IndexingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Configuração do indexador atualizada', this.config);
  }

  /**
   * Para o processamento automático
   */
  stop(): void {
    this.config.autoIndexing = false;
    this.isRunning = false;
    logger.info('Indexador parado');
  }

  /**
   * Reinicia o processamento automático
   */
  start(): void {
    this.config.autoIndexing = true;
    if (!this.isRunning) {
      this.startAutoIndexing();
    }
    logger.info('Indexador iniciado');
  }

  /**
   * Limpa a fila de jobs
   */
  clearQueue(): void {
    this.queue.clear();
    this.processing.clear();
    logger.info('Fila de indexação limpa');
  }

  /**
   * Força processamento imediato da fila
   */
  async forceProcess(): Promise<void> {
    if (this.isRunning) {
      logger.info('Processamento já em andamento');
      return;
    }

    await this.processQueue();
  }
}

// Instância singleton
export const semanticIndexer = new SemanticIndexer();