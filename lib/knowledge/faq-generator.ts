// FAQ generator automático por categoria
import { Configuration, OpenAIApi } from 'openai';
import { db } from '../db/connection';
import logger from '../monitoring/structured-logger';

interface FAQEntry {
  question: string;
  answer: string;
  variations: string[];
  category: string;
  frequency: number;
  confidence: number;
  source_tickets: number[];
}

interface FAQCollection {
  category_id: number;
  category_name: string;
  title: string;
  description: string;
  entries: FAQEntry[];
  metadata: {
    total_questions: number;
    avg_confidence: number;
    source_period: string;
    generation_date: string;
    model_used: string;
  };
}

interface CategoryAnalysis {
  category_id: number;
  category_name: string;
  common_issues: Array<{
    pattern: string;
    frequency: number;
    sample_tickets: Array<{
      id: number;
      title: string;
      description: string;
      resolution: string;
    }>;
  }>;
  user_questions: string[];
  seasonal_patterns?: Array<{
    period: string;
    peak_issues: string[];
  }>;
}

export class FAQGenerator {
  private openai: OpenAIApi;

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  /**
   * Gera FAQ completo para uma categoria
   */
  async generateCategoryFAQ(
    categoryId: number,
    options: {
      timeframe?: string;
      min_frequency?: number;
      max_questions?: number;
      include_seasonal?: boolean;
    } = {}
  ): Promise<FAQCollection> {
    const {
      timeframe = '60 days',
      min_frequency = 2,
      max_questions = 15,
      include_seasonal = false
    } = options;

    try {
      logger.info(`Gerando FAQ para categoria ${categoryId}...`);

      // 1. Analisa a categoria
      const analysis = await this.analyzeCategoryIssues(categoryId, timeframe, min_frequency);

      if (analysis.common_issues.length === 0) {
        throw new Error(`Não há dados suficientes para gerar FAQ da categoria ${categoryId}`);
      }

      // 2. Gera perguntas e respostas
      const entries = await this.generateFAQEntries(analysis, max_questions);

      // 3. Cria estrutura final
      const faqCollection: FAQCollection = {
        category_id: analysis.category_id,
        category_name: analysis.category_name,
        title: `FAQ - ${analysis.category_name}`,
        description: this.generateFAQDescription(analysis),
        entries: entries.sort((a, b) => b.frequency - a.frequency),
        metadata: {
          total_questions: entries.length,
          avg_confidence: entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length,
          source_period: timeframe,
          generation_date: new Date().toISOString(),
          model_used: 'gpt-4o'
        }
      };

      logger.info(`FAQ gerado: ${entries.length} perguntas para ${analysis.category_name}`);
      return faqCollection;

    } catch (error) {
      logger.error('Erro ao gerar FAQ', error);
      throw error;
    }
  }

  /**
   * Analisa problemas comuns da categoria
   */
  private async analyzeCategoryIssues(
    categoryId: number,
    timeframe: string,
    minFrequency: number
  ): Promise<CategoryAnalysis> {
    try {
      // Busca categoria
      const category = await db.get(`
        SELECT id, name FROM categories WHERE id = ?
      `, [categoryId]);

      if (!category) {
        throw new Error(`Categoria ${categoryId} não encontrada`);
      }

      // Busca tickets resolvidos da categoria
      const tickets = await db.all(`
        SELECT
          t.id,
          t.title,
          t.description,
          GROUP_CONCAT(c.content, ' | ') as resolution
        FROM tickets t
        LEFT JOIN comments c ON t.id = c.ticket_id AND c.user_id IN (
          SELECT id FROM users WHERE role IN ('admin', 'agent')
        )
        WHERE t.category_id = ?
          AND t.resolved_at IS NOT NULL
          AND t.resolved_at >= datetime('now', '-' || ? || '')
        GROUP BY t.id
        HAVING resolution IS NOT NULL
        ORDER BY t.created_at DESC
      `, [categoryId, timeframe]);

      // Agrupa problemas similares
      const problemGroups = this.groupSimilarProblems(tickets);

      // Filtra por frequência mínima
      const commonIssues = problemGroups
        .filter(group => group.frequency >= minFrequency)
        .sort((a, b) => b.frequency - a.frequency);

      // Extrai perguntas dos usuários (dos tickets)
      const userQuestions = tickets
        .map(t => this.extractQuestionsFromTicket(t.title, t.description))
        .flat()
        .filter(Boolean);

      return {
        category_id: category.id,
        category_name: category.name,
        common_issues: commonIssues,
        user_questions: userQuestions
      };

    } catch (error) {
      logger.error('Erro na análise da categoria', error);
      throw error;
    }
  }

  /**
   * Agrupa problemas similares
   */
  private groupSimilarProblems(tickets: any[]): Array<{
    pattern: string;
    frequency: number;
    sample_tickets: any[];
  }> {
    const groups: Map<string, any[]> = new Map();

    // Agrupa por palavras-chave principais
    for (const ticket of tickets) {
      const keywords = this.extractMainKeywords(ticket.title);
      const pattern = keywords.slice(0, 3).join(' '); // Usa primeiras 3 palavras-chave

      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(ticket);
    }

    // Converte para formato final
    return Array.from(groups.entries())
      .map(([pattern, tickets]) => ({
        pattern,
        frequency: tickets.length,
        sample_tickets: tickets.slice(0, 5) // Máximo 5 exemplos por grupo
      }))
      .filter(group => group.frequency > 1); // Remove grupos únicos
  }

  /**
   * Extrai palavras-chave principais
   */
  private extractMainKeywords(text: string): string[] {
    const stopWords = new Set([
      'o', 'a', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'por',
      'não', 'que', 'se', 'na', 'no', 'os', 'as', 'dos', 'das', 'como', 'mais',
      'ter', 'ser', 'estar', 'fazer', 'ir', 'ver', 'dar', 'vir', 'saber', 'poder'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  }

  /**
   * Extrai perguntas do texto do ticket
   */
  private extractQuestionsFromTicket(title: string, description: string): string[] {
    const text = `${title} ${description}`;
    const questionMarkers = [
      /como\s+[^?]+\?/gi,
      /por\s+que\s+[^?]+\?/gi,
      /o\s+que\s+[^?]+\?/gi,
      /onde\s+[^?]+\?/gi,
      /quando\s+[^?]+\?/gi,
      /qual\s+[^?]+\?/gi,
      /[^.!]*\?/g
    ];

    const questions: string[] = [];

    for (const pattern of questionMarkers) {
      const matches = text.match(pattern);
      if (matches) {
        questions.push(...matches.map(q => q.trim()));
      }
    }

    return questions
      .filter(q => q.length > 10 && q.length < 200)
      .slice(0, 3); // Máximo 3 perguntas por ticket
  }

  /**
   * Gera entradas de FAQ usando IA
   */
  private async generateFAQEntries(
    analysis: CategoryAnalysis,
    maxQuestions: number
  ): Promise<FAQEntry[]> {
    const entries: FAQEntry[] = [];

    for (const issue of analysis.common_issues.slice(0, maxQuestions)) {
      try {
        const entry = await this.generateSingleFAQEntry(issue, analysis.category_name);
        if (entry) {
          entries.push(entry);
        }

        // Pausa entre gerações
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error(`Erro ao gerar FAQ para ${issue.pattern}:`, error);
        continue;
      }
    }

    return entries;
  }

  /**
   * Gera uma entrada individual de FAQ
   */
  private async generateSingleFAQEntry(
    issue: any,
    categoryName: string
  ): Promise<FAQEntry | null> {
    try {
      const ticketExamples = issue.sample_tickets
        .map((t: any) => `Ticket: ${t.title}\nDescrição: ${t.description}\nSolução: ${t.resolution}`)
        .join('\n\n---\n\n');

      const prompt = `
Baseado nestes tickets da categoria "${categoryName}", crie uma entrada de FAQ:

${ticketExamples}

Gere uma resposta no formato JSON:
{
  "question": "Pergunta clara e direta como um usuário faria",
  "answer": "Resposta completa mas concisa, incluindo passos quando necessário",
  "variations": ["Variação 1 da pergunta", "Variação 2 da pergunta"],
  "keywords": ["palavra-chave1", "palavra-chave2"]
}

Diretrizes:
- Pergunta deve ser natural e como usuários realmente perguntam
- Resposta deve ser clara, direta e acionável
- Inclua 2-3 variações da pergunta
- Use linguagem acessível
- Máximo 300 palavras na resposta
`;

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em criar FAQs úteis. Responda sempre em JSON válido, em português.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('IA não gerou conteúdo');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta não está em formato JSON válido');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Valida campos obrigatórios
      if (!parsed.question || !parsed.answer) {
        throw new Error('Campos obrigatórios ausentes');
      }

      return {
        question: parsed.question,
        answer: parsed.answer,
        variations: parsed.variations || [],
        category: categoryName,
        frequency: issue.frequency,
        confidence: this.calculateFAQConfidence(issue, parsed),
        source_tickets: issue.sample_tickets.map((t: any) => t.id)
      };

    } catch (error) {
      logger.error('Erro ao gerar entrada FAQ', error);
      return null;
    }
  }

  /**
   * Calcula confiança da entrada FAQ
   */
  private calculateFAQConfidence(issue: any, parsed: any): number {
    let confidence = 0.5; // Base

    // Mais frequente = mais confiança
    confidence += Math.min(issue.frequency * 0.1, 0.3);

    // Resposta mais longa = mais confiança
    if (parsed.answer.length > 200) confidence += 0.1;
    if (parsed.answer.length > 400) confidence += 0.1;

    // Múltiplas variações = mais confiança
    if (parsed.variations.length >= 2) confidence += 0.1;

    // Qualidade dos tickets fonte
    const avgResolutionLength = issue.sample_tickets
      .reduce((sum: number, t: any) => sum + (t.resolution?.length || 0), 0) / issue.sample_tickets.length;

    if (avgResolutionLength > 300) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Gera descrição do FAQ
   */
  private generateFAQDescription(analysis: CategoryAnalysis): string {
    const totalTickets = analysis.common_issues.reduce((sum, issue) => sum + issue.frequency, 0);

    return `Perguntas frequentes sobre ${analysis.category_name}. ` +
           `Este FAQ foi gerado automaticamente baseado em ${totalTickets} tickets resolvidos, ` +
           `cobrindo os ${analysis.common_issues.length} problemas mais comuns da categoria.`;
  }

  /**
   * Salva FAQ no banco de dados
   */
  async saveFAQ(faq: FAQCollection, authorId: number): Promise<number> {
    try {
      // Cria artigo principal do FAQ
      const result = await db.run(`
        INSERT INTO kb_articles (
          title, summary, content, category_id, author_id,
          status, visibility, search_keywords, meta_title, meta_description,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        faq.title,
        faq.description,
        this.formatFAQContent(faq),
        faq.category_id,
        authorId,
        'draft',
        'public',
        this.generateSearchKeywords(faq),
        faq.title,
        faq.description.substring(0, 160)
      ]);

      const articleId = result.lastInsertRowid as number;

      // Adiciona tag FAQ
      await db.run(`INSERT OR IGNORE INTO kb_tags (name, slug) VALUES ('FAQ', 'faq')`);
      const faqTag = await db.get(`SELECT id FROM kb_tags WHERE slug = 'faq'`);

      if (faqTag) {
        await db.run(`
          INSERT INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)
        `, [articleId, faqTag.id]);
      }

      // Registra metadados de geração
      await db.run(`
        INSERT INTO ai_suggestions (
          entity_type, entity_id, suggestion_type, suggested_content,
          reasoning, source_type, source_references, confidence_score,
          model_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        'kb_article',
        articleId,
        'auto_generated_faq',
        JSON.stringify(faq.metadata),
        `FAQ gerado automaticamente para categoria ${faq.category_name} com ${faq.entries.length} perguntas`,
        'category_tickets',
        JSON.stringify(faq.entries.flatMap(e => e.source_tickets)),
        faq.metadata.avg_confidence,
        faq.metadata.model_used
      ]);

      logger.info(`FAQ salvo: ID ${articleId} para categoria ${faq.category_name}`);
      return articleId;

    } catch (error) {
      logger.error('Erro ao salvar FAQ', error);
      throw error;
    }
  }

  /**
   * Formata conteúdo do FAQ em Markdown
   */
  private formatFAQContent(faq: FAQCollection): string {
    let content = `# ${faq.title}\n\n`;
    content += `${faq.description}\n\n`;
    content += `---\n\n`;

    faq.entries.forEach((entry, index) => {
      content += `## ${index + 1}. ${entry.question}\n\n`;
      content += `${entry.answer}\n\n`;

      if (entry.variations.length > 0) {
        content += `**Outras formas desta pergunta:**\n`;
        entry.variations.forEach(variation => {
          content += `- ${variation}\n`;
        });
        content += `\n`;
      }

      content += `---\n\n`;
    });

    // Adiciona metadados no final
    content += `## Sobre este FAQ\n\n`;
    content += `Este FAQ foi gerado automaticamente baseado em tickets reais da categoria ${faq.category_name}. `;
    content += `Contém ${faq.metadata.total_questions} perguntas com confiança média de ${Math.round(faq.metadata.avg_confidence * 100)}%.\n\n`;
    content += `*Última atualização: ${new Date(faq.metadata.generation_date).toLocaleDateString('pt-BR')}*`;

    return content;
  }

  /**
   * Gera palavras-chave de busca
   */
  private generateSearchKeywords(faq: FAQCollection): string {
    const keywords = new Set<string>();

    // Adiciona nome da categoria
    keywords.add(faq.category_name.toLowerCase());

    // Extrai palavras-chave das perguntas
    faq.entries.forEach(entry => {
      const questionWords = this.extractMainKeywords(entry.question);
      questionWords.forEach(word => keywords.add(word));
    });

    // Adiciona palavras-chave comuns de FAQ
    keywords.add('faq');
    keywords.add('perguntas');
    keywords.add('frequentes');
    keywords.add('duvidas');
    keywords.add('ajuda');

    return Array.from(keywords).slice(0, 20).join(', ');
  }

  /**
   * Gera FAQs para todas as categorias elegíveis
   */
  async generateAllCategoryFAQs(authorId: number): Promise<Array<{
    category_id: number;
    category_name: string;
    article_id: number;
    questions_count: number;
    confidence: number;
  }>> {
    try {
      logger.info('Gerando FAQs para todas as categorias...');

      // Busca categorias elegíveis
      const categories = await db.all(`
        SELECT
          c.id,
          c.name,
          COUNT(t.id) as ticket_count
        FROM categories c
        JOIN tickets t ON c.id = t.category_id
        WHERE t.resolved_at IS NOT NULL
          AND t.resolved_at >= datetime('now', '-60 days')
        GROUP BY c.id, c.name
        HAVING ticket_count >= 5
        ORDER BY ticket_count DESC
      `);

      const results: any[] = [];

      for (const category of categories) {
        try {
          logger.info(`Gerando FAQ para categoria: ${category.name}`);

          const faq = await this.generateCategoryFAQ(category.id, {
            timeframe: '60 days',
            min_frequency: 2,
            max_questions: 12
          });

          if (faq.entries.length > 0) {
            const articleId = await this.saveFAQ(faq, authorId);

            results.push({
              category_id: category.id,
              category_name: category.name,
              article_id: articleId,
              questions_count: faq.entries.length,
              confidence: faq.metadata.avg_confidence
            });
          }

          // Pausa entre categorias
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          logger.error(`Erro ao gerar FAQ para categoria ${category.name}:`, error);
          continue;
        }
      }

      logger.info(`Geração completa: ${results.length} FAQs criados`);
      return results;

    } catch (error) {
      logger.error('Erro na geração de FAQs em lote', error);
      throw error;
    }
  }

  /**
   * Atualiza FAQ existente com novos dados
   */
  async updateExistingFAQ(articleId: number): Promise<void> {
    try {
      // Busca artigo existente
      const article = await db.get(`
        SELECT ka.*, c.name as category_name
        FROM kb_articles ka
        JOIN categories c ON ka.category_id = c.id
        WHERE ka.id = ?
      `, [articleId]);

      if (!article) {
        throw new Error(`Artigo ${articleId} não encontrado`);
      }

      // Gera novo FAQ
      const newFaq = await this.generateCategoryFAQ(article.category_id, {
        timeframe: '30 days', // Período mais recente para atualização
        min_frequency: 1,
        max_questions: 15
      });

      // Atualiza conteúdo
      await db.run(`
        UPDATE kb_articles
        SET content = ?, summary = ?, search_keywords = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [
        this.formatFAQContent(newFaq),
        newFaq.description,
        this.generateSearchKeywords(newFaq),
        articleId
      ]);

      logger.info(`FAQ ${articleId} atualizado com ${newFaq.entries.length} perguntas`);

    } catch (error) {
      logger.error('Erro ao atualizar FAQ', error);
      throw error;
    }
  }

  /**
   * Analisa qualidade de FAQ existente
   */
  async analyzeFAQQuality(articleId: number): Promise<{
    total_questions: number;
    outdated_questions: number;
    missing_topics: string[];
    suggested_updates: string[];
    quality_score: number;
  }> {
    try {
      const article = await db.get(`
        SELECT * FROM kb_articles WHERE id = ?
      `, [articleId]);

      if (!article) {
        throw new Error(`Artigo ${articleId} não encontrado`);
      }

      // Conta perguntas no conteúdo atual
      const currentQuestions = (article.content.match(/##\s+\d+\./g) || []).length;

      // Busca novos problemas na categoria
      const recentAnalysis = await this.analyzeCategoryIssues(
        article.category_id,
        '30 days',
        1
      );

      // Identifica tópicos em falta
      const existingContent = article.content.toLowerCase();
      const missingTopics = recentAnalysis.common_issues
        .filter(issue => !existingContent.includes(issue.pattern.toLowerCase()))
        .map(issue => issue.pattern)
        .slice(0, 5);

      const qualityScore = this.calculateFAQQualityScore(
        currentQuestions,
        missingTopics.length,
        article
      );

      return {
        total_questions: currentQuestions,
        outdated_questions: Math.max(0, currentQuestions - recentAnalysis.common_issues.length),
        missing_topics: missingTopics,
        suggested_updates: this.generateUpdateSuggestions(missingTopics, recentAnalysis),
        quality_score: qualityScore
      };

    } catch (error) {
      logger.error('Erro ao analisar qualidade do FAQ', error);
      throw error;
    }
  }

  /**
   * Calcula score de qualidade do FAQ
   */
  private calculateFAQQualityScore(
    questionCount: number,
    missingTopicsCount: number,
    article: any
  ): number {
    let score = 0.5; // Base

    // Pontuação por quantidade de perguntas
    if (questionCount >= 10) score += 0.2;
    else if (questionCount >= 5) score += 0.1;

    // Penalização por tópicos em falta
    score -= missingTopicsCount * 0.05;

    // Pontuação por atualização recente
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(article.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceUpdate <= 7) score += 0.2;
    else if (daysSinceUpdate <= 30) score += 0.1;
    else if (daysSinceUpdate > 90) score -= 0.2;

    // Pontuação por popularidade
    if (article.view_count > 100) score += 0.1;
    if (article.helpful_votes > article.not_helpful_votes) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Gera sugestões de atualização
   */
  private generateUpdateSuggestions(missingTopics: string[], analysis: CategoryAnalysis): string[] {
    const suggestions: string[] = [];

    if (missingTopics.length > 0) {
      suggestions.push(`Adicionar ${missingTopics.length} novos tópicos: ${missingTopics.slice(0, 3).join(', ')}`);
    }

    if (analysis.common_issues.length > 15) {
      suggestions.push('Considerar dividir FAQ em seções temáticas');
    }

    if (analysis.user_questions.length > 10) {
      suggestions.push('Incluir perguntas extraídas diretamente dos tickets dos usuários');
    }

    suggestions.push('Revisar respostas baseadas em feedback recente');

    return suggestions;
  }
}

// Instância singleton
export const faqGenerator = new FAQGenerator();