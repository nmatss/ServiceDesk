import { openAIClient } from './openai-client';
import { PromptTemplates, ClassificationContext } from './prompt-templates';
import { Category, Priority, Ticket } from '../types/database';
import { logger } from '../monitoring/logger';

export interface ClassificationResult {
  categoryId: number;
  categoryName: string;
  priorityId: number;
  priorityName: string;
  confidenceScore: number;
  reasoning: string;
  suggestedActions: string[];
  estimatedResolutionTimeHours: number;
  processingTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  modelName: string;
  modelVersion: string;
}

export interface ClassificationHistory {
  ticketId: number;
  suggestedCategoryId: number;
  suggestedPriorityId: number;
  wasAccepted: boolean;
  correctedCategoryId?: number;
  correctedPriorityId?: number;
  feedbackBy?: number;
  feedbackAt?: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOfTicketId?: number;
  similarityScore: number;
  duplicateType: 'exact' | 'similar' | 'related' | 'none';
  reasoning: string;
  recommendedAction: 'merge' | 'link' | 'separate' | 'escalate';
  confidenceScore: number;
}

export interface IntentClassificationResult {
  intent: string;
  confidenceScore: number;
  secondaryIntents: string[];
  complexityLevel: 'simple' | 'moderate' | 'complex';
  requiresApproval: boolean;
}

export class TicketClassifier {
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static cache = new Map<string, { result: any; timestamp: number }>();

  /**
   * Classifica automaticamente um ticket em categoria e prioridade
   */
  static async classifyTicket(
    ticket: { title: string; description: string },
    availableCategories: Category[],
    availablePriorities: Priority[],
    historicalData?: {
      similarTickets?: Array<{ title: string; category: string; priority: string }>;
      userHistory?: Array<{ category: string; priority: string; resolutionTime: number }>;
    }
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      // Create cache key
      const cacheKey = openAIClient.createCacheKey({
        title: ticket.title,
        description: ticket.description,
        categories: availableCategories.map(c => c.id),
        priorities: availablePriorities.map(p => p.id)
      });

      // Check cache
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.result;
      }

      // Prepare context
      const context: ClassificationContext = {
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        availableCategories: availableCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description
        })),
        availablePriorities: availablePriorities.map(pri => ({
          id: pri.id,
          name: pri.name,
          level: pri.level
        })),
        historicalData
      };

      // Generate prompt
      const template = PromptTemplates.TICKET_CLASSIFICATION;
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
        logger.error('Failed to parse classification result', responseText);
        throw new Error('Invalid JSON response from AI model');
      }

      // Validate and build result
      const result: ClassificationResult = {
        categoryId: parsedResult.category_id,
        categoryName: parsedResult.category_name,
        priorityId: parsedResult.priority_id,
        priorityName: parsedResult.priority_name,
        confidenceScore: parsedResult.confidence_score,
        reasoning: parsedResult.reasoning,
        suggestedActions: parsedResult.suggested_actions || [],
        estimatedResolutionTimeHours: parsedResult.estimated_resolution_time_hours || 24,
        processingTimeMs: Date.now() - startTime,
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        modelName: 'gpt-4o-mini',
        modelVersion: '2024-07-18'
      };

      // Validate that suggested category and priority exist
      const categoryExists = availableCategories.some(c => c.id === result.categoryId);
      const priorityExists = availablePriorities.some(p => p.id === result.priorityId);

      if (!categoryExists || !priorityExists) {
        throw new Error('AI suggested non-existent category or priority');
      }

      // Cache result
      this.cache.set(cacheKey, { result, timestamp: Date.now() });

      return result;

    } catch (error) {
      logger.error('Ticket classification error', error);

      // Fallback to rule-based classification
      const fallbackResult = this.fallbackClassification(
        ticket,
        availableCategories,
        availablePriorities
      );

      return {
        ...fallbackResult,
        processingTimeMs: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0,
        modelName: 'rule-based-fallback',
        modelVersion: '1.0'
      };
    }
  }

  /**
   * Detecta tickets duplicados baseado em similaridade
   */
  static async detectDuplicates(
    currentTicket: { title: string; description: string; user: string },
    candidateTickets: Array<{
      id: number;
      title: string;
      description: string;
      user: string;
      status: string;
      created_at: string;
    }>
  ): Promise<DuplicateDetectionResult> {
    try {
      const template = PromptTemplates.DUPLICATE_DETECTION;
      const context = {
        currentTicket,
        candidateTickets
      };

      const prompt = PromptTemplates.processTemplate(template, context);

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

      const parsedResult = JSON.parse(responseText);

      return {
        isDuplicate: parsedResult.is_duplicate,
        duplicateOfTicketId: parsedResult.duplicate_of_ticket_id,
        similarityScore: parsedResult.similarity_score,
        duplicateType: parsedResult.duplicate_type,
        reasoning: parsedResult.reasoning,
        recommendedAction: parsedResult.recommended_action,
        confidenceScore: parsedResult.confidence_score
      };

    } catch (error) {
      logger.error('Duplicate detection error', error);

      // Simple fallback: check for exact title matches with same user
      const exactMatch = candidateTickets.find(
        ticket => ticket.title.toLowerCase() === currentTicket.title.toLowerCase() &&
                 ticket.user === currentTicket.user
      );

      return {
        isDuplicate: !!exactMatch,
        duplicateOfTicketId: exactMatch?.id,
        similarityScore: exactMatch ? 1.0 : 0.0,
        duplicateType: exactMatch ? 'exact' : 'none',
        reasoning: exactMatch ? 'Exact title match with same user' : 'No exact matches found',
        recommendedAction: exactMatch ? 'merge' : 'separate',
        confidenceScore: exactMatch ? 0.9 : 0.1
      };
    }
  }

  /**
   * Classifica a intenção do usuário no ticket
   */
  static async classifyIntent(
    ticket: { title: string; description: string }
  ): Promise<IntentClassificationResult> {
    try {
      const template = PromptTemplates.INTENT_CLASSIFICATION;
      const context = {
        ticketTitle: ticket.title,
        ticketDescription: ticket.description
      };

      const prompt = PromptTemplates.processTemplate(template, context);

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

      const parsedResult = JSON.parse(responseText);

      return {
        intent: parsedResult.intent,
        confidenceScore: parsedResult.confidence_score,
        secondaryIntents: parsedResult.secondary_intents || [],
        complexityLevel: parsedResult.complexity_level,
        requiresApproval: parsedResult.requires_approval
      };

    } catch (error) {
      logger.error('Intent classification error', error);

      // Simple rule-based fallback
      const title = ticket.title.toLowerCase();
      const description = ticket.description.toLowerCase();

      let intent = 'information_request'; // default
      let complexityLevel: 'simple' | 'moderate' | 'complex' = 'simple';

      if (title.includes('bug') || title.includes('erro') || title.includes('problema')) {
        intent = 'bug_report';
        complexityLevel = 'moderate';
      } else if (title.includes('senha') || title.includes('password')) {
        intent = 'password_reset';
      } else if (title.includes('acesso') || title.includes('permissão')) {
        intent = 'access_request';
        complexityLevel = 'moderate';
      } else if (title.includes('como') || title.includes('tutorial')) {
        intent = 'how_to';
      }

      return {
        intent,
        confidenceScore: 0.6, // Lower confidence for rule-based
        secondaryIntents: [],
        complexityLevel,
        requiresApproval: intent === 'access_request'
      };
    }
  }

  /**
   * Classificação de fallback baseada em regras simples
   */
  private static fallbackClassification(
    ticket: { title: string; description: string },
    availableCategories: Category[],
    availablePriorities: Priority[]
  ): Omit<ClassificationResult, 'processingTimeMs' | 'inputTokens' | 'outputTokens' | 'modelName' | 'modelVersion'> {
    const title = ticket.title.toLowerCase();
    const description = ticket.description.toLowerCase();
    const combinedText = `${title} ${description}`;

    // Simple keyword-based classification
    let selectedCategory = availableCategories[0]; // Default to first category
    let selectedPriority = availablePriorities.find(p => p.level === 2) || availablePriorities[0]; // Default to medium priority

    // Category classification based on keywords
    for (const category of availableCategories) {
      const categoryName = category.name.toLowerCase();

      if (categoryName.includes('rede') &&
          (combinedText.includes('internet') || combinedText.includes('wifi') || combinedText.includes('conexão'))) {
        selectedCategory = category;
        break;
      } else if (categoryName.includes('hardware') &&
                (combinedText.includes('computador') || combinedText.includes('impressora') || combinedText.includes('monitor'))) {
        selectedCategory = category;
        break;
      } else if (categoryName.includes('software') &&
                (combinedText.includes('programa') || combinedText.includes('aplicativo') || combinedText.includes('sistema'))) {
        selectedCategory = category;
        break;
      } else if (categoryName.includes('acesso') &&
                (combinedText.includes('senha') || combinedText.includes('login') || combinedText.includes('permissão'))) {
        selectedCategory = category;
        break;
      }
    }

    // Priority classification based on urgency keywords
    if (combinedText.includes('urgente') || combinedText.includes('crítico') || combinedText.includes('parado')) {
      selectedPriority = availablePriorities.find(p => p.level === 4) || selectedPriority;
    } else if (combinedText.includes('importante') || combinedText.includes('impede')) {
      selectedPriority = availablePriorities.find(p => p.level === 3) || selectedPriority;
    } else if (combinedText.includes('dúvida') || combinedText.includes('informação')) {
      selectedPriority = availablePriorities.find(p => p.level === 1) || selectedPriority;
    }

    return {
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      priorityId: selectedPriority.id,
      priorityName: selectedPriority.name,
      confidenceScore: 0.5, // Lower confidence for rule-based
      reasoning: 'Classificação baseada em regras simples (fallback)',
      suggestedActions: ['Verificar classificação manual', 'Confirmar categoria e prioridade'],
      estimatedResolutionTimeHours: 24
    };
  }

  /**
   * Limpa o cache de classificação
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

  /**
   * Estatísticas do cache
   */
  static getCacheStats(): { size: number; hitRate: number } {
    // Simplified stats - in production, you'd track hits/misses
    return {
      size: this.cache.size,
      hitRate: 0.75 // Placeholder
    };
  }
}

// Auto cleanup cache every 10 minutes
setInterval(() => {
  TicketClassifier.cleanupCache();
}, 10 * 60 * 1000);

export default TicketClassifier;