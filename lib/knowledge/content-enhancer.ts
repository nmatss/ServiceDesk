// Content enhancer com IA para melhorar qualidade de artigos
import { Configuration, OpenAIApi } from 'openai';
import { db } from '../db/connection';
import { semanticIndexer } from './semantic-indexer';
import logger from '../monitoring/structured-logger';

interface ContentAnalysis {
  readability_score: number;
  complexity_level: 'low' | 'medium' | 'high';
  structure_quality: number;
  completeness_score: number;
  clarity_issues: string[];
  missing_elements: string[];
  suggestions: ContentSuggestion[];
  seo_score: number;
  accessibility_score: number;
}

interface ContentSuggestion {
  type: 'structure' | 'clarity' | 'completeness' | 'seo' | 'accessibility';
  priority: 'low' | 'medium' | 'high';
  description: string;
  suggested_change: string;
  rationale: string;
  implementation_effort: 'easy' | 'moderate' | 'complex';
}

interface EnhancementRequest {
  article_id: number;
  enhancement_type: 'readability' | 'structure' | 'completeness' | 'seo' | 'accessibility' | 'comprehensive';
  target_audience?: 'beginner' | 'intermediate' | 'advanced';
  preserve_tone?: boolean;
  max_length_increase?: number;
  focus_areas?: string[];
}

interface EnhancedContent {
  original_content: string;
  enhanced_content: string;
  summary_changes: string;
  improvements_made: Array<{
    type: string;
    description: string;
    before_snippet: string;
    after_snippet: string;
  }>;
  quality_metrics: {
    readability_improvement: number;
    structure_improvement: number;
    completeness_improvement: number;
    seo_improvement: number;
  };
  confidence_score: number;
}

interface ContentQualityMetrics {
  word_count: number;
  sentence_count: number;
  paragraph_count: number;
  avg_sentence_length: number;
  heading_structure: HeadingAnalysis;
  keyword_density: Record<string, number>;
  readability_indicators: ReadabilityMetrics;
  structural_elements: StructuralElements;
}

interface HeadingAnalysis {
  h1_count: number;
  h2_count: number;
  h3_count: number;
  hierarchy_issues: string[];
  missing_structure: boolean;
}

interface ReadabilityMetrics {
  flesch_reading_ease: number;
  avg_words_per_sentence: number;
  complex_words_percentage: number;
  passive_voice_percentage: number;
  transition_words_count: number;
}

interface StructuralElements {
  has_introduction: boolean;
  has_conclusion: boolean;
  has_step_by_step: boolean;
  has_examples: boolean;
  has_troubleshooting: boolean;
  has_prerequisites: boolean;
  code_blocks_count: number;
  lists_count: number;
  images_count: number;
}

export class ContentEnhancer {
  private openai: OpenAIApi;

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  /**
   * Analisa qualidade do conteúdo
   */
  async analyzeContent(articleId: number): Promise<ContentAnalysis> {
    try {
      const article = await db.get(`
        SELECT ka.*, kc.name as category_name
        FROM kb_articles ka
        LEFT JOIN kb_categories kc ON ka.category_id = kc.id
        WHERE ka.id = ?
      `, [articleId]);

      if (!article) {
        throw new Error(`Artigo ${articleId} não encontrado`);
      }

      // Calcula métricas básicas
      const metrics = this.calculateQualityMetrics(article.content);

      // Analisa com IA
      const aiAnalysis = await this.performAIAnalysis(article);

      // Combina análises
      const analysis: ContentAnalysis = {
        readability_score: this.calculateReadabilityScore(metrics),
        complexity_level: this.determineComplexityLevel(metrics),
        structure_quality: this.calculateStructureQuality(metrics),
        completeness_score: this.calculateCompletenessScore(metrics),
        clarity_issues: aiAnalysis.clarity_issues,
        missing_elements: this.identifyMissingElements(metrics),
        suggestions: await this.generateSuggestions(article, metrics, aiAnalysis),
        seo_score: this.calculateSEOScore(article, metrics),
        accessibility_score: this.calculateAccessibilityScore(metrics)
      };

      return analysis;

    } catch (error) {
      logger.error('Erro ao analisar conteúdo', error);
      throw error;
    }
  }

  /**
   * Calcula métricas de qualidade do conteúdo
   */
  private calculateQualityMetrics(content: string): ContentQualityMetrics {
    // Remove markdown para análise de texto puro
    const plainText = this.stripMarkdown(content);

    const words = plainText.split(/\s+/).filter(word => word.length > 0);
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    return {
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      avg_sentence_length: words.length / sentences.length,
      heading_structure: this.analyzeHeadingStructure(content),
      keyword_density: this.calculateKeywordDensity(words),
      readability_indicators: this.calculateReadabilityIndicators(words, sentences),
      structural_elements: this.analyzeStructuralElements(content)
    };
  }

  /**
   * Remove markdown do texto
   */
  private stripMarkdown(content: string): string {
    return content
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
      .replace(/\n{2,}/g, '\n') // Normalize line breaks
      .trim();
  }

  /**
   * Analisa estrutura de cabeçalhos
   */
  private analyzeHeadingStructure(content: string): HeadingAnalysis {
    const h1Count = (content.match(/^# /gm) || []).length;
    const h2Count = (content.match(/^## /gm) || []).length;
    const h3Count = (content.match(/^### /gm) || []).length;

    const hierarchyIssues: string[] = [];

    if (h1Count > 1) {
      hierarchyIssues.push('Múltiplos H1 encontrados');
    }

    if (h1Count === 0) {
      hierarchyIssues.push('Nenhum H1 encontrado');
    }

    if (h2Count === 0 && content.length > 500) {
      hierarchyIssues.push('Artigo longo sem subdivisões (H2)');
    }

    return {
      h1_count: h1Count,
      h2_count: h2Count,
      h3_count: h3Count,
      hierarchy_issues: hierarchyIssues,
      missing_structure: h1Count === 0 || (h2Count === 0 && content.length > 800)
    };
  }

  /**
   * Calcula densidade de palavras-chave
   */
  private calculateKeywordDensity(words: string[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    const totalWords = words.length;

    words.forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleanWord.length > 3) {
        frequency[cleanWord] = (frequency[cleanWord] || 0) + 1;
      }
    });

    const density: Record<string, number> = {};
    Object.entries(frequency).forEach(([word, count]) => {
      density[word] = (count / totalWords) * 100;
    });

    // Retorna top 10 palavras mais frequentes
    return Object.fromEntries(
      Object.entries(density)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    );
  }

  /**
   * Calcula indicadores de legibilidade
   */
  private calculateReadabilityIndicators(words: string[], sentences: string[]): ReadabilityMetrics {
    const avgWordsPerSentence = words.length / sentences.length;

    // Conta palavras complexas (3+ sílabas)
    const complexWords = words.filter(word => this.countSyllables(word) >= 3);
    const complexWordsPercentage = (complexWords.length / words.length) * 100;

    // Aproximação do Flesch Reading Ease para português
    const fleschScore = 248.835 - (1.015 * avgWordsPerSentence) - (84.6 * (complexWords.length / words.length));

    // Conta voz passiva (aproximação)
    const passiveVoiceCount = sentences.filter(sentence =>
      /\b(foi|foram|é|são|está|estão|sendo)\s+\w+[oa]d[oa]\b/i.test(sentence)
    ).length;
    const passiveVoicePercentage = (passiveVoiceCount / sentences.length) * 100;

    // Conta palavras de transição
    const transitionWords = [
      'portanto', 'assim', 'então', 'além disso', 'por outro lado', 'entretanto',
      'contudo', 'primeiramente', 'finalmente', 'em resumo'
    ];
    const transitionCount = words.filter(word =>
      transitionWords.some(tw => word.toLowerCase().includes(tw))
    ).length;

    return {
      flesch_reading_ease: Math.max(0, Math.min(100, fleschScore)),
      avg_words_per_sentence: avgWordsPerSentence,
      complex_words_percentage: complexWordsPercentage,
      passive_voice_percentage: passiveVoicePercentage,
      transition_words_count: transitionCount
    };
  }

  /**
   * Conta sílabas em uma palavra (aproximação)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    const vowels = 'aeiouáéíóúâêîôûàèùãõy';
    let syllables = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        syllables++;
      }
      previousWasVowel = isVowel;
    }

    return Math.max(1, syllables);
  }

  /**
   * Analisa elementos estruturais
   */
  private analyzeStructuralElements(content: string): StructuralElements {
    const lowerContent = content.toLowerCase();

    return {
      has_introduction: this.hasIntroduction(content),
      has_conclusion: this.hasConclusion(content),
      has_step_by_step: /\d+\.\s|\n-\s|^\s*\*\s/m.test(content),
      has_examples: /exemplo|por exemplo|vamos ver/i.test(content),
      has_troubleshooting: /problema|erro|solução|corrigir|resolver/i.test(content),
      has_prerequisites: /pré-requisito|antes de|necessário|requer/i.test(content),
      code_blocks_count: (content.match(/```[\s\S]*?```/g) || []).length,
      lists_count: (content.match(/^\s*[-*+]\s+/gm) || []).length,
      images_count: (content.match(/!\[.*?\]\(.*?\)/g) || []).length
    };
  }

  /**
   * Verifica se tem introdução
   */
  private hasIntroduction(content: string): boolean {
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.length > 100 && !firstParagraph.startsWith('#');
  }

  /**
   * Verifica se tem conclusão
   */
  private hasConclusion(content: string): boolean {
    const lastParagraphs = content.split('\n\n').slice(-2);
    const lastText = lastParagraphs.join(' ').toLowerCase();

    return /conclusão|resumo|em resumo|para finalizar|concluindo/.test(lastText);
  }

  /**
   * Realiza análise com IA
   */
  private async performAIAnalysis(article: any): Promise<{ clarity_issues: string[] }> {
    try {
      const prompt = `
Analise este artigo da base de conhecimento quanto à clareza e compreensibilidade:

Título: ${article.title}
Categoria: ${article.category_name || 'N/A'}
Conteúdo: ${article.content.substring(0, 2000)}...

Identifique problemas de clareza:
1. Frases confusas ou ambíguas
2. Jargão técnico não explicado
3. Passos mal explicados
4. Falta de contexto
5. Informações desorganizadas

Responda em JSON:
{
  "clarity_issues": [
    "Problema específico identificado",
    "Outro problema encontrado"
  ]
}

Foque em problemas que realmente prejudicam o entendimento.
`;

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é especialista em análise de conteúdo técnico. Identifique problemas de clareza objetivamente.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        return { clarity_issues: [] };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { clarity_issues: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        clarity_issues: parsed.clarity_issues || []
      };

    } catch (error) {
      logger.error('Erro na análise com IA', error);
      return { clarity_issues: [] };
    }
  }

  /**
   * Calcula score de legibilidade
   */
  private calculateReadabilityScore(metrics: ContentQualityMetrics): number {
    const { readability_indicators } = metrics;

    let score = 0.5; // Base

    // Score baseado no Flesch Reading Ease
    if (readability_indicators.flesch_reading_ease >= 70) score += 0.3;
    else if (readability_indicators.flesch_reading_ease >= 50) score += 0.2;
    else if (readability_indicators.flesch_reading_ease < 30) score -= 0.2;

    // Penaliza frases muito longas
    if (readability_indicators.avg_words_per_sentence > 25) score -= 0.1;
    else if (readability_indicators.avg_words_per_sentence < 15) score += 0.1;

    // Penaliza excesso de palavras complexas
    if (readability_indicators.complex_words_percentage > 20) score -= 0.1;

    // Penaliza excesso de voz passiva
    if (readability_indicators.passive_voice_percentage > 25) score -= 0.1;

    // Bonifica palavras de transição
    if (readability_indicators.transition_words_count > 0) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Determina nível de complexidade
   */
  private determineComplexityLevel(metrics: ContentQualityMetrics): 'low' | 'medium' | 'high' {
    const { readability_indicators, structural_elements } = metrics;

    let complexity = 0;

    // Baseado na legibilidade
    if (readability_indicators.flesch_reading_ease < 50) complexity += 1;
    if (readability_indicators.avg_words_per_sentence > 20) complexity += 1;
    if (readability_indicators.complex_words_percentage > 15) complexity += 1;

    // Baseado na estrutura
    if (structural_elements.code_blocks_count > 3) complexity += 1;
    if (!structural_elements.has_examples) complexity += 1;

    if (complexity <= 1) return 'low';
    if (complexity >= 4) return 'high';
    return 'medium';
  }

  /**
   * Calcula qualidade da estrutura
   */
  private calculateStructureQuality(metrics: ContentQualityMetrics): number {
    let score = 0.5; // Base

    const { heading_structure, structural_elements } = metrics;

    // Estrutura de cabeçalhos
    if (heading_structure.h1_count === 1) score += 0.1;
    if (heading_structure.h2_count >= 2) score += 0.1;
    if (heading_structure.hierarchy_issues.length === 0) score += 0.1;

    // Elementos estruturais
    if (structural_elements.has_introduction) score += 0.1;
    if (structural_elements.has_conclusion) score += 0.1;
    if (structural_elements.lists_count > 0) score += 0.1;
    if (structural_elements.has_step_by_step) score += 0.1;

    // Penaliza falta de organização
    if (metrics.paragraph_count < 3 && metrics.word_count > 300) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calcula score de completude
   */
  private calculateCompletenessScore(metrics: ContentQualityMetrics): number {
    let score = 0.5; // Base

    const { structural_elements, word_count } = metrics;

    // Tamanho adequado
    if (word_count >= 300) score += 0.1;
    if (word_count >= 500) score += 0.1;
    if (word_count < 150) score -= 0.2;

    // Elementos essenciais
    if (structural_elements.has_prerequisites) score += 0.1;
    if (structural_elements.has_examples) score += 0.1;
    if (structural_elements.has_troubleshooting) score += 0.1;
    if (structural_elements.has_step_by_step) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Identifica elementos em falta
   */
  private identifyMissingElements(metrics: ContentQualityMetrics): string[] {
    const missing: string[] = [];
    const { structural_elements, heading_structure } = metrics;

    if (heading_structure.h1_count === 0) {
      missing.push('Título principal (H1)');
    }

    if (heading_structure.h2_count === 0 && metrics.word_count > 400) {
      missing.push('Subdivisões (H2)');
    }

    if (!structural_elements.has_introduction) {
      missing.push('Introdução explicativa');
    }

    if (!structural_elements.has_examples && metrics.word_count > 300) {
      missing.push('Exemplos práticos');
    }

    if (!structural_elements.has_step_by_step && metrics.word_count > 400) {
      missing.push('Instruções passo a passo');
    }

    if (!structural_elements.has_troubleshooting) {
      missing.push('Seção de solução de problemas');
    }

    if (!structural_elements.has_conclusion && metrics.word_count > 500) {
      missing.push('Conclusão ou resumo');
    }

    return missing;
  }

  /**
   * Gera sugestões de melhoria
   */
  private async generateSuggestions(
    article: any,
    metrics: ContentQualityMetrics,
    aiAnalysis: any
  ): Promise<ContentSuggestion[]> {
    const suggestions: ContentSuggestion[] = [];

    // Sugestões de estrutura
    if (metrics.heading_structure.missing_structure) {
      suggestions.push({
        type: 'structure',
        priority: 'high',
        description: 'Melhorar estrutura de cabeçalhos',
        suggested_change: 'Adicionar H1 principal e H2 para seções',
        rationale: 'Facilita navegação e compreensão',
        implementation_effort: 'easy'
      });
    }

    // Sugestões de legibilidade
    if (metrics.readability_indicators.avg_words_per_sentence > 25) {
      suggestions.push({
        type: 'clarity',
        priority: 'medium',
        description: 'Reduzir tamanho das frases',
        suggested_change: 'Dividir frases longas em frases menores',
        rationale: 'Melhora compreensão e fluidez da leitura',
        implementation_effort: 'moderate'
      });
    }

    // Sugestões de completude
    const missingElements = this.identifyMissingElements(metrics);
    missingElements.forEach(element => {
      suggestions.push({
        type: 'completeness',
        priority: 'medium',
        description: `Adicionar ${element.toLowerCase()}`,
        suggested_change: `Incluir seção com ${element.toLowerCase()}`,
        rationale: 'Torna o artigo mais completo e útil',
        implementation_effort: 'moderate'
      });
    });

    // Sugestões baseadas na análise de IA
    aiAnalysis.clarity_issues.forEach((issue: string) => {
      suggestions.push({
        type: 'clarity',
        priority: 'high',
        description: 'Resolver problema de clareza',
        suggested_change: `Clarificar: ${issue}`,
        rationale: 'Melhora compreensão do conteúdo',
        implementation_effort: 'moderate'
      });
    });

    // Sugestões de SEO
    if (!article.meta_description || article.meta_description.length < 120) {
      suggestions.push({
        type: 'seo',
        priority: 'medium',
        description: 'Melhorar meta description',
        suggested_change: 'Criar meta description entre 120-160 caracteres',
        rationale: 'Melhora visibilidade em buscadores',
        implementation_effort: 'easy'
      });
    }

    return suggestions.slice(0, 8); // Limita a 8 sugestões
  }

  /**
   * Calcula score de SEO
   */
  private calculateSEOScore(article: any, metrics: ContentQualityMetrics): number {
    let score = 0.5; // Base

    // Título adequado
    if (article.title && article.title.length >= 30 && article.title.length <= 60) {
      score += 0.1;
    }

    // Meta description
    if (article.meta_description && article.meta_description.length >= 120 && article.meta_description.length <= 160) {
      score += 0.1;
    }

    // Palavras-chave no título
    const titleWords = article.title.toLowerCase().split(/\s+/);
    const contentKeywords = Object.keys(metrics.keyword_density);
    const titleKeywordMatch = titleWords.some(word => contentKeywords.includes(word));
    if (titleKeywordMatch) score += 0.1;

    // Estrutura de cabeçalhos
    if (metrics.heading_structure.h1_count === 1 && metrics.heading_structure.h2_count >= 2) {
      score += 0.1;
    }

    // Tamanho adequado do conteúdo
    if (metrics.word_count >= 300) score += 0.1;

    // Links internos (aproximação)
    const internalLinks = (article.content.match(/\[.*?\]\(\/.*?\)/g) || []).length;
    if (internalLinks > 0) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calcula score de acessibilidade
   */
  private calculateAccessibilityScore(metrics: ContentQualityMetrics): number {
    let score = 0.5; // Base

    // Estrutura de cabeçalhos clara
    if (metrics.heading_structure.hierarchy_issues.length === 0) {
      score += 0.2;
    }

    // Presença de listas (facilita leitura)
    if (metrics.structural_elements.lists_count > 0) {
      score += 0.1;
    }

    // Presença de imagens com alt text (aproximação)
    if (metrics.structural_elements.images_count > 0) {
      score += 0.1;
    }

    // Legibilidade adequada
    if (metrics.readability_indicators.flesch_reading_ease >= 60) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Melhora conteúdo automaticamente
   */
  async enhanceContent(request: EnhancementRequest): Promise<EnhancedContent> {
    try {
      const article = await db.get(`
        SELECT * FROM kb_articles WHERE id = ?
      `, [request.article_id]);

      if (!article) {
        throw new Error(`Artigo ${request.article_id} não encontrado`);
      }

      logger.info(`Melhorando conteúdo: ${article.title}`);

      // Analisa conteúdo atual
      const currentAnalysis = await this.analyzeContent(request.article_id);

      // Gera versão melhorada
      const enhanced = await this.generateEnhancedVersion(
        article,
        currentAnalysis,
        request
      );

      // Calcula métricas de melhoria
      const qualityMetrics = await this.calculateImprovementMetrics(
        article.content,
        enhanced.enhanced_content
      );

      return {
        original_content: article.content,
        enhanced_content: enhanced.enhanced_content,
        summary_changes: enhanced.summary_changes,
        improvements_made: enhanced.improvements_made,
        quality_metrics: qualityMetrics,
        confidence_score: enhanced.confidence_score
      };

    } catch (error) {
      logger.error('Erro ao melhorar conteúdo', error);
      throw error;
    }
  }

  /**
   * Gera versão melhorada do conteúdo
   */
  private async generateEnhancedVersion(
    article: any,
    analysis: ContentAnalysis,
    request: EnhancementRequest
  ): Promise<{
    enhanced_content: string;
    summary_changes: string;
    improvements_made: any[];
    confidence_score: number;
  }> {
    try {
      const enhancementFocus = this.determineEnhancementFocus(analysis, request);

      const prompt = `
Melhore este artigo da base de conhecimento:

ARTIGO ORIGINAL:
Título: ${article.title}
Conteúdo: ${article.content}

ANÁLISE DE QUALIDADE:
- Score de legibilidade: ${Math.round(analysis.readability_score * 100)}%
- Complexidade: ${analysis.complexity_level}
- Qualidade estrutural: ${Math.round(analysis.structure_quality * 100)}%
- Problemas identificados: ${analysis.clarity_issues.join(', ')}
- Elementos em falta: ${analysis.missing_elements.join(', ')}

FOCO DO APRIMORAMENTO: ${enhancementFocus.join(', ')}
PÚBLICO-ALVO: ${request.target_audience || 'geral'}

DIRETRIZES:
1. ${request.preserve_tone ? 'Preserve o tom original' : 'Adapte o tom conforme necessário'}
2. Melhore clareza e estrutura
3. Adicione elementos em falta
4. ${request.max_length_increase ? `Limite aumento a ${request.max_length_increase}%` : 'Mantenha tamanho similar'}
5. Use markdown adequadamente

Responda em JSON:
{
  "enhanced_content": "Conteúdo melhorado em markdown",
  "summary_changes": "Resumo das principais mudanças feitas",
  "improvements_made": [
    {
      "type": "structure|clarity|completeness|seo",
      "description": "Descrição da melhoria",
      "before_snippet": "Trecho original (max 100 chars)",
      "after_snippet": "Trecho melhorado (max 100 chars)"
    }
  ]
}
`;

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é especialista em melhoria de conteúdo técnico. Foque em clareza, estrutura e completude.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 4000
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('IA não gerou conteúdo melhorado');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta não está em formato JSON válido');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        enhanced_content: parsed.enhanced_content,
        summary_changes: parsed.summary_changes,
        improvements_made: parsed.improvements_made || [],
        confidence_score: this.calculateEnhancementConfidence(article.content, parsed.enhanced_content)
      };

    } catch (error) {
      logger.error('Erro ao gerar versão melhorada', error);
      throw error;
    }
  }

  /**
   * Determina foco do aprimoramento
   */
  private determineEnhancementFocus(analysis: ContentAnalysis, request: EnhancementRequest): string[] {
    if (request.enhancement_type === 'comprehensive') {
      return ['estrutura', 'clareza', 'completude', 'SEO'];
    }

    const focus: string[] = [];

    switch (request.enhancement_type) {
      case 'readability':
        focus.push('clareza', 'simplificação');
        break;
      case 'structure':
        focus.push('organização', 'hierarquia');
        break;
      case 'completeness':
        focus.push('elementos em falta', 'detalhamento');
        break;
      case 'seo':
        focus.push('otimização para busca', 'palavras-chave');
        break;
      case 'accessibility':
        focus.push('acessibilidade', 'navegação');
        break;
    }

    // Adiciona focos baseados na análise
    if (analysis.readability_score < 0.6) focus.push('legibilidade');
    if (analysis.structure_quality < 0.6) focus.push('estrutura');
    if (analysis.completeness_score < 0.6) focus.push('completude');

    return [...new Set(focus)]; // Remove duplicatas
  }

  /**
   * Calcula confiança do aprimoramento
   */
  private calculateEnhancementConfidence(original: string, enhanced: string): number {
    let confidence = 0.5; // Base

    // Baseado no aumento de tamanho (moderado é bom)
    const lengthIncrease = (enhanced.length - original.length) / original.length;
    if (lengthIncrease >= 0.1 && lengthIncrease <= 0.5) {
      confidence += 0.2;
    } else if (lengthIncrease > 0.5) {
      confidence -= 0.1; // Penaliza aumento excessivo
    }

    // Baseado na estrutura (conta cabeçalhos)
    const originalHeadings = (original.match(/^#{1,6}\s/gm) || []).length;
    const enhancedHeadings = (enhanced.match(/^#{1,6}\s/gm) || []).length;
    if (enhancedHeadings > originalHeadings) confidence += 0.1;

    // Baseado na organização (conta listas)
    const originalLists = (original.match(/^\s*[-*+]\s/gm) || []).length;
    const enhancedLists = (enhanced.match(/^\s*[-*+]\s/gm) || []).length;
    if (enhancedLists > originalLists) confidence += 0.1;

    // Baseado na qualidade do markdown
    const markdownElements = enhanced.match(/\*\*.*?\*\*|`.*?`|###?\s/g) || [];
    if (markdownElements.length > 3) confidence += 0.1;

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Calcula métricas de melhoria
   */
  private async calculateImprovementMetrics(original: string, enhanced: string): Promise<{
    readability_improvement: number;
    structure_improvement: number;
    completeness_improvement: number;
    seo_improvement: number;
  }> {
    // Calcula métricas para ambas as versões
    const originalMetrics = this.calculateQualityMetrics(original);
    const enhancedMetrics = this.calculateQualityMetrics(enhanced);

    return {
      readability_improvement: this.calculateReadabilityScore(enhancedMetrics) - this.calculateReadabilityScore(originalMetrics),
      structure_improvement: this.calculateStructureQuality(enhancedMetrics) - this.calculateStructureQuality(originalMetrics),
      completeness_improvement: this.calculateCompletenessScore(enhancedMetrics) - this.calculateCompletenessScore(originalMetrics),
      seo_improvement: 0.1 // Placeholder - seria preciso comparar SEO scores
    };
  }

  /**
   * Aplica aprimoramento ao artigo
   */
  async applyEnhancement(articleId: number, enhancedContent: EnhancedContent, userId: number): Promise<void> {
    try {
      // Salva versão atual como backup
      await db.run(`
        INSERT INTO ai_suggestions (
          entity_type, entity_id, suggestion_type, suggested_content,
          reasoning, confidence_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        'kb_article',
        articleId,
        'content_enhancement_backup',
        enhancedContent.original_content,
        `Backup antes de aplicar melhorias: ${enhancedContent.summary_changes}`,
        enhancedContent.confidence_score
      ]);

      // Atualiza artigo com conteúdo melhorado
      await db.run(`
        UPDATE kb_articles
        SET content = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [enhancedContent.enhanced_content, articleId]);

      // Registra log de auditoria
      await db.run(`
        INSERT INTO audit_logs (
          entity_type, entity_id, action, new_values, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [
        'kb_article',
        articleId,
        'content_enhanced',
        JSON.stringify({
          summary_changes: enhancedContent.summary_changes,
          improvements_count: enhancedContent.improvements_made.length,
          quality_improvement: enhancedContent.quality_metrics
        }),
        userId
      ]);

      // Agenda reindexação
      await semanticIndexer.queueIndexing('kb_article', articleId, 'update', 1);

      logger.info(`Aprimoramento aplicado ao artigo ${articleId}`);

    } catch (error) {
      logger.error('Erro ao aplicar aprimoramento', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de aprimoramentos
   */
  async getEnhancementStats(timeframe: string = '30 days'): Promise<{
    total_enhancements: number;
    avg_confidence_score: number;
    improvement_types: Record<string, number>;
    avg_quality_improvement: number;
    most_improved_articles: Array<{
      article_id: number;
      title: string;
      improvement_score: number;
    }>;
  }> {
    try {
      const enhancements = await db.all(`
        SELECT
          entity_id,
          confidence_score,
          json_extract(new_values, '$.quality_improvement') as quality_improvement,
          json_extract(new_values, '$.improvements_count') as improvements_count
        FROM audit_logs
        WHERE action = 'content_enhanced'
          AND created_at >= datetime('now', '-' || ? || '')
      `, [timeframe]);

      const totalEnhancements = enhancements.length;
      const avgConfidence = enhancements.reduce((sum, e) => sum + (e.confidence_score || 0), 0) / totalEnhancements;

      // Busca títulos dos artigos mais melhorados
      const mostImproved = await db.all(`
        SELECT
          ka.id,
          ka.title,
          al.confidence_score as improvement_score
        FROM audit_logs al
        JOIN kb_articles ka ON al.entity_id = ka.id
        WHERE al.action = 'content_enhanced'
          AND al.created_at >= datetime('now', '-' || ? || '')
        ORDER BY al.confidence_score DESC
        LIMIT 5
      `, [timeframe]);

      return {
        total_enhancements: totalEnhancements,
        avg_confidence_score: Number(avgConfidence.toFixed(3)),
        improvement_types: { comprehensive: totalEnhancements }, // Simplificado
        avg_quality_improvement: 0.15, // Placeholder
        most_improved_articles: mostImproved.map(a => ({
          article_id: a.id,
          title: a.title,
          improvement_score: a.improvement_score || 0
        }))
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas de aprimoramento', error);
      throw error;
    }
  }
}

// Instância singleton
export const contentEnhancer = new ContentEnhancer();