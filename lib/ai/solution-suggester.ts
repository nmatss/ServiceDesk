import { openAIClient } from './openai-client';
import { PromptTemplates, SuggestionContext, ResponseContext, SentimentContext } from './prompt-templates';
import logger from '../monitoring/structured-logger';

export interface SolutionSuggestion {
  primarySolution: {
    title: string;
    steps: string[];
    estimatedTimeMinutes: number;
    difficultyLevel: 'easy' | 'medium' | 'hard';
    successProbability: number;
  };
  alternativeSolutions: Array<{
    title: string;
    steps: string[];
    whenToUse: string;
  }>;
  knowledgeBaseReferences: number[];
  escalationTriggers: string[];
  preventiveMeasures: string[];
  confidenceScore: number;
  requiresSpecialist: boolean;
  processingTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  modelName: string;
}

export interface ResponseSuggestion {
  responseText: string;
  responseType: 'initial_response' | 'follow_up' | 'resolution' | 'escalation';
  toneUsed: 'professional' | 'friendly' | 'technical' | 'formal';
  nextActions: string[];
  escalationNeeded: boolean;
  estimatedResolutionTime: string;
  knowledgeBaseReferences: number[];
  followUpInHours?: number;
  processingTimeMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1.0 to 1.0
  frustrationLevel: 'low' | 'medium' | 'high' | 'critical';
  emotionalUrgency: 'low' | 'medium' | 'high' | 'critical';
  escalationIndicators: string[];
  keyPhrases: string[];
  recommendedResponseTone: 'empathetic' | 'professional' | 'urgent' | 'reassuring';
  priorityAdjustmentNeeded: boolean;
  immediateAttentionRequired: boolean;
  confidenceScore: number;
  processingTimeMs: number;
}

export class SolutionSuggester {
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private static cache = new Map<string, { result: any; timestamp: number }>();

  /**
   * Sugere soluções para um ticket baseado na knowledge base e tickets similares
   */
  static async suggestSolutions(
    ticket: {
      title: string;
      description: string;
      category: string;
      priority: string;
    },
    knowledgeArticles: Array<{
      id: number;
      title: string;
      summary?: string;
      content: string;
    }>,
    similarTickets: Array<{
      id: number;
      title: string;
      description: string;
      resolution?: string;
    }>,
    userContext?: {
      role: string;
      department?: string;
      previousIssues?: string[];
    }
  ): Promise<SolutionSuggestion> {
    const startTime = Date.now();

    try {
      // Create cache key
      const cacheKey = openAIClient.createCacheKey({
        ticket,
        knowledgeArticles: knowledgeArticles.map(kb => kb.id),
        similarTickets: similarTickets.map(t => t.id)
      });

      // Check cache
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.result;
      }

      // Prepare context
      const context: SuggestionContext = {
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        ticketCategory: ticket.category,
        ticketPriority: ticket.priority,
        knowledgeArticles,
        similarTickets,
        userContext
      };

      // Generate prompt
      const template = PromptTemplates.SOLUTION_SUGGESTION;
      const prompt = PromptTemplates.processTemplate(template, context);

      // Call OpenAI
      const completion = await openAIClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: 'gpt-4o-mini',
          temperature: template.temperature,
          maxTokens: template.maxTokens
        }
      );

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (error) {
        logger.error('Failed to parse solution suggestion', responseText);
        throw new Error('Invalid JSON response from AI model');
      }

      // Build result
      const result: SolutionSuggestion = {
        primarySolution: {
          title: parsedResult.primary_solution.title,
          steps: parsedResult.primary_solution.steps,
          estimatedTimeMinutes: parsedResult.primary_solution.estimated_time_minutes,
          difficultyLevel: parsedResult.primary_solution.difficulty_level,
          successProbability: parsedResult.primary_solution.success_probability
        },
        alternativeSolutions: parsedResult.alternative_solutions || [],
        knowledgeBaseReferences: parsedResult.knowledge_base_references || [],
        escalationTriggers: parsedResult.escalation_triggers || [],
        preventiveMeasures: parsedResult.preventive_measures || [],
        confidenceScore: parsedResult.confidence_score,
        requiresSpecialist: parsedResult.requires_specialist || false,
        processingTimeMs: Date.now() - startTime,
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        modelName: 'gpt-4o-mini'
      };

      // Cache result
      this.cache.set(cacheKey, { result, timestamp: Date.now() });

      return result;

    } catch (error) {
      logger.error('Solution suggestion error', error);

      // Fallback to knowledge base search
      const fallbackSolution = this.fallbackSuggestion(ticket, knowledgeArticles, similarTickets);

      return {
        ...fallbackSolution,
        processingTimeMs: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0,
        modelName: 'rule-based-fallback'
      };
    }
  }

  /**
   * Gera respostas sugeridas para tickets
   */
  static async generateResponse(
    ticket: {
      title: string;
      description: string;
      category: string;
      priority: string;
    },
    conversationHistory: Array<{
      user: string;
      message: string;
      timestamp: string;
      isInternal: boolean;
    }>,
    knowledgeBase: Array<{
      title: string;
      content: string;
    }>,
    tone: 'professional' | 'friendly' | 'technical' | 'formal' = 'professional',
    responseType: 'initial_response' | 'follow_up' | 'resolution' | 'escalation' = 'initial_response'
  ): Promise<ResponseSuggestion> {
    const startTime = Date.now();

    try {
      // Prepare context
      const context: ResponseContext = {
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        ticketCategory: ticket.category,
        ticketPriority: ticket.priority,
        conversationHistory,
        knowledgeBase,
        tone,
        responseType
      };

      // Generate prompt
      const template = PromptTemplates.RESPONSE_GENERATION;
      const prompt = PromptTemplates.processTemplate(template, context);

      // Call OpenAI
      const completion = await openAIClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: 'gpt-4o-mini',
          temperature: template.temperature,
          maxTokens: template.maxTokens
        }
      );

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (error) {
        logger.error('Failed to parse response generation', responseText);
        throw new Error('Invalid JSON response from AI model');
      }

      // Build result
      const result: ResponseSuggestion = {
        responseText: parsedResult.response_text,
        responseType: parsedResult.response_type,
        toneUsed: parsedResult.tone_used,
        nextActions: parsedResult.next_actions || [],
        escalationNeeded: parsedResult.escalation_needed || false,
        estimatedResolutionTime: parsedResult.estimated_resolution_time || 'A determinar',
        knowledgeBaseReferences: parsedResult.knowledge_base_references || [],
        followUpInHours: parsedResult.follow_up_in_hours,
        processingTimeMs: Date.now() - startTime,
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0
      };

      return result;

    } catch (error) {
      logger.error('Response generation error', error);

      // Fallback response
      const fallbackResponse = this.fallbackResponse(ticket, responseType, tone);

      return {
        ...fallbackResponse,
        processingTimeMs: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0
      };
    }
  }

  /**
   * Analisa o sentimento de mensagens em tickets
   */
  static async analyzeSentiment(
    text: string,
    conversationHistory?: Array<{
      message: string;
      timestamp: string;
    }>,
    ticketContext?: {
      category: string;
      priority: string;
      daysOpen: number;
      escalationLevel: number;
    }
  ): Promise<SentimentAnalysis> {
    const startTime = Date.now();

    try {
      // Prepare context
      const context: SentimentContext = {
        text,
        conversationHistory,
        ticketContext
      };

      // Generate prompt
      const template = PromptTemplates.SENTIMENT_ANALYSIS;
      const prompt = PromptTemplates.processTemplate(template, context);

      // Call OpenAI
      const completion = await openAIClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: 'gpt-4o-mini',
          temperature: template.temperature,
          maxTokens: template.maxTokens
        }
      );

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (error) {
        logger.error('Failed to parse sentiment analysis', responseText);
        throw new Error('Invalid JSON response from AI model');
      }

      // Build result
      const result: SentimentAnalysis = {
        sentiment: parsedResult.sentiment,
        sentimentScore: parsedResult.sentiment_score,
        frustrationLevel: parsedResult.frustration_level,
        emotionalUrgency: parsedResult.emotional_urgency,
        escalationIndicators: parsedResult.escalation_indicators || [],
        keyPhrases: parsedResult.key_phrases || [],
        recommendedResponseTone: parsedResult.recommended_response_tone,
        priorityAdjustmentNeeded: parsedResult.priority_adjustment_needed || false,
        immediateAttentionRequired: parsedResult.immediate_attention_required || false,
        confidenceScore: parsedResult.confidence_score,
        processingTimeMs: Date.now() - startTime
      };

      return result;

    } catch (error) {
      logger.error('Sentiment analysis error', error);

      // Simple rule-based fallback
      const fallbackAnalysis = this.fallbackSentimentAnalysis(text, ticketContext);

      return {
        ...fallbackAnalysis,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Busca artigos relacionados na knowledge base usando embeddings
   */
  static async findRelatedArticles(
    query: string,
    _maxResults: number = 5
  ): Promise<Array<{ id: number; title: string; relevanceScore: number }>> {
    try {
      // Generate embedding for the query
      await openAIClient.createEmbedding(query);
      // const _queryVector = embedding.data[0]?.embedding;

      // This would ideally use a vector database like Pinecone or a local vector search
      // For now, we'll return a placeholder implementation
      // In production, you'd implement similarity search against stored embeddings

      logger.info('Vector search not yet implemented - using keyword fallback');

      // Fallback to simple keyword search
      // This would be replaced with actual database query in production
      return [];

    } catch (error) {
      logger.error('Related articles search error', error);
      return [];
    }
  }

  /**
   * Fallback suggestion quando AI falha
   */
  private static fallbackSuggestion(
    ticket: {
      title: string;
      description: string;
      category: string;
      priority: string;
    },
    knowledgeArticles: Array<{
      id: number;
      title: string;
      summary?: string;
      content: string;
    }>,
    _similarTickets: Array<{
      id: number;
      title: string;
      description: string;
      resolution?: string;
    }>
  ): Omit<SolutionSuggestion, 'processingTimeMs' | 'inputTokens' | 'outputTokens' | 'modelName'> {
    const title = ticket.title.toLowerCase();
    const description = ticket.description.toLowerCase();

    // Simple keyword-based suggestions
    let primarySolution: {
      title: string;
      steps: string[];
      estimatedTimeMinutes: number;
      difficultyLevel: 'easy' | 'medium' | 'hard';
      successProbability: number;
    } = {
      title: 'Verificação inicial do problema',
      steps: [
        'Confirmar descrição detalhada do problema',
        'Verificar se o problema persiste',
        'Coletar informações adicionais do ambiente',
        'Consultar documentação relevante'
      ],
      estimatedTimeMinutes: 30,
      difficultyLevel: 'medium',
      successProbability: 0.7
    };

    // Customize based on keywords
    if (title.includes('senha') || description.includes('senha')) {
      primarySolution = {
        title: 'Reset de senha',
        steps: [
          'Verificar identidade do usuário',
          'Acessar sistema de gestão de senhas',
          'Gerar nova senha temporária',
          'Enviar credenciais ao usuário',
          'Instruir troca na primeira utilização'
        ],
        estimatedTimeMinutes: 15,
        difficultyLevel: 'easy',
        successProbability: 0.95
      };
    } else if (title.includes('acesso') || description.includes('acesso')) {
      primarySolution = {
        title: 'Verificação de permissões de acesso',
        steps: [
          'Confirmar usuário e sistema solicitado',
          'Verificar políticas de acesso',
          'Validar aprovação necessária',
          'Configurar permissões adequadas',
          'Testar acesso com usuário'
        ],
        estimatedTimeMinutes: 45,
        difficultyLevel: 'medium',
        successProbability: 0.8
      };
    }

    return {
      primarySolution,
      alternativeSolutions: [
        {
          title: 'Escalação para especialista',
          steps: ['Documentar problema detalhadamente', 'Encaminhar para equipe especializada'],
          whenToUse: 'Quando solução inicial não resolver o problema'
        }
      ],
      knowledgeBaseReferences: knowledgeArticles.slice(0, 3).map(kb => kb.id),
      escalationTriggers: ['Problema persiste após 24h', 'Impacto crítico nos negócios'],
      preventiveMeasures: ['Documentar solução para futuros casos similares'],
      confidenceScore: 0.6,
      requiresSpecialist: false
    };
  }

  /**
   * Fallback response quando AI falha
   */
  private static fallbackResponse(
    ticket: {
      title: string;
      description: string;
      category: string;
      priority: string;
    },
    responseType: 'initial_response' | 'follow_up' | 'resolution' | 'escalation',
    tone: 'professional' | 'friendly' | 'technical' | 'formal'
  ): Omit<ResponseSuggestion, 'processingTimeMs' | 'inputTokens' | 'outputTokens'> {
    const templates = {
      initial_response: `Olá! Recebemos seu ticket "${ticket.title}" e nossa equipe está analisando o problema. Entraremos em contato em breve com mais informações sobre a resolução.`,
      follow_up: `Estamos trabalhando na resolução do seu ticket "${ticket.title}". Caso precise de informações adicionais, entraremos em contato.`,
      resolution: `O problema relatado no ticket "${ticket.title}" foi resolvido. Por favor, confirme se está funcionando corretamente.`,
      escalation: `Seu ticket "${ticket.title}" foi escalado para nossa equipe especializada devido à complexidade do problema.`
    };

    return {
      responseText: templates[responseType] || templates.initial_response,
      responseType,
      toneUsed: tone,
      nextActions: ['Aguardar resposta do usuário'],
      escalationNeeded: false,
      estimatedResolutionTime: '24 horas',
      knowledgeBaseReferences: [],
      followUpInHours: 24
    };
  }

  /**
   * Fallback sentiment analysis quando AI falha
   */
  private static fallbackSentimentAnalysis(
    text: string,
    _ticketContext?: {
      category: string;
      priority: string;
      daysOpen: number;
      escalationLevel: number;
    }
  ): Omit<SentimentAnalysis, 'processingTimeMs'> {
    const lowerText = text.toLowerCase();

    // Simple keyword-based sentiment analysis
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    let sentimentScore = 0;
    let frustrationLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Negative indicators
    if (lowerText.includes('urgente') || lowerText.includes('crítico') ||
        lowerText.includes('não funciona') || lowerText.includes('problema grave')) {
      sentiment = 'negative';
      sentimentScore = -0.7;
      frustrationLevel = 'high';
    } else if (lowerText.includes('obrigado') || lowerText.includes('funcionou') ||
               lowerText.includes('resolvido')) {
      sentiment = 'positive';
      sentimentScore = 0.8;
    } else if (lowerText.includes('irritado') || lowerText.includes('insatisfeito')) {
      sentiment = 'negative';
      sentimentScore = -0.5;
      frustrationLevel = 'medium';
    }

    return {
      sentiment,
      sentimentScore,
      frustrationLevel,
      emotionalUrgency: frustrationLevel,
      escalationIndicators: sentiment === 'negative' ? ['Linguagem negativa detectada'] : [],
      keyPhrases: [],
      recommendedResponseTone: sentiment === 'negative' ? 'empathetic' : 'professional',
      priorityAdjustmentNeeded: ['high', 'critical'].includes(frustrationLevel),
      immediateAttentionRequired: ['critical'].includes(frustrationLevel),
      confidenceScore: 0.6
    };
  }

  /**
   * Limpa o cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove entradas antigas do cache
   */
  static cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}

// Auto cleanup cache every 15 minutes
setInterval(() => {
  SolutionSuggester.cleanupCache();
}, 15 * 60 * 1000);

export default SolutionSuggester;