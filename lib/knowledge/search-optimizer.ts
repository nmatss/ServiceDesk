// Search analytics e otimização de busca
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import logger from '../monitoring/structured-logger';

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

/**
 * Build a dialect-aware date expression for dynamic timeframe intervals.
 * PostgreSQL uses inline INTERVAL (timeframe is sanitized and interpolated).
 * SQLite uses datetime('now', '-' || ? || '') with a parameter.
 */
function buildDateExpr(timeframe: string, isPg: boolean): { expr: string; params: any[] } {
  if (isPg) {
    const sanitized = timeframe.replace(/[^a-zA-Z0-9 ]/g, '');
    return { expr: `NOW() - INTERVAL '${sanitized}'`, params: [] };
  }
  return { expr: `datetime('now', '-' || ? || '')`, params: [timeframe] };
}

/**
 * Build a dialect-aware JSON field extraction expression.
 */
function jsonField(column: string, field: string, isPg: boolean): string {
  if (isPg) {
    return `${column}::json->>'${field}'`;
  }
  return `json_extract(${column}, '$.${field}')`;
}

/**
 * Build dialect-aware "created_at + 5 minutes" expression for click window.
 */
function dateAdd5Min(column: string, isPg: boolean): string {
  if (isPg) {
    return `${column} + INTERVAL '5 minutes'`;
  }
  return `datetime(${column}, '+5 minutes')`;
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

      const result = await executeRun(`
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

      return result.lastInsertRowid as number;
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
      await executeRun(`
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
      await executeRun(`
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
      const isPg = getDatabaseType() === 'postgresql';
      const { expr: dateExpr, params: dateParams } = buildDateExpr(timeframe, isPg);
      const queryField = jsonField('properties', 'query', isPg);
      const resultsField = jsonField('properties', 'results_count', isPg);
      const clickWindow = dateAdd5Min('searches.created_at', isPg);

      // For PG: json_extract(satisfaction.properties, '$.search_event_id') equivalent
      const satSearchEventId = jsonField('satisfaction.properties', 'search_event_id', isPg);

      const patterns = await executeQuery<any>(`
        SELECT
          ${queryField} as query,
          COUNT(*) as frequency,
          AVG(CAST(${resultsField} AS INTEGER)) as avg_results,
          (COUNT(clicks.id) * 1.0 / NULLIF(COUNT(*), 0)) as success_rate,
          AVG(COALESCE(satisfaction.rating, 3)) as avg_satisfaction
        FROM analytics_events searches
        LEFT JOIN analytics_events clicks ON searches.session_id = clicks.session_id
          AND clicks.event_type = 'search_result_click'
          AND clicks.created_at BETWEEN searches.created_at AND ${clickWindow}
        LEFT JOIN analytics_events satisfaction ON searches.id = CAST(${satSearchEventId} AS INTEGER)
          AND satisfaction.event_type = 'search_satisfaction'
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= ${dateExpr}
        GROUP BY ${queryField}
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 50
      `, [...dateParams]);

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
      const isPg = getDatabaseType() === 'postgresql';
      const { expr: dateExpr, params: dateParams } = buildDateExpr(timeframe, isPg);
      const queryField = jsonField('properties', 'query', isPg);
      const resultsField = jsonField('properties', 'results_count', isPg);
      const clickWindow = dateAdd5Min('searches.created_at', isPg);

      const popular = await executeQuery<any>(`
        SELECT
          ${queryField} as query,
          COUNT(*) as search_count,
          COUNT(DISTINCT searches.user_id) as unique_users,
          AVG(CAST(${resultsField} AS INTEGER)) as avg_results,
          (COUNT(clicks.id) * 1.0 / NULLIF(COUNT(*), 0)) as click_through_rate
        FROM analytics_events searches
        LEFT JOIN analytics_events clicks ON searches.session_id = clicks.session_id
          AND clicks.event_type = 'search_result_click'
          AND clicks.created_at BETWEEN searches.created_at AND ${clickWindow}
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= ${dateExpr}
        GROUP BY ${queryField}
        ORDER BY search_count DESC
        LIMIT 20
      `, [...dateParams]);

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
      const isPg = getDatabaseType() === 'postgresql';
      const { expr: dateExpr, params: dateParams } = buildDateExpr(timeframe, isPg);
      const queryField = jsonField('properties', 'query', isPg);
      const resultsField = jsonField('properties', 'results_count', isPg);
      const satSearchEventId = jsonField('satisfaction.properties', 'search_event_id', isPg);
      const satRatingField = jsonField('satisfaction.properties', 'rating', isPg);

      const failed = await executeQuery<any>(`
        SELECT
          ${queryField} as query,
          COUNT(*) as frequency,
          SUM(CASE WHEN CAST(${resultsField} AS INTEGER) = 0 THEN 1 ELSE 0 END) as zero_results,
          COUNT(satisfaction.id) as satisfaction_responses,
          AVG(COALESCE(CAST(${satRatingField} AS INTEGER), 1)) as avg_rating
        FROM analytics_events searches
        LEFT JOIN analytics_events satisfaction ON searches.id = CAST(${satSearchEventId} AS INTEGER)
          AND satisfaction.event_type = 'search_satisfaction'
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= ${dateExpr}
        GROUP BY ${queryField}
        HAVING SUM(CASE WHEN CAST(${resultsField} AS INTEGER) = 0 THEN 1 ELSE 0 END) > 0
           OR AVG(COALESCE(CAST(${satRatingField} AS INTEGER), 1)) < 2.5
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `, [...dateParams]);

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
      const isPg = getDatabaseType() === 'postgresql';
      const { expr: dateExpr, params: dateParams } = buildDateExpr(timeframe, isPg);
      const searchTimeField = jsonField('properties', 'search_time_ms', isPg);
      const resultsField = jsonField('properties', 'results_count', isPg);
      const satRatingField = jsonField('properties', 'rating', isPg);

      const metrics = await executeQueryOne<any>(`
        SELECT
          AVG(CAST(${searchTimeField} AS INTEGER)) as avg_search_time,
          AVG(CAST(${resultsField} AS INTEGER)) as avg_results_count,
          (SELECT COUNT(*) FROM analytics_events clicks
           WHERE clicks.event_type = 'search_result_click'
             AND clicks.created_at >= ${dateExpr}) * 1.0 / NULLIF(COUNT(*), 0) as click_through_rate,
          SUM(CASE WHEN CAST(${resultsField} AS INTEGER) = 0 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0) as zero_results_rate
        FROM analytics_events searches
        WHERE searches.event_type = 'search_performed'
          AND searches.created_at >= ${dateExpr}
      `, [...dateParams, ...dateParams]);

      const satisfaction = await executeQueryOne<any>(`
        SELECT AVG(CAST(${satRatingField} AS INTEGER)) as avg_satisfaction
        FROM analytics_events
        WHERE event_type = 'search_satisfaction'
          AND created_at >= ${dateExpr}
      `, [...dateParams]);

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
      const isPg = getDatabaseType() === 'postgresql';
      const queryField = jsonField('properties', 'query', isPg);
      const resultsField = jsonField('properties', 'results_count', isPg);

      // Escape LIKE wildcards in user input
      const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');

      const similar = await executeQuery<any>(`
        SELECT
          ${queryField} as query,
          COUNT(*) as frequency,
          AVG(CAST(${resultsField} AS INTEGER)) as avg_results,
          (COUNT(clicks.id) * 1.0 / NULLIF(COUNT(*), 0)) as success_rate
        FROM analytics_events searches
        LEFT JOIN analytics_events clicks ON searches.session_id = clicks.session_id
          AND clicks.event_type = 'search_result_click'
        WHERE searches.event_type = 'search_performed'
          AND ${queryField} != ?
          AND (
            ${queryField} LIKE '%' || ? || '%' ESCAPE '\\'
            OR ? LIKE '%' || ${queryField} || '%' ESCAPE '\\'
          )
        GROUP BY ${queryField}
        HAVING AVG(CAST(${resultsField} AS INTEGER)) > 0
           AND (COUNT(clicks.id) * 1.0 / NULLIF(COUNT(*), 0)) > 0
        ORDER BY success_rate DESC, frequency DESC
        LIMIT 3
      `, [query, escapedQuery, escapedQuery]);

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
      const isPg = getDatabaseType() === 'postgresql';
      const { expr: dateExpr, params: dateParams } = buildDateExpr(timeframe, isPg);
      const queryField = jsonField('properties', 'query', isPg);
      const resultsField = jsonField('properties', 'results_count', isPg);

      const gaps = await executeQuery<any>(`
        SELECT
          ${queryField} as query,
          COUNT(*) as frequency,
          AVG(CAST(${resultsField} AS INTEGER)) as avg_results
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= ${dateExpr}
        GROUP BY ${queryField}
        HAVING AVG(CAST(${resultsField} AS INTEGER)) < 2 AND COUNT(*) > 2
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [...dateParams]);

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
      const isPg = getDatabaseType() === 'postgresql';
      const { expr: dateExpr, params: dateParams } = buildDateExpr(timeframe, isPg);
      const queryField = jsonField('properties', 'query', isPg);

      // strftime('%H', created_at) → EXTRACT(HOUR FROM created_at) for PG
      const hourExpr = isPg
        ? `EXTRACT(HOUR FROM created_at)::INTEGER`
        : `CAST(strftime('%H', created_at) AS INTEGER)`;

      const behavior = await executeQueryOne<any>(`
        SELECT
          COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT session_id), 0) as avg_queries_per_session,
          AVG(LENGTH(${queryField})) as avg_query_length
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= ${dateExpr}
      `, [...dateParams]);

      const resultTypes = await executeQuery<any>(`
        SELECT
          entity_type,
          COUNT(*) as clicks
        FROM analytics_events
        WHERE event_type = 'search_result_click'
          AND created_at >= ${dateExpr}
        GROUP BY entity_type
      `, [...dateParams]);

      const hourly = await executeQuery<any>(`
        SELECT
          ${hourExpr} as hour,
          COUNT(*) as searches
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= ${dateExpr}
        GROUP BY ${hourExpr}
        ORDER BY searches DESC
        LIMIT 3
      `, [...dateParams]);

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
            await executeRun(`
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
