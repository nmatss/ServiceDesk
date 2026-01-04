// Elasticsearch integration com AI rankings
// Note: @elastic/elasticsearch is an optional dependency - this module gracefully degrades
// when elasticsearch is not configured
import { vectorSearchEngine } from './vector-search';

// Define Client type locally to avoid import issues when elasticsearch is not installed
interface ElasticsearchClient {
  search: (params: unknown) => Promise<unknown>;
  index: (params: unknown) => Promise<unknown>;
  bulk: (params: unknown) => Promise<unknown>;
  delete: (params: unknown) => Promise<unknown>;
  indices: {
    create: (params: unknown) => Promise<unknown>;
    exists: (params: unknown) => Promise<{ body: boolean }>;
    putMapping: (params: unknown) => Promise<unknown>;
    delete: (params: unknown) => Promise<unknown>;
  };
}
import db from '../db/connection';
import logger from '../monitoring/structured-logger';

interface ElasticsearchConfig {
  node: string;
  apiKey?: string;
  username?: string;
  password?: string;
  index: string;
  maxResults: number;
}

interface SearchDocument {
  id: string;
  entity_type: string;
  entity_id: number;
  title: string;
  content: string;
  summary?: string;
  category?: string;
  tags?: string[];
  author?: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  status: string;
  visibility: string;
  search_keywords?: string;
  boost_score?: number;
}

interface SearchOptions {
  query: string;
  filters?: {
    category?: string;
    tags?: string[];
    entity_type?: string;
    author?: string;
    date_range?: {
      start: string;
      end: string;
    };
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  highlight?: boolean;
  fuzzy?: boolean;
  semantic?: boolean;
  offset?: number;
  limit?: number;
}

interface SearchResult {
  document: SearchDocument;
  score: number;
  highlights?: Record<string, string[]>;
  semantic_score?: number;
  combined_score?: number;
  explanation?: string;
}

interface HybridSearchResult {
  results: SearchResult[];
  total: number;
  took: number;
  semantic_enabled: boolean;
  aggregations?: Record<string, any>;
}

export class ElasticsearchIntegration {
  private client: ElasticsearchClient | null = null;
  private config: ElasticsearchConfig;
  private indexName: string;

  constructor(config: ElasticsearchConfig) {
    this.config = {
      ...config,
      maxResults: 20
    };

    this.indexName = config.index;

    // Note: Elasticsearch client initialization is deferred to initClient()
    // This avoids build-time issues with optional dependencies
  }

  /**
   * Initialize Elasticsearch client lazily
   * This method should be called before using the client
   */
  private async initClient(): Promise<void> {
    if (this.client) return;

    try {
      // Dynamic import to avoid build-time resolution issues
      // Using eval to prevent webpack from trying to bundle at build time
      const importElasticsearch = new Function('return import("@elastic/elasticsearch")');
      const esModule = await importElasticsearch().catch(() => null);

      if (!esModule) {
        logger.warn('Elasticsearch module not available. Install @elastic/elasticsearch to use this feature.');
        return;
      }

      const { Client: ESClient } = esModule;

      const clientConfig: any = {
        node: this.config.node,
      };

      if (this.config.apiKey) {
        clientConfig.auth = { apiKey: this.config.apiKey };
      } else if (this.config.username && this.config.password) {
        clientConfig.auth = {
          username: this.config.username,
          password: this.config.password
        };
      }

      this.client = new ESClient(clientConfig);
    } catch (error) {
      logger.warn('Elasticsearch client not available. Install @elastic/elasticsearch to use this feature.');
    }
  }

  /**
   * Cria o índice com mapping otimizado
   */
  async createIndex(): Promise<void> {
    await this.initClient();
    if (!this.client) {
      logger.warn('Elasticsearch not available - skipping index creation');
      return;
    }

    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (indexExists) {
        logger.info(`Índice ${this.indexName} já existe`);
        return;
      }

      await this.client.indices.create({
        index: this.indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                brazilian_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'brazilian_stop',
                    'brazilian_stemmer'
                  ]
                },
                search_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'synonym_filter'
                  ]
                }
              },
              filter: {
                brazilian_stop: {
                  type: 'stop',
                  stopwords: '_brazilian_'
                },
                brazilian_stemmer: {
                  type: 'stemmer',
                  language: 'brazilian'
                },
                synonym_filter: {
                  type: 'synonym',
                  synonyms: [
                    'problema,issue,bug',
                    'erro,error,falha',
                    'senha,password,login',
                    'usuario,user,cliente',
                    'sistema,system,aplicação,app'
                  ]
                }
              }
            }
          },
          mappings: {
            properties: {
              entity_type: { type: 'keyword' },
              entity_id: { type: 'integer' },
              title: {
                type: 'text',
                analyzer: 'brazilian_analyzer',
                search_analyzer: 'search_analyzer',
                fields: {
                  exact: { type: 'keyword' },
                  suggest: {
                    type: 'completion',
                    analyzer: 'brazilian_analyzer'
                  }
                }
              },
              content: {
                type: 'text',
                analyzer: 'brazilian_analyzer',
                search_analyzer: 'search_analyzer'
              },
              summary: {
                type: 'text',
                analyzer: 'brazilian_analyzer'
              },
              category: {
                type: 'keyword',
                fields: {
                  text: {
                    type: 'text',
                    analyzer: 'brazilian_analyzer'
                  }
                }
              },
              tags: { type: 'keyword' },
              author: { type: 'keyword' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' },
              view_count: { type: 'integer' },
              helpful_count: { type: 'integer' },
              not_helpful_count: { type: 'integer' },
              status: { type: 'keyword' },
              visibility: { type: 'keyword' },
              search_keywords: {
                type: 'text',
                analyzer: 'brazilian_analyzer'
              },
              boost_score: { type: 'float' },
              // Campos calculados para ranking
              popularity_score: { type: 'float' },
              quality_score: { type: 'float' },
              recency_score: { type: 'float' }
            }
          }
        }
      });

      logger.info(`Índice ${this.indexName} criado com sucesso`);
    } catch (error) {
      logger.error('Erro ao criar índice', error);
      throw error;
    }
  }

  /**
   * Indexa um documento
   */
  async indexDocument(document: SearchDocument): Promise<void> {
    await this.initClient();
    if (!this.client) {
      logger.warn('Elasticsearch not available - skipping document indexing');
      return;
    }

    try {
      // Calcula scores de qualidade e popularidade
      const enhancedDocument = {
        ...document,
        popularity_score: this.calculatePopularityScore(document),
        quality_score: this.calculateQualityScore(document),
        recency_score: this.calculateRecencyScore(document.updated_at)
      };

      await this.client.index({
        index: this.indexName,
        id: `${document.entity_type}_${document.entity_id}`,
        body: enhancedDocument
      });

      logger.info(`Documento ${document.entity_type}:${document.entity_id} indexado`);
    } catch (error) {
      logger.error('Erro ao indexar documento', error);
      throw error;
    }
  }

  /**
   * Busca híbrida combinando Elasticsearch e busca semântica
   */
  async hybridSearch(options: SearchOptions): Promise<HybridSearchResult> {
    try {
      const startTime = Date.now();

      // Busca no Elasticsearch
      const elasticResults = await this.elasticsearchSearch(options);

      // Busca semântica (se habilitada)
      let semanticResults: any[] = [];
      if (options.semantic && options.query.trim()) {
        try {
          const entityTypes = options.filters?.entity_type
            ? [options.filters.entity_type]
            : ['kb_article', 'ticket'];

          semanticResults = await vectorSearchEngine.semanticSearch(
            options.query,
            entityTypes,
            {
              threshold: 0.7,
              maxResults: Math.floor(this.config.maxResults / 2)
            }
          );
        } catch (error) {
          logger.warn('Busca semântica falhou, usando apenas Elasticsearch', error);
        }
      }

      // Combina e reordena resultados
      const combinedResults = this.combineResults(
        elasticResults.results,
        semanticResults,
        options
      );

      const took = Date.now() - startTime;

      return {
        results: combinedResults,
        total: elasticResults.total,
        took,
        semantic_enabled: options.semantic || false,
        aggregations: elasticResults.aggregations
      };

    } catch (error) {
      logger.error('Erro na busca híbrida', error);
      throw error;
    }
  }

  /**
   * Busca apenas no Elasticsearch
   */
  private async elasticsearchSearch(options: SearchOptions): Promise<{
    results: SearchResult[];
    total: number;
    aggregations?: Record<string, any>;
  }> {
    await this.initClient();
    if (!this.client) {
      return { results: [], total: 0 };
    }

    const query = this.buildElasticsearchQuery(options);

    const searchParams: any = {
      index: this.indexName,
      body: {
        query,
        sort: this.buildSort(options),
        from: options.offset || 0,
        size: options.limit || this.config.maxResults,
        highlight: options.highlight ? {
          fields: {
            title: {},
            content: {},
            summary: {}
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>']
        } : undefined,
        aggs: {
          categories: {
            terms: { field: 'category', size: 10 }
          },
          entity_types: {
            terms: { field: 'entity_type', size: 5 }
          },
          tags: {
            terms: { field: 'tags', size: 20 }
          }
        }
      }
    };

    const response = await this.client.search(searchParams) as any;

    const results: SearchResult[] = response.body.hits.hits.map((hit: any) => ({
      document: hit._source,
      score: hit._score,
      highlights: hit.highlight,
      explanation: options.query ? `Matched: ${hit._score.toFixed(2)}` : undefined
    }));

    return {
      results,
      total: response.body.hits.total.value,
      aggregations: response.body.aggregations
    };
  }

  /**
   * Constrói query do Elasticsearch
   */
  private buildElasticsearchQuery(options: SearchOptions): any {
    const { query, filters, fuzzy } = options;

    if (!query || !query.trim()) {
      // Query vazia - retorna tudo com filtros
      return {
        bool: {
          must: [{ match_all: {} }],
          filter: this.buildFilters(filters)
        }
      };
    }

    const should = [];

    // Busca por título (peso maior)
    should.push({
      match: {
        title: {
          query,
          boost: 3.0,
          fuzziness: fuzzy ? 'AUTO' : 0
        }
      }
    });

    // Busca exata no título (peso muito maior)
    should.push({
      match_phrase: {
        title: {
          query,
          boost: 5.0
        }
      }
    });

    // Busca no conteúdo
    should.push({
      match: {
        content: {
          query,
          boost: 1.0,
          fuzziness: fuzzy ? 'AUTO' : 0
        }
      }
    });

    // Busca no resumo
    should.push({
      match: {
        summary: {
          query,
          boost: 2.0,
          fuzziness: fuzzy ? 'AUTO' : 0
        }
      }
    });

    // Busca em palavras-chave
    should.push({
      match: {
        search_keywords: {
          query,
          boost: 2.5
        }
      }
    });

    // Busca em tags
    should.push({
      terms: {
        tags: query.toLowerCase().split(' '),
        boost: 1.5
      }
    });

    return {
      bool: {
        should,
        minimum_should_match: 1,
        filter: this.buildFilters(filters)
      }
    };
  }

  /**
   * Constrói filtros para a query
   */
  private buildFilters(filters?: SearchOptions['filters']): any[] {
    const filterClauses = [];

    if (filters) {
      if (filters.category) {
        filterClauses.push({ term: { category: filters.category } });
      }

      if (filters.entity_type) {
        filterClauses.push({ term: { entity_type: filters.entity_type } });
      }

      if (filters.author) {
        filterClauses.push({ term: { author: filters.author } });
      }

      if (filters.tags && filters.tags.length > 0) {
        filterClauses.push({ terms: { tags: filters.tags } });
      }

      if (filters.date_range) {
        filterClauses.push({
          range: {
            updated_at: {
              gte: filters.date_range.start,
              lte: filters.date_range.end
            }
          }
        });
      }
    }

    // Filtros padrão
    filterClauses.push({ term: { status: 'published' } });
    filterClauses.push({ term: { visibility: 'public' } });

    return filterClauses;
  }

  /**
   * Constrói ordenação
   */
  private buildSort(options: SearchOptions): any[] {
    if (options.sort) {
      return [{ [options.sort.field]: { order: options.sort.order } }];
    }

    // Ordenação padrão com função de score personalizada
    return [
      {
        _script: {
          type: 'number',
          script: {
            source: `
              double score = _score;
              double popularity = doc['popularity_score'].value;
              double quality = doc['quality_score'].value;
              double recency = doc['recency_score'].value;
              double boost = doc.containsKey('boost_score') ? doc['boost_score'].value : 1.0;

              return (score * 0.4 + popularity * 0.3 + quality * 0.2 + recency * 0.1) * boost;
            `
          },
          order: 'desc'
        }
      }
    ];
  }

  /**
   * Combina resultados do Elasticsearch com busca semântica
   */
  private combineResults(
    elasticResults: SearchResult[],
    semanticResults: any[],
    options: SearchOptions
  ): SearchResult[] {
    // Cria mapa de documentos já encontrados
    const elasticMap = new Map<string, SearchResult>();
    elasticResults.forEach(result => {
      const key = `${result.document.entity_type}_${result.document.entity_id}`;
      elasticMap.set(key, result);
    });

    // Adiciona resultados semânticos únicos
    const combinedResults = [...elasticResults];

    for (const semantic of semanticResults) {
      const key = `${semantic.entity_type}_${semantic.entity_id}`;

      if (elasticMap.has(key)) {
        // Combina scores se já existe
        const existing = elasticMap.get(key)!;
        existing.semantic_score = semantic.similarity;
        existing.combined_score = (existing.score * 0.6) + (semantic.similarity * 100 * 0.4);
        existing.explanation = `Hybrid: ES=${existing.score.toFixed(2)}, Semantic=${semantic.similarity.toFixed(3)}`;
      } else {
        // Adiciona como novo resultado semântico
        const document = this.createDocumentFromSemantic(semantic);
        if (document) {
          combinedResults.push({
            document,
            score: semantic.similarity * 100,
            semantic_score: semantic.similarity,
            combined_score: semantic.similarity * 100,
            explanation: `Semantic only: ${semantic.similarity.toFixed(3)}`
          });
        }
      }
    }

    // Reordena por combined_score ou score
    return combinedResults
      .sort((a, b) => (b.combined_score || b.score) - (a.combined_score || a.score))
      .slice(0, options.limit || this.config.maxResults);
  }

  /**
   * Cria documento a partir de resultado semântico
   */
  private createDocumentFromSemantic(semantic: any): SearchDocument | null {
    // Implementação simplificada - idealmente buscaria dados completos do banco
    return {
      id: `${semantic.entity_type}_${semantic.entity_id}`,
      entity_type: semantic.entity_type,
      entity_id: semantic.entity_id,
      title: semantic.title || 'Título não disponível',
      content: semantic.content || '',
      summary: semantic.content?.substring(0, 200),
      category: semantic.category,
      tags: semantic.tags || [],
      author: 'Sistema',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      view_count: 0,
      helpful_count: 0,
      not_helpful_count: 0,
      status: 'published',
      visibility: 'public'
    };
  }

  /**
   * Calcula score de popularidade
   */
  private calculatePopularityScore(document: SearchDocument): number {
    const views = document.view_count || 0;
    const helpful = document.helpful_count || 0;
    const notHelpful = document.not_helpful_count || 0;

    const totalVotes = helpful + notHelpful;
    const helpfulRatio = totalVotes > 0 ? helpful / totalVotes : 0.5;

    // Normaliza views e combina com ratio de utilidade
    const viewScore = Math.log(views + 1) / 10;
    const helpfulScore = helpfulRatio * 2;

    return Math.min(viewScore + helpfulScore, 10);
  }

  /**
   * Calcula score de qualidade
   */
  private calculateQualityScore(document: SearchDocument): number {
    let score = 5; // Base score

    // Penaliza conteúdo muito curto
    const contentLength = (document.content || '').length;
    if (contentLength < 100) score -= 2;
    else if (contentLength < 500) score -= 1;

    // Bonifica se tem resumo
    if (document.summary && document.summary.length > 50) score += 1;

    // Bonifica se tem tags
    if (document.tags && document.tags.length > 0) score += 1;

    // Bonifica se tem palavras-chave
    if (document.search_keywords) score += 1;

    return Math.max(0, Math.min(score, 10));
  }

  /**
   * Calcula score de recência
   */
  private calculateRecencyScore(updatedAt: string): number {
    const now = new Date();
    const updated = new Date(updatedAt);
    const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);

    // Score decresce com o tempo
    if (daysSinceUpdate < 7) return 10;
    if (daysSinceUpdate < 30) return 8;
    if (daysSinceUpdate < 90) return 6;
    if (daysSinceUpdate < 180) return 4;
    if (daysSinceUpdate < 365) return 2;
    return 1;
  }

  /**
   * Indexa artigo da KB
   */
  async indexKnowledgeArticle(articleId: number): Promise<void> {
    try {
      const article = db.prepare(`
        SELECT ka.*, kc.name as category_name, u.name as author_name,
               ka.view_count, ka.helpful_votes as helpful_count,
               ka.not_helpful_votes as not_helpful_count
        FROM kb_articles ka
        LEFT JOIN kb_categories kc ON ka.category_id = kc.id
        LEFT JOIN users u ON ka.author_id = u.id
        WHERE ka.id = ?
      `).get(articleId) as any;

      if (!article) {
        throw new Error(`Artigo ${articleId} não encontrado`);
      }

      const document: SearchDocument = {
        id: `kb_article_${article.id}`,
        entity_type: 'kb_article',
        entity_id: article.id,
        title: article.title,
        content: article.content,
        summary: article.summary,
        category: article.category_name,
        tags: article.tags ? JSON.parse(article.tags) : [],
        author: article.author_name,
        created_at: article.created_at,
        updated_at: article.updated_at,
        view_count: article.view_count || 0,
        helpful_count: article.helpful_count || 0,
        not_helpful_count: article.not_helpful_count || 0,
        status: article.status,
        visibility: article.visibility,
        search_keywords: article.search_keywords
      };

      await this.indexDocument(document);
    } catch (error) {
      logger.error('Erro ao indexar artigo no Elasticsearch', error);
      throw error;
    }
  }

  /**
   * Remove documento do índice
   */
  async removeDocument(entityType: string, entityId: number): Promise<void> {
    await this.initClient();
    if (!this.client) {
      return;
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: `${entityType}_${entityId}`
      });

      logger.info(`Documento ${entityType}:${entityId} removido do índice`);
    } catch (error: unknown) {
      const esError = error as { meta?: { statusCode?: number } };
      if (esError.meta?.statusCode === 404) {
        logger.info(`Documento ${entityType}:${entityId} não existe no índice`);
        return;
      }
      logger.error('Erro ao remover documento', error);
      throw error;
    }
  }

  /**
   * Reindexação completa
   */
  async reindexAll(): Promise<void> {
    await this.initClient();
    if (!this.client) {
      logger.warn('Elasticsearch not available - skipping reindex');
      return;
    }

    try {
      logger.info('Iniciando reindexação completa...');

      // Remove índice existente
      try {
        await this.client.indices.delete({ index: this.indexName });
      } catch (error) {
        // Ignora se índice não existe
      }

      // Cria novo índice
      await this.createIndex();

      // Indexa todos os artigos publicados
      const articles = db.prepare(`
        SELECT id FROM kb_articles WHERE status = 'published'
      `).all() as Array<{ id: number }>;

      for (const article of articles) {
        await this.indexKnowledgeArticle(article.id);
        // Pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      logger.info(`Reindexação completa: ${articles.length} artigos indexados`);
    } catch (error) {
      logger.error('Erro na reindexação completa', error);
      throw error;
    }
  }

  /**
   * Sugestões de autocompletar
   */
  async suggest(text: string, size: number = 5): Promise<string[]> {
    await this.initClient();
    if (!this.client) {
      return [];
    }

    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          suggest: {
            title_suggest: {
              prefix: text,
              completion: {
                field: 'title.suggest',
                size
              }
            }
          }
        }
      }) as any;

      return response.body.suggest.title_suggest[0].options.map(
        (option: any) => option.text
      );
    } catch (error) {
      logger.error('Erro ao obter sugestões', error);
      return [];
    }
  }

  /**
   * Estatísticas do índice
   */
  async getIndexStats(): Promise<any> {
    await this.initClient();
    if (!this.client) {
      return { documentCount: 0, sizeInBytes: 0, available: false };
    }

    try {
      const stats = await (this.client as any).indices.stats({ index: this.indexName });
      const count = await (this.client as any).count({ index: this.indexName });

      return {
        document_count: count.body.count,
        index_size: stats.body._all.total.store.size_in_bytes,
        search_rate: stats.body._all.total.search.query_time_in_millis,
        indexing_rate: stats.body._all.total.indexing.index_time_in_millis
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas do índice', error);
      return null;
    }
  }
}

// Configuração padrão
const defaultConfig: ElasticsearchConfig = {
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  index: process.env.ELASTICSEARCH_INDEX || 'servicedesk_knowledge',
  maxResults: 20,
  ...(process.env.ELASTICSEARCH_API_KEY && { apiKey: process.env.ELASTICSEARCH_API_KEY }),
  ...(process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD && {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  })
};

// Instância singleton
export const elasticsearchIntegration = new ElasticsearchIntegration(defaultConfig);