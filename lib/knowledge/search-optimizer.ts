// Search analytics e otimização de busca
import { db } from '../db/connection';
import { vectorSearchEngine } from './vector-search';
import { elasticsearchIntegration } from './elasticsearch-integration';
import { logger } from '../monitoring/logger';

interface SearchAnalytics {
  id: number;
  session_id?: string;
  user_id?: number;
  query: string;
  query_hash: string;
  filters?: string; // JSON
  results_count: number;
  clicked_result_id?: number;
  clicked_result_position?: number;
  clicked_result_type?: string;
  search_time_ms: number;
  found_answer: boolean;
  satisfaction_rating?: number;
  created_at: string;
}

interface QuerySuggestion {
  original_query: string;
  suggested_query: string;
  improvement_type: 'spelling' | 'synonym' | 'expansion' | 'refinement';
  confidence: number;
}

interface SearchOptimization {
  query_patterns: QueryPattern[];
  popular_searches: PopularSearch[];
  failed_searches: FailedSearch[];
  performance_metrics: PerformanceMetrics;
  suggestions: SearchSuggestion[];
}

interface QueryPattern {
  pattern: string;
  frequency: number;
  avg_results: number;
  success_rate: number;
  avg_satisfaction: number;
}

interface PopularSearch {
  query: string;
  search_count: number;
  unique_users: number;
  avg_results: number;
  click_through_rate: number;
}

interface FailedSearch {
  query: string;
  frequency: number;
  zero_results: number;
  low_satisfaction: number;
  suggested_improvements: string[];
}

interface PerformanceMetrics {
  avg_search_time: number;
  avg_results_count: number;
  click_through_rate: number;
  zero_results_rate: number;
  satisfaction_score: number;
  bounce_rate: number;
}

interface SearchInsights {
  trending_topics: string[];
  content_gaps: string[];
  user_behavior: UserBehavior;
  seasonal_patterns: SeasonalPattern[];
}

interface UserBehavior {
  avg_queries_per_session: number;
  common_query_length: number;
  preferred_result_types: Record<string, number>;
  peak_search_hours: number[];
}

interface SeasonalPattern {
  period: string;
  topics: string[];
  volume_change: number;
}

export class SearchOptimizer {
  /**
   * Registra uma busca para analytics
   */
  async logSearch(
    sessionId: string,
    userId: number | null,
    query: string,
    filters: any,
    resultsCount: number,
    searchTimeMs: number
  ): Promise<number> {
    try {
      const queryHash = this.hashQuery(query);

      const result = await db.run(`
        INSERT INTO analytics_events (
          event_type, user_id, session_id, entity_type, properties
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        'search_performed',
        userId,
        sessionId,
        'search',
        JSON.stringify({
          query,
          query_hash: queryHash,
          filters,
          results_count: resultsCount,
          search_time_ms: searchTimeMs
        })
      ]);

      return result.lastID!;
    } catch (error) {
      logger.error('Erro ao registrar busca', error);
      throw error;
    }
  }

  /**
   * Registra clique em resultado
   */
  async logResultClick(
    searchEventId: number,
    resultId: number,
    resultType: string,
    position: number,
    sessionId: string
  ): Promise<void> {
    try {
      await db.run(`
        INSERT INTO analytics_events (
          event_type, session_id, entity_type, entity_id, properties
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        'search_result_click',
        sessionId,
        resultType,
        resultId,
        JSON.stringify({
          search_event_id: searchEventId,
          position,
          result_type: resultType
        })
      ]);

      // Atualiza estatísticas do documento clicado
      await this.updateDocumentStats(resultType, resultId, 'click');
    } catch (error) {
      logger.error('Erro ao registrar clique', error);
      throw error;
    }
  }

  /**
   * Registra feedback de satisfação
   */
  async logSearchSatisfaction(
    searchEventId: number,
    foundAnswer: boolean,
    rating?: number,
    feedback?: string
  ): Promise<void> {
    try {
      await db.run(`
        INSERT INTO analytics_events (
          event_type, properties
        ) VALUES (?, ?)
      `, [
        'search_satisfaction',
        JSON.stringify({
          search_event_id: searchEventId,
          found_answer: foundAnswer,
          rating,
          feedback
        })
      ]);
    } catch (error) {
      logger.error('Erro ao registrar satisfação', error);
      throw error;
    }
  }

  /**
   * Analisa padrões de busca
   */
  async analyzeSearchPatterns(timeframe: string = '30 days'): Promise<QueryPattern[]> {
    try {
      const patterns = await db.all(`
        SELECT
          json_extract(properties, '$.query') as query,
          COUNT(*) as frequency,
          AVG(CAST(json_extract(properties, '$.results_count') AS INTEGER)) as avg_results,
          (COUNT(clicks.id) * 1.0 / COUNT(*)) as success_rate,
          AVG(COALESCE(satisfaction.rating, 3)) as avg_satisfaction
        FROM analytics_events searches
        LEFT JOIN analytics_events clicks ON searches.session_id = clicks.session_id
          AND clicks.event_type = 'search_result_click'
          AND clicks.created_at BETWEEN searches.created_at AND datetime(searches.created_at, '+5 minutes')
        LEFT JOIN analytics_events satisfaction ON searches.id = json_extract(satisfaction.properties, '$.search_event_id')
          AND satisfaction.event_type = 'search_satisfaction'
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= datetime('now', '-' || ? || '')
        GROUP BY json_extract(properties, '$.query')
        HAVING frequency > 1
        ORDER BY frequency DESC
        LIMIT 50
      `, [timeframe]);

      return patterns.map(p => ({
        pattern: p.query,
        frequency: p.frequency,
        avg_results: Math.round(p.avg_results || 0),
        success_rate: Number((p.success_rate || 0).toFixed(3)),
        avg_satisfaction: Number((p.avg_satisfaction || 3).toFixed(2))
      }));
    } catch (error) {
      logger.error('Erro ao analisar padrões de busca', error);
      return [];
    }
  }

  /**
   * Identifica buscas populares
   */
  async getPopularSearches(timeframe: string = '7 days'): Promise<PopularSearch[]> {
    try {
      const popular = await db.all(`
        SELECT
          json_extract(properties, '$.query') as query,
          COUNT(*) as search_count,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(CAST(json_extract(properties, '$.results_count') AS INTEGER)) as avg_results,
          (COUNT(clicks.id) * 1.0 / COUNT(*)) as click_through_rate
        FROM analytics_events searches
        LEFT JOIN analytics_events clicks ON searches.session_id = clicks.session_id
          AND clicks.event_type = 'search_result_click'
          AND clicks.created_at BETWEEN searches.created_at AND datetime(searches.created_at, '+5 minutes')
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= datetime('now', '-' || ? || '')
        GROUP BY json_extract(properties, '$.query')
        ORDER BY search_count DESC
        LIMIT 20
      `, [timeframe]);

      return popular.map(p => ({
        query: p.query,
        search_count: p.search_count,
        unique_users: p.unique_users || 1,
        avg_results: Math.round(p.avg_results || 0),
        click_through_rate: Number((p.click_through_rate || 0).toFixed(3))
      }));
    } catch (error) {
      logger.error('Erro ao obter buscas populares', error);
      return [];
    }
  }

  /**
   * Identifica buscas com falha
   */
  async getFailedSearches(timeframe: string = '7 days'): Promise<FailedSearch[]> {
    try {
      const failed = await db.all(`
        SELECT
          json_extract(properties, '$.query') as query,
          COUNT(*) as frequency,
          SUM(CASE WHEN CAST(json_extract(properties, '$.results_count') AS INTEGER) = 0 THEN 1 ELSE 0 END) as zero_results,
          COUNT(satisfaction.id) as satisfaction_responses,
          AVG(COALESCE(CAST(json_extract(satisfaction.properties, '$.rating') AS INTEGER), 1)) as avg_rating
        FROM analytics_events searches
        LEFT JOIN analytics_events satisfaction ON searches.id = json_extract(satisfaction.properties, '$.search_event_id')
          AND satisfaction.event_type = 'search_satisfaction'
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= datetime('now', '-' || ? || '')
        GROUP BY json_extract(properties, '$.query')
        HAVING zero_results > 0 OR avg_rating < 2.5
        ORDER BY frequency DESC
        LIMIT 20
      `, [timeframe]);

      const failedSearches: FailedSearch[] = [];

      for (const f of failed) {
        const suggestions = await this.generateQuerySuggestions(f.query);
        failedSearches.push({
          query: f.query,
          frequency: f.frequency,
          zero_results: f.zero_results,
          low_satisfaction: f.satisfaction_responses - (f.avg_rating >= 3 ? f.satisfaction_responses : 0),
          suggested_improvements: suggestions.map(s => s.suggested_query)
        });
      }

      return failedSearches;
    } catch (error) {
      logger.error('Erro ao obter buscas com falha', error);
      return [];
    }
  }

  /**
   * Calcula métricas de performance
   */
  async getPerformanceMetrics(timeframe: string = '30 days'): Promise<PerformanceMetrics> {
    try {
      const metrics = await db.get(`
        SELECT
          AVG(CAST(json_extract(properties, '$.search_time_ms') AS INTEGER)) as avg_search_time,
          AVG(CAST(json_extract(properties, '$.results_count') AS INTEGER)) as avg_results_count,
          (SELECT COUNT(*) FROM analytics_events clicks
           WHERE clicks.event_type = 'search_result_click'
             AND clicks.created_at >= datetime('now', '-' || ? || '')) * 1.0 / COUNT(*) as click_through_rate,
          SUM(CASE WHEN CAST(json_extract(properties, '$.results_count') AS INTEGER) = 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as zero_results_rate
        FROM analytics_events searches
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= datetime('now', '-' || ? || '')
      `, [timeframe, timeframe]);

      const satisfaction = await db.get(`
        SELECT AVG(CAST(json_extract(properties, '$.rating') AS INTEGER)) as avg_satisfaction
        FROM analytics_events
        WHERE event_type = 'search_satisfaction'
          AND created_at >= datetime('now', '-' || ? || '')
      `, [timeframe]);

      return {
        avg_search_time: Math.round(metrics?.avg_search_time || 0),
        avg_results_count: Math.round(metrics?.avg_results_count || 0),
        click_through_rate: Number((metrics?.click_through_rate || 0).toFixed(3)),
        zero_results_rate: Number((metrics?.zero_results_rate || 0).toFixed(3)),
        satisfaction_score: Number((satisfaction?.avg_satisfaction || 3).toFixed(2)),
        bounce_rate: Number((1 - (metrics?.click_through_rate || 0)).toFixed(3))
      };
    } catch (error) {
      logger.error('Erro ao calcular métricas', error);
      return {
        avg_search_time: 0,
        avg_results_count: 0,
        click_through_rate: 0,
        zero_results_rate: 0,
        satisfaction_score: 3,
        bounce_rate: 1
      };
    }
  }

  /**
   * Gera sugestões de melhoria para queries
   */
  async generateQuerySuggestions(query: string): Promise<QuerySuggestion[]> {
    const suggestions: QuerySuggestion[] = [];

    try {
      // Correção ortográfica básica
      const spellingSuggestion = this.getSpellingSuggestion(query);
      if (spellingSuggestion) {
        suggestions.push({
          original_query: query,
          suggested_query: spellingSuggestion,
          improvement_type: 'spelling',
          confidence: 0.8
        });
      }

      // Expansão de sinônimos
      const synonymSuggestion = await this.getSynonymExpansion(query);
      if (synonymSuggestion) {
        suggestions.push({
          original_query: query,
          suggested_query: synonymSuggestion,
          improvement_type: 'synonym',
          confidence: 0.7
        });
      }

      // Sugestões baseadas em buscas similares bem-sucedidas
      const similarSuccessful = await this.getSimilarSuccessfulQueries(query);
      for (const similar of similarSuccessful) {
        suggestions.push({
          original_query: query,
          suggested_query: similar.query,
          improvement_type: 'refinement',
          confidence: similar.confidence
        });
      }

    } catch (error) {
      logger.error('Erro ao gerar sugestões', error);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Correção ortográfica simples
   */
  private getSpellingSuggestion(query: string): string | null {
    const commonMisspellings: Record<string, string> = {
      'erro': 'error',
      'sennha': 'senha',
      'usuaro': 'usuario',
      'sistems': 'sistema',
      'problemas': 'problema',
      'loginn': 'login',
      'acessso': 'acesso'
    };

    const words = query.toLowerCase().split(' ');
    let corrected = false;

    const correctedWords = words.map(word => {
      if (commonMisspellings[word]) {
        corrected = true;
        return commonMisspellings[word];
      }
      return word;
    });

    return corrected ? correctedWords.join(' ') : null;
  }

  /**
   * Expansão de sinônimos
   */
  private async getSynonymExpansion(query: string): Promise<string | null> {
    const synonyms: Record<string, string[]> = {
      'problema': ['issue', 'erro', 'falha', 'bug'],
      'senha': ['password', 'login', 'acesso'],
      'usuario': ['user', 'cliente', 'person'],
      'sistema': ['application', 'app', 'software'],
      'erro': ['error', 'problema', 'falha']
    };

    const words = query.toLowerCase().split(' ');
    const expandedWords: string[] = [];

    for (const word of words) {
      expandedWords.push(word);
      if (synonyms[word]) {
        expandedWords.push(...synonyms[word]);
      }
    }

    return expandedWords.length > words.length ? expandedWords.join(' ') : null;
  }

  /**
   * Encontra queries similares bem-sucedidas
   */
  private async getSimilarSuccessfulQueries(query: string): Promise<Array<{query: string, confidence: number}>> {
    try {
      const similar = await db.all(`
        SELECT
          json_extract(properties, '$.query') as query,
          COUNT(*) as frequency,
          AVG(CAST(json_extract(properties, '$.results_count') AS INTEGER)) as avg_results,
          (COUNT(clicks.id) * 1.0 / COUNT(*)) as success_rate
        FROM analytics_events searches
        LEFT JOIN analytics_events clicks ON searches.session_id = clicks.session_id
          AND clicks.event_type = 'search_result_click'
        WHERE searches.event_type = 'search_performed'
          AND json_extract(properties, '$.query') != ?
          AND (
            json_extract(properties, '$.query') LIKE '%' || ? || '%'
            OR ? LIKE '%' || json_extract(properties, '$.query') || '%'
          )
        GROUP BY json_extract(properties, '$.query')
        HAVING avg_results > 0 AND success_rate > 0
        ORDER BY success_rate DESC, frequency DESC
        LIMIT 3
      `, [query, query, query]);

      return similar.map(s => ({
        query: s.query,
        confidence: Math.min(s.success_rate * 0.8, 0.9)
      }));
    } catch (error) {
      logger.error('Erro ao buscar queries similares', error);
      return [];
    }
  }

  /**
   * Identifica lacunas de conteúdo
   */
  async identifyContentGaps(timeframe: string = '30 days'): Promise<string[]> {
    try {
      const gaps = await db.all(`
        SELECT
          json_extract(properties, '$.query') as query,
          COUNT(*) as frequency,
          AVG(CAST(json_extract(properties, '$.results_count') AS INTEGER)) as avg_results
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= datetime('now', '-' || ? || '')
        GROUP BY json_extract(properties, '$.query')
        HAVING avg_results < 2 AND frequency > 2
        ORDER BY frequency DESC
        LIMIT 10
      `, [timeframe]);

      return gaps.map(g => g.query);
    } catch (error) {
      logger.error('Erro ao identificar lacunas de conteúdo', error);
      return [];
    }
  }

  /**
   * Obtém insights de comportamento do usuário
   */
  async getUserBehaviorInsights(timeframe: string = '30 days'): Promise<UserBehavior> {
    try {
      const behavior = await db.get(`
        SELECT
          COUNT(*) * 1.0 / COUNT(DISTINCT session_id) as avg_queries_per_session,
          AVG(LENGTH(json_extract(properties, '$.query'))) as avg_query_length
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= datetime('now', '-' || ? || '')
      `, [timeframe]);

      const resultTypes = await db.all(`
        SELECT
          entity_type,
          COUNT(*) as clicks
        FROM analytics_events
        WHERE event_type = 'search_result_click'
          AND created_at >= datetime('now', '-' || ? || '')
        GROUP BY entity_type
      `, [timeframe]);

      const hourly = await db.all(`
        SELECT
          strftime('%H', created_at) as hour,
          COUNT(*) as searches
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= datetime('now', '-' || ? || '')
        GROUP BY strftime('%H', created_at)
        ORDER BY searches DESC
        LIMIT 3
      `, [timeframe]);

      const preferredTypes: Record<string, number> = {};
      resultTypes.forEach(rt => {
        preferredTypes[rt.entity_type] = rt.clicks;
      });

      return {
        avg_queries_per_session: Number((behavior?.avg_queries_per_session || 1).toFixed(2)),
        common_query_length: Math.round(behavior?.avg_query_length || 10),
        preferred_result_types: preferredTypes,
        peak_search_hours: hourly.map(h => parseInt(h.hour))
      };
    } catch (error) {
      logger.error('Erro ao obter insights de comportamento', error);
      return {
        avg_queries_per_session: 1,
        common_query_length: 10,
        preferred_result_types: {},
        peak_search_hours: [9, 14, 16]
      };
    }
  }

  /**
   * Gera relatório completo de otimização
   */
  async generateOptimizationReport(timeframe: string = '30 days'): Promise<SearchOptimization> {
    try {
      const [
        queryPatterns,
        popularSearches,
        failedSearches,
        performanceMetrics
      ] = await Promise.all([
        this.analyzeSearchPatterns(timeframe),
        this.getPopularSearches(timeframe),
        this.getFailedSearches(timeframe),
        this.getPerformanceMetrics(timeframe)
      ]);

      // Gera sugestões baseadas nos dados
      const suggestions: SearchSuggestion[] = [];

      // Sugestões para queries com falha
      for (const failed of failedSearches.slice(0, 5)) {
        const querySuggestions = await this.generateQuerySuggestions(failed.query);
        suggestions.push(...querySuggestions);
      }

      return {
        query_patterns: queryPatterns,
        popular_searches: popularSearches,
        failed_searches: failedSearches,
        performance_metrics: performanceMetrics,
        suggestions: suggestions.slice(0, 10)
      };
    } catch (error) {
      logger.error('Erro ao gerar relatório de otimização', error);
      throw error;
    }
  }

  /**
   * Atualiza estatísticas do documento
   */
  private async updateDocumentStats(
    entityType: string,
    entityId: number,
    action: 'click' | 'view'
  ): Promise<void> {
    try {
      switch (entityType) {
        case 'kb_article':
          if (action === 'view') {
            await db.run(`
              UPDATE kb_articles SET view_count = view_count + 1
              WHERE id = ?
            `, [entityId]);
          }
          break;
      }
    } catch (error) {
      logger.error('Erro ao atualizar estatísticas do documento', error);
    }
  }

  /**
   * Gera hash da query para agrupamento
   */
  private hashQuery(query: string): string {
    // Normaliza a query para agrupamento
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');

    return Buffer.from(normalized).toString('base64');
  }

  /**
   * Otimiza automaticamente queries baseado em padrões
   */
  async autoOptimizeQuery(query: string): Promise<{
    optimized_query: string;
    optimizations_applied: string[];
    confidence: number;
  }> {
    const optimizations: string[] = [];
    let optimizedQuery = query;
    let confidence = 1.0;

    try {
      // Correção ortográfica
      const spellingSuggestion = this.getSpellingSuggestion(query);
      if (spellingSuggestion) {
        optimizedQuery = spellingSuggestion;
        optimizations.push('spelling_correction');
        confidence *= 0.9;
      }

      // Expansão de sinônimos para queries muito curtas
      if (optimizedQuery.split(' ').length <= 2) {
        const synonymExpansion = await this.getSynonymExpansion(optimizedQuery);
        if (synonymExpansion) {
          optimizedQuery = synonymExpansion;
          optimizations.push('synonym_expansion');
          confidence *= 0.8;
        }
      }

      // Verifica se existe query similar bem-sucedida
      const similarSuccessful = await this.getSimilarSuccessfulQueries(optimizedQuery);
      if (similarSuccessful.length > 0 && similarSuccessful[0].confidence > 0.8) {
        optimizedQuery = similarSuccessful[0].query;
        optimizations.push('similar_successful_query');
        confidence *= similarSuccessful[0].confidence;
      }

      return {
        optimized_query: optimizedQuery,
        optimizations_applied: optimizations,
        confidence: Number(confidence.toFixed(3))
      };
    } catch (error) {
      logger.error('Erro na otimização automática de query', error);
      return {
        optimized_query: query,
        optimizations_applied: [],
        confidence: 1.0
      };
    }
  }
}

// Instância singleton
export const searchOptimizer = new SearchOptimizer();