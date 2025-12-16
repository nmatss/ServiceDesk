/**
 * Knowledge Base Auto-Generator
 * Automatically generates FAQ articles from resolved tickets,
 * suggests new articles based on patterns, identifies content gaps,
 * and scores content quality
 */

import { openAIClient } from '../ai/openai-client';
import db from '../db/connection';
import { semanticIndexer } from './semantic-indexer';
import logger from '../monitoring/structured-logger';

interface ArticleGenerationRequest {
  ticket_ids?: number[];
  category_id?: number;
  priority_threshold?: number;
  min_resolution_time?: number;
  template_type?: 'troubleshooting' | 'how_to' | 'faq' | 'quick_fix';
  target_audience?: 'user' | 'agent' | 'admin';
  language?: string;
}

interface GeneratedArticle {
  title: string;
  summary: string;
  content: string;
  category_id?: number;
  tags: string[];
  search_keywords: string;
  meta_title: string;
  meta_description: string;
  source_tickets: number[];
  generation_metadata: {
    model_used: string;
    prompt_version: string;
    generation_time_ms: number;
    confidence_score: number;
    tokens_used: number;
  };
}

interface ContentTemplate {
  type: string;
  name: string;
  system_prompt: string;
  user_prompt_template: string;
  post_processing_rules: string[];
  target_length: { min: number; max: number };
}

interface TicketAnalysis {
  ticket_id: number;
  title: string;
  description: string;
  resolution: string;
  category: string;
  resolution_time_hours: number;
  satisfaction_rating?: number;
  relevance_score: number;
}

export class AutoGenerator {
  private templates: Map<string, ContentTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Inicializa templates de geração
   */
  private initializeTemplates(): void {
    const templates: ContentTemplate[] = [
      {
        type: 'troubleshooting',
        name: 'Guia de Solução de Problemas',
        system_prompt: `Você é um especialista em documentação técnica. Crie guias claros e estruturados para solução de problemas baseados em tickets de suporte resolvidos.

Diretrizes:
- Use linguagem clara e objetiva
- Estruture em seções lógicas: Problema → Causa → Solução → Prevenção
- Inclua passos numerados quando necessário
- Adicione avisos e dicas importantes
- Mantenha tom profissional mas acessível`,
        user_prompt_template: `Com base nos seguintes tickets resolvidos, crie um guia de solução de problemas:

{{TICKET_DATA}}

Estruture o guia com:
1. Título descritivo
2. Resumo do problema
3. Sintomas comuns
4. Possíveis causas
5. Soluções passo a passo
6. Como prevenir o problema
7. Quando escalar para suporte

Foco na categoria: {{CATEGORY}}
Público-alvo: {{AUDIENCE}}`,
        post_processing_rules: [
          'Validar que todas as seções estão presentes',
          'Verificar formatação Markdown',
          'Garantir que há pelo menos 3 soluções diferentes',
          'Adicionar alertas de segurança quando necessário'
        ],
        target_length: { min: 800, max: 2000 }
      },
      {
        type: 'how_to',
        name: 'Tutorial Passo a Passo',
        system_prompt: `Você é um especialista em criação de tutoriais técnicos. Crie guias passo a passo claros e fáceis de seguir.

Diretrizes:
- Use instruções numeradas e claras
- Inclua pré-requisitos
- Mencione tempo estimado
- Adicione capturas de tela imaginárias quando útil
- Teste a sequência lógica dos passos`,
        user_prompt_template: `Baseado nestes tickets resolvidos, crie um tutorial passo a passo:

{{TICKET_DATA}}

Inclua:
1. Título claro do que será ensinado
2. Pré-requisitos necessários
3. Tempo estimado de execução
4. Passos numerados e detalhados
5. Verificações de sucesso em cada etapa
6. Solução de problemas comuns
7. Próximos passos recomendados

Categoria: {{CATEGORY}}
Nível: {{AUDIENCE}}`,
        post_processing_rules: [
          'Numerar todos os passos sequencialmente',
          'Adicionar validações após passos críticos',
          'Incluir tempo estimado total',
          'Verificar se os passos são executáveis'
        ],
        target_length: { min: 600, max: 1500 }
      },
      {
        type: 'faq',
        name: 'FAQ - Perguntas Frequentes',
        system_prompt: `Você é especialista em criar FAQs úteis e organizados. Transforme tickets recorrentes em perguntas e respostas claras.

Diretrizes:
- Perguntas devem ser como usuários realmente perguntam
- Respostas concisas mas completas
- Organize por frequência/importância
- Use linguagem do usuário final
- Inclua variações da mesma pergunta`,
        user_prompt_template: `Transforme estes tickets em FAQ, agrupando problemas similares:

{{TICKET_DATA}}

Para cada pergunta:
1. Formule como usuário perguntaria
2. Resposta clara e direta
3. Links para documentação detalhada quando relevante
4. Variações comuns da pergunta

Categoria: {{CATEGORY}}
Ordene por frequência dos problemas.`,
        post_processing_rules: [
          'Agrupar perguntas similares',
          'Ordenar por frequência',
          'Limitar a 10 perguntas por artigo',
          'Garantir respostas objetivas'
        ],
        target_length: { min: 400, max: 1200 }
      },
      {
        type: 'quick_fix',
        name: 'Correção Rápida',
        system_prompt: `Você cria guias de correção rápida para problemas comuns. Foque em soluções diretas e eficientes.

Diretrizes:
- Máximo 5 passos por solução
- Comece sempre pela solução mais simples
- Inclua comandos ou códigos quando necessário
- Mencione quando procurar ajuda adicional
- Use formato de checklist`,
        user_prompt_template: `Crie um guia de correção rápida baseado nestes tickets:

{{TICKET_DATA}}

Formato:
1. Descrição do problema em 1 linha
2. Soluções ordenadas por simplicidade (máximo 3)
3. Cada solução em até 5 passos
4. Código/comandos quando aplicável
5. Quando esta solução não funciona

Categoria: {{CATEGORY}}
Tempo máximo: 10 minutos`,
        post_processing_rules: [
          'Máximo 5 passos por solução',
          'Incluir tempo estimado',
          'Validar comandos e códigos',
          'Adicionar escape hatch (quando procurar ajuda)'
        ],
        target_length: { min: 300, max: 800 }
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.type, template);
    });
  }

  /**
   * Gera artigo baseado em tickets resolvidos
   */
  async generateArticle(request: ArticleGenerationRequest): Promise<GeneratedArticle> {
    const startTime = Date.now();

    try {
      // 1. Analisa e seleciona tickets relevantes
      const tickets = await this.analyzeAndSelectTickets(request);

      if (tickets.length === 0) {
        throw new Error('Nenhum ticket relevante encontrado para geração de artigo');
      }

      // 2. Seleciona template apropriado
      const template = this.templates.get(request.template_type || 'troubleshooting');
      if (!template) {
        throw new Error(`Template ${request.template_type} não encontrado`);
      }

      // 3. Prepara contexto para IA
      const context = await this.prepareGenerationContext(tickets, request);

      // 4. Gera conteúdo com IA
      const content = await this.generateContent(template, context);

      // 5. Pós-processa e valida
      const processedContent = await this.postProcessContent(content, template);

      // 6. Gera metadados
      const metadata = await this.generateMetadata(processedContent, tickets);

      const generationTime = Date.now() - startTime;

      return {
        title: processedContent.title,
        summary: processedContent.summary,
        content: processedContent.content,
        category_id: request.category_id,
        tags: metadata.tags,
        search_keywords: metadata.search_keywords,
        meta_title: metadata.meta_title,
        meta_description: metadata.meta_description,
        source_tickets: tickets.map(t => t.ticket_id),
        generation_metadata: {
          model_used: 'gpt-4o',
          prompt_version: '1.0',
          generation_time_ms: generationTime,
          confidence_score: this.calculateConfidenceScore(tickets, processedContent),
          tokens_used: content.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      logger.error('Erro na geração de artigo', error);
      throw error;
    }
  }

  /**
   * Analisa e seleciona tickets relevantes
   */
  private async analyzeAndSelectTickets(request: ArticleGenerationRequest): Promise<TicketAnalysis[]> {
    let sql = `
      SELECT
        t.id as ticket_id,
        t.title,
        t.description,
        GROUP_CONCAT(c.content, '\n---\n') as resolution,
        cat.name as category,
        cat.id as category_id,
        ROUND((julianday(t.resolved_at) - julianday(t.created_at)) * 24, 2) as resolution_time_hours,
        ss.rating as satisfaction_rating,
        COUNT(similar.id) as similar_count
      FROM tickets t
      JOIN categories cat ON t.category_id = cat.id
      JOIN statuses s ON t.status_id = s.id AND s.is_final = 1
      LEFT JOIN comments c ON t.id = c.ticket_id AND c.user_id IN (
        SELECT id FROM users WHERE role IN ('admin', 'agent')
      )
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      LEFT JOIN tickets similar ON similar.category_id = t.category_id
        AND similar.resolved_at IS NOT NULL
        AND similar.id != t.id
        AND (
          similar.title LIKE '%' || SUBSTR(t.title, 1, INSTR(t.title, ' ')) || '%'
          OR t.title LIKE '%' || SUBSTR(similar.title, 1, INSTR(similar.title, ' ')) || '%'
        )
      WHERE t.resolved_at IS NOT NULL
    `;

    const params: any[] = [];

    if (request.ticket_ids && request.ticket_ids.length > 0) {
      sql += ` AND t.id IN (${request.ticket_ids.map(() => '?').join(',')})`;
      params.push(...request.ticket_ids);
    }

    if (request.category_id) {
      sql += ` AND t.category_id = ?`;
      params.push(request.category_id);
    }

    if (request.priority_threshold) {
      sql += ` AND t.priority_id >= ?`;
      params.push(request.priority_threshold);
    }

    if (request.min_resolution_time) {
      sql += ` AND (julianday(t.resolved_at) - julianday(t.created_at)) * 24 >= ?`;
      params.push(request.min_resolution_time);
    }

    sql += `
      GROUP BY t.id
      HAVING resolution IS NOT NULL AND LENGTH(resolution) > 100
      ORDER BY similar_count DESC, satisfaction_rating DESC, resolution_time_hours ASC
      LIMIT 10
    `;

    const tickets = db.prepare(sql).all(...params) as any[];

    return tickets.map(ticket => ({
      ...ticket,
      relevance_score: this.calculateRelevanceScore(ticket)
    })).sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Calcula score de relevância do ticket
   */
  private calculateRelevanceScore(ticket: any): number {
    let score = 0;

    // Pontuação por similaridade com outros tickets
    score += Math.min(ticket.similar_count * 10, 50);

    // Pontuação por satisfação do usuário
    if (ticket.satisfaction_rating) {
      score += ticket.satisfaction_rating * 10;
    } else {
      score += 30; // Score neutro se não há avaliação
    }

    // Pontuação por tempo de resolução (inverso - menos tempo = melhor)
    if (ticket.resolution_time_hours <= 2) {
      score += 30;
    } else if (ticket.resolution_time_hours <= 8) {
      score += 20;
    } else if (ticket.resolution_time_hours <= 24) {
      score += 10;
    }

    // Pontuação por qualidade da resolução
    const resolutionLength = ticket.resolution?.length || 0;
    if (resolutionLength > 500) {
      score += 20;
    } else if (resolutionLength > 200) {
      score += 10;
    }

    return score;
  }

  /**
   * Prepara contexto para geração
   */
  private async prepareGenerationContext(tickets: TicketAnalysis[], request: ArticleGenerationRequest): Promise<any> {
    const ticketData = tickets.map(ticket => ({
      id: ticket.ticket_id,
      title: ticket.title,
      description: ticket.description,
      resolution: ticket.resolution,
      category: ticket.category,
      resolution_time: ticket.resolution_time_hours,
      satisfaction: ticket.satisfaction_rating || 'N/A'
    }));

    // Agrupa tickets por problema similar
    const groupedTickets = this.groupSimilarTickets(ticketData);

    const category = tickets[0]?.category || 'Geral';
    const audience = this.getAudienceDescription(request.target_audience || 'user');

    return {
      TICKET_DATA: JSON.stringify(groupedTickets, null, 2),
      CATEGORY: category,
      AUDIENCE: audience,
      LANGUAGE: request.language || 'pt-BR'
    };
  }

  /**
   * Agrupa tickets similares
   */
  private groupSimilarTickets(tickets: any[]): any[] {
    const groups: any[] = [];
    const processed = new Set<number>();

    for (const ticket of tickets) {
      if (processed.has(ticket.id)) continue;

      const group = {
        main_issue: ticket.title,
        description: ticket.description,
        solutions: [ticket.resolution],
        related_tickets: [ticket.id],
        avg_resolution_time: ticket.resolution_time,
        satisfaction_scores: [ticket.satisfaction].filter(s => s !== 'N/A')
      };

      // Encontra tickets similares
      for (const other of tickets) {
        if (other.id !== ticket.id && !processed.has(other.id)) {
          const similarity = this.calculateTicketSimilarity(ticket.title, other.title);
          if (similarity > 0.6) {
            group.solutions.push(other.resolution);
            group.related_tickets.push(other.id);
            if (other.satisfaction !== 'N/A') {
              group.satisfaction_scores.push(other.satisfaction);
            }
            processed.add(other.id);
          }
        }
      }

      processed.add(ticket.id);
      groups.push(group);
    }

    return groups;
  }

  /**
   * Calcula similaridade entre títulos de tickets
   */
  private calculateTicketSimilarity(title1: string, title2: string): number {
    const words1 = new Set(title1.toLowerCase().split(/\s+/));
    const words2 = new Set(title2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Obtém descrição da audiência
   */
  private getAudienceDescription(audience: string): string {
    const descriptions = {
      user: 'usuários finais sem conhecimento técnico avançado',
      agent: 'agentes de suporte com conhecimento técnico intermediário',
      admin: 'administradores de sistema com conhecimento técnico avançado'
    };

    return descriptions[audience as keyof typeof descriptions] || descriptions.user;
  }

  /**
   * Gera conteúdo usando IA
   */
  private async generateContent(template: ContentTemplate, context: any): Promise<any> {
    try {
      // Substitui placeholders no template
      let userPrompt = template.user_prompt_template;
      Object.entries(context).forEach(([key, value]) => {
        userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });

      const response = await openAIClient.chatCompletion(
        [
          { role: 'system', content: template.system_prompt },
          { role: 'user', content: userPrompt }
        ],
        {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 3000
        }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('IA não gerou conteúdo');
      }

      return {
        content,
        usage: response.usage
      };

    } catch (error) {
      logger.error('Erro na geração de conteúdo', error);
      throw error;
    }
  }

  /**
   * Pós-processa o conteúdo gerado
   */
  private async postProcessContent(generatedContent: any, template: ContentTemplate): Promise<{
    title: string;
    summary: string;
    content: string;
  }> {
    const content = generatedContent.content;

    // Extrai título (primeira linha ou entre # #)
    const titleMatch = content.match(/^#\s*(.+)$/m) || content.match(/^(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Artigo Gerado Automaticamente';

    // Extrai resumo (segundo parágrafo ou primeiras 200 chars)
    const lines = content.split('\n').filter((line: string) => line.trim());
    let summary = '';

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].length > 50 && !lines[i].startsWith('#')) {
        summary = lines[i].substring(0, 200);
        break;
      }
    }

    if (!summary) {
      summary = content.substring(0, 200).replace(/[#*]/g, '').trim();
    }

    // Aplica regras de pós-processamento
    let processedContent = content;
    for (const rule of template.post_processing_rules) {
      processedContent = this.applyPostProcessingRule(processedContent, rule);
    }

    // Valida tamanho
    if (processedContent.length < template.target_length.min) {
      logger.warn(`Conteúdo muito curto: ${processedContent.length} chars (mín: ${template.target_length.min})`);
    }

    return {
      title: title.substring(0, 100),
      summary: summary + (summary.length === 200 ? '...' : ''),
      content: processedContent
    };
  }

  /**
   * Aplica regra de pós-processamento
   */
  private applyPostProcessingRule(content: string, rule: string): string {
    switch (rule) {
      case 'Validar formatação Markdown':
        // Garante que listas estão bem formatadas
        return content.replace(/^\d+\.\s/gm, (match, offset) => {
          const lineStart = content.lastIndexOf('\n', offset) + 1;
          return lineStart === offset ? match : '\n' + match;
        });

      case 'Numerar todos os passos sequencialmente':
        // Renumera passos automaticamente
        let stepNumber = 1;
        return content.replace(/^\d+\.\s/gm, () => `${stepNumber++}. `);

      case 'Garantir respostas objetivas':
        // Remove excesso de formalidade
        return content.replace(/Por favor, note que|É importante mencionar que/gi, '');

      case 'Adicionar alertas de segurança quando necessário':
        // Adiciona alertas para operações potencialmente perigosas
        const dangerousPatterns = [
          /deletar|excluir|remover/gi,
          /formatar|resetar/gi,
          /senha|password/gi
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            content = '⚠️ **Atenção**: Este procedimento pode afetar dados importantes. Faça backup antes de prosseguir.\n\n' + content;
            break;
          }
        }
        return content;

      default:
        return content;
    }
  }

  /**
   * Gera metadados do artigo
   */
  private async generateMetadata(content: any, tickets: TicketAnalysis[]): Promise<{
    tags: string[];
    search_keywords: string;
    meta_title: string;
    meta_description: string;
  }> {
    // Extrai tags dos tickets
    const tags = new Set<string>();

    // Tags baseadas na categoria
    if (tickets[0]?.category) {
      tags.add(tickets[0].category.toLowerCase().replace(/\s+/g, '-'));
    }

    // Tags baseadas em palavras-chave no conteúdo
    const keywords = this.extractKeywords(content.title + ' ' + content.content);
    keywords.slice(0, 8).forEach(keyword => tags.add(keyword));

    // Keywords para busca
    const searchKeywords = [
      ...keywords.slice(0, 10),
      tickets[0]?.category || ''
    ].filter(Boolean).join(', ');

    // Meta title (otimizado para SEO)
    const metaTitle = content.title.length <= 60
      ? content.title
      : content.title.substring(0, 57) + '...';

    // Meta description
    const metaDescription = content.summary.length <= 160
      ? content.summary
      : content.summary.substring(0, 157) + '...';

    return {
      tags: Array.from(tags).slice(0, 10),
      search_keywords: searchKeywords,
      meta_title: metaTitle,
      meta_description: metaDescription
    };
  }

  /**
   * Extrai palavras-chave do texto
   */
  private extractKeywords(text: string): string[] {
    // Remove stop words em português
    const stopWords = new Set([
      'a', 'o', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'por',
      'ser', 'ter', 'estar', 'como', 'mais', 'mas', 'quando', 'muito', 'seu',
      'que', 'não', 'se', 'na', 'no', 'os', 'as', 'dos', 'das', 'é', 'são'
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    // Conta frequência
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Retorna palavras mais frequentes
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word);
  }

  /**
   * Calcula score de confiança da geração
   */
  private calculateConfidenceScore(tickets: TicketAnalysis[], content: any): number {
    let score = 0.5; // Base score

    // Pontuação por quantidade de tickets fonte
    score += Math.min(tickets.length * 0.1, 0.3);

    // Pontuação por qualidade dos tickets (baseado em satisfação)
    const avgSatisfaction = tickets
      .filter(t => t.satisfaction_rating)
      .reduce((sum, t) => sum + (t.satisfaction_rating || 0), 0) / tickets.length;

    if (avgSatisfaction >= 4) score += 0.2;
    else if (avgSatisfaction >= 3) score += 0.1;

    // Pontuação por tamanho e qualidade do conteúdo
    const contentLength = content.content.length;
    if (contentLength >= 800) score += 0.1;
    if (contentLength >= 1200) score += 0.1;

    // Penalização se conteúdo muito curto
    if (contentLength < 400) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Salva artigo gerado no banco
   */
  async saveGeneratedArticle(article: GeneratedArticle, authorId: number): Promise<number> {
    try {
      const result = db.prepare(`
        INSERT INTO kb_articles (
          title, summary, content, category_id, author_id,
          status, visibility, search_keywords, meta_title, meta_description,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        article.title,
        article.summary,
        article.content,
        article.category_id,
        authorId,
        'draft', // Sempre começa como draft para revisão
        'internal', // Visibilidade inicial restrita
        article.search_keywords,
        article.meta_title,
        article.meta_description
      );

      const articleId = result.lastInsertRowid as number;

      // Salva tags
      if (article.tags.length > 0) {
        for (const tag of article.tags) {
          // Cria tag se não existe
          db.prepare(`
            INSERT OR IGNORE INTO kb_tags (name, slug) VALUES (?, ?)
          `).run(tag, tag.toLowerCase().replace(/\s+/g, '-'));

          // Vincula tag ao artigo
          const tagResult = db.prepare(`SELECT id FROM kb_tags WHERE name = ?`).get(tag) as any;
          if (tagResult) {
            db.prepare(`
              INSERT INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)
            `).run(articleId, tagResult.id);
          }
        }
      }

      // Registra metadados de geração
      db.prepare(`
        INSERT INTO ai_suggestions (
          entity_type, entity_id, suggestion_type, suggested_content,
          reasoning, source_type, source_references, confidence_score,
          model_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        'kb_article',
        articleId,
        'auto_generated_article',
        JSON.stringify(article.generation_metadata),
        `Artigo gerado automaticamente baseado em ${article.source_tickets.length} tickets resolvidos`,
        'resolved_tickets',
        JSON.stringify(article.source_tickets),
        article.generation_metadata.confidence_score,
        article.generation_metadata.model_used
      );

      // Agenda indexação
      await semanticIndexer.queueIndexing('kb_article', articleId, 'index', 1);

      logger.info(`Artigo gerado salvo: ID ${articleId}`);
      return articleId;

    } catch (error) {
      logger.error('Erro ao salvar artigo gerado', error);
      throw error;
    }
  }

  /**
   * Busca candidatos para geração automática
   */
  async findGenerationCandidates(): Promise<Array<{
    category_id: number;
    category_name: string;
    ticket_count: number;
    avg_satisfaction: number;
    suggested_templates: string[];
  }>> {
    try {
      const candidates = db.prepare(`
        SELECT
          cat.id as category_id,
          cat.name as category_name,
          COUNT(t.id) as ticket_count,
          AVG(COALESCE(ss.rating, 3)) as avg_satisfaction,
          COUNT(DISTINCT t.title) as unique_problems
        FROM categories cat
        JOIN tickets t ON cat.id = t.category_id
        LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
        WHERE t.resolved_at IS NOT NULL
          AND t.resolved_at >= datetime('now', '-30 days')
        GROUP BY cat.id, cat.name
        HAVING ticket_count >= 5 AND unique_problems >= 3
        ORDER BY ticket_count DESC, avg_satisfaction DESC
      `).all() as any[];

      return candidates.map(candidate => ({
        ...candidate,
        suggested_templates: this.suggestTemplates(candidate)
      }));

    } catch (error) {
      logger.error('Erro ao buscar candidatos', error);
      return [];
    }
  }

  /**
   * Sugere templates baseado nas características da categoria
   */
  private suggestTemplates(candidate: any): string[] {
    const templates: string[] = [];

    // Se há muitos tickets, sugere FAQ
    if (candidate.ticket_count >= 10) {
      templates.push('faq');
    }

    // Se satisfação alta, sugere troubleshooting
    if (candidate.avg_satisfaction >= 4) {
      templates.push('troubleshooting');
    }

    // Se muitos problemas únicos, sugere how_to
    if (candidate.unique_problems >= 5) {
      templates.push('how_to');
    }

    // Sempre sugere quick_fix para categorias com volume alto
    if (candidate.ticket_count >= 15) {
      templates.push('quick_fix');
    }

    return templates.length > 0 ? templates : ['troubleshooting'];
  }

  /**
   * Gera múltiplos artigos em lote
   */
  async batchGenerate(authorId: number): Promise<Array<{
    article_id: number;
    category: string;
    template: string;
    confidence: number;
  }>> {
    try {
      const candidates = await this.findGenerationCandidates();
      const results: any[] = [];

      for (const candidate of candidates.slice(0, 5)) { // Limita a 5 por vez
        for (const template of candidate.suggested_templates.slice(0, 2)) { // Max 2 templates por categoria
          try {
            const article = await this.generateArticle({
              category_id: candidate.category_id,
              template_type: template as any,
              min_resolution_time: 0.5, // Mínimo 30 minutos
              target_audience: 'user'
            });

            const articleId = await this.saveGeneratedArticle(article, authorId);

            results.push({
              article_id: articleId,
              category: candidate.category_name,
              template,
              confidence: article.generation_metadata.confidence_score
            });

            // Pausa entre gerações para não sobrecarregar API
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (error) {
            logger.error(`Erro ao gerar artigo para categoria ${candidate.category_name}:`, error);
            continue;
          }
        }
      }

      logger.info(`Geração em lote concluída: ${results.length} artigos criados`);
      return results;

    } catch (error) {
      logger.error('Erro na geração em lote', error);
      throw error;
    }
  }
}

// Instância singleton
export const autoGenerator = new AutoGenerator();