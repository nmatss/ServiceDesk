// AI Core System for ServiceDesk
// Main export file for all AI functionality

// Core AI Services
export { default as openAIClient } from './openai-client';
export { default as TicketClassifier } from './ticket-classifier';
export { default as SolutionSuggester } from './solution-suggester';
export { default as VectorDatabase } from './vector-database';
export { default as AIDatabaseService } from './database-integration';
export { default as AIAuditTrail, createAIAuditTable } from './audit-trail';
import { logger } from '../monitoring/logger';

// Prompt Templates and Context Types
export {
  PromptTemplates,
  type ClassificationContext,
  type SuggestionContext,
  type ResponseContext,
  type SentimentContext
} from './prompt-templates';

// AI Operation Types
export type {
  AIOperationContext,
  AIModelConfig,
  AIClassificationRequest,
  AIClassificationResponse,
  AISuggestionRequest,
  AISuggestionResponse,
  AIResponseGenerationRequest,
  AIResponseGenerationResponse,
  AISentimentAnalysisRequest,
  AISentimentAnalysisResponse,
  AIDuplicateDetectionRequest,
  AIDuplicateDetectionResponse,
  AIOperationMetadata,
  AITrainingDataEntry,
  AIFeedbackEntry,
  AIPerformanceMetrics,
  AISystemStatus,
  VectorSearchRequest,
  VectorSearchResult,
  EmbeddingGenerationJob,
  AIConfiguration,
  AIIntegrationEvent,
  AIWorkflowStep,
  AIOperationType,
  AIFeedbackType,
  AIModelProvider,
  AIProcessingStatus,
  AIOperationError,
  AIRateLimitError,
  AIModelUnavailableError
} from './types';

// Classifier Types
export type {
  ClassificationResult,
  ClassificationHistory,
  DuplicateDetectionResult,
  IntentClassificationResult
} from './ticket-classifier';

// Solution Suggester Types
export type {
  SolutionSuggestion,
  ResponseSuggestion,
  SentimentAnalysis
} from './solution-suggester';

// Vector Database Types
export type {
  SearchResult,
  EmbeddingGenerationResult,
  SimilaritySearchOptions
} from './vector-database';

// Audit Trail Types
export type {
  AIAuditEntry,
  AIAuditQuery,
  AIAuditStats
} from './audit-trail';

// Utility Functions
export const AIUtils = {
  /**
   * Gera ID único para operações de IA
   */
  generateOperationId: (operationType: string, entityId?: number): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${operationType}_${timestamp}_${random}${entityId ? `_${entityId}` : ''}`;
  },

  /**
   * Calcula score de confiança combinado
   */
  calculateCombinedConfidence: (scores: number[]): number => {
    if (scores.length === 0) return 0;
    if (scores.length === 1) return scores[0];

    // Média ponderada com peso maior para scores mais altos
    const sortedScores = scores.sort((a, b) => b - a);
    let weightedSum = 0;
    let totalWeight = 0;

    sortedScores.forEach((score, index) => {
      const weight = 1 / (index + 1); // Peso decrescente
      weightedSum += score * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  },

  /**
   * Determina se uma operação precisa de atenção manual
   */
  requiresManualReview: (
    operationType: string,
    confidenceScore: number,
    metadata?: any
  ): boolean => {
    const thresholds = {
      classification: 0.7,
      suggestion: 0.6,
      response_generation: 0.8,
      sentiment_analysis: 0.75,
      duplicate_detection: 0.85
    };

    const threshold = thresholds[operationType as keyof typeof thresholds] || 0.7;

    if (confidenceScore < threshold) {
      return true;
    }

    // Verificações específicas por tipo
    if (operationType === 'sentiment_analysis' && metadata?.immediateAttentionRequired) {
      return true;
    }

    if (operationType === 'classification' && metadata?.estimatedResolutionTimeHours > 72) {
      return true;
    }

    return false;
  },

  /**
   * Formata resultado de IA para exibição
   */
  formatAIResult: (result: any, operationType: string): string => {
    switch (operationType) {
      case 'classification':
        return `Classificado como "${result.categoryName}" (${result.priorityName}) com ${(result.confidenceScore * 100).toFixed(1)}% de confiança`;

      case 'sentiment_analysis':
        return `Sentimento ${result.sentiment} (${result.frustrationLevel} frustração) - Score: ${result.sentimentScore.toFixed(2)}`;

      case 'suggestion':
        return `${result.primarySolution.title} - ${result.primarySolution.steps.length} passos (${result.primarySolution.estimatedTimeMinutes}min)`;

      default:
        return 'Resultado processado pela IA';
    }
  },

  /**
   * Valida configuração de modelo de IA
   */
  validateModelConfig: (config: any): boolean => {
    const required = ['name', 'provider', 'maxTokens', 'temperature'];
    return required.every(field => config[field] !== undefined);
  },

  /**
   * Calcula custo estimado de operação
   */
  calculateEstimatedCost: (
    inputTokens: number,
    outputTokens: number,
    modelName: string
  ): number => {
    // Preços por 1K tokens (estimativa)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'text-embedding-3-small': { input: 0.00002, output: 0 },
      'text-embedding-3-large': { input: 0.00013, output: 0 }
    };

    const modelPricing = pricing[modelName] || pricing['gpt-4o-mini'];
    return ((inputTokens / 1000) * modelPricing.input) + ((outputTokens / 1000) * modelPricing.output);
  },

  /**
   * Determina prioridade de processamento
   */
  getProcessingPriority: (
    operationType: string,
    urgencyLevel: string = 'normal'
  ): number => {
    const basePriority = {
      sentiment_analysis: 10, // Mais alta prioridade
      classification: 8,
      duplicate_detection: 7,
      suggestion: 5,
      response_generation: 5,
      embedding_generation: 3,
      vector_search: 2
    };

    const urgencyMultiplier = {
      critical: 2,
      high: 1.5,
      normal: 1,
      low: 0.5
    };

    const base = basePriority[operationType as keyof typeof basePriority] || 5;
    const multiplier = urgencyMultiplier[urgencyLevel as keyof typeof urgencyMultiplier] || 1;

    return Math.round(base * multiplier);
  }
};

// Configuration helper
export const AIConfig = {
  /**
   * Configuração padrão do sistema de IA
   */
  getDefaultConfig: (): any => ({
    enabled: true,
    autoClassificationEnabled: true,
    autoSuggestionEnabled: true,
    autoResponseEnabled: false, // Requer aprovação manual
    autoSentimentEnabled: true,
    autoDuplicateDetectionEnabled: true,

    models: {
      primary: {
        name: 'gpt-4o-mini',
        provider: 'openai',
        maxTokens: 1000,
        temperature: 0.1,
        isActive: true
      },
      embedding: {
        name: 'text-embedding-3-small',
        provider: 'openai',
        maxTokens: 8191,
        temperature: 0,
        isActive: true
      }
    },

    thresholds: {
      classificationConfidence: 0.7,
      suggestionConfidence: 0.6,
      sentimentUrgency: 0.8,
      duplicateDetection: 0.85
    },

    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 150000,
      costLimitPerDay: 50.0 // USD
    },

    caching: {
      enabled: true,
      ttlMinutes: 10,
      maxEntries: 1000
    },

    vectorDatabase: {
      enabled: true,
      autoGenerateEmbeddings: true,
      batchSize: 10,
      updateFrequencyHours: 24
    },

    feedback: {
      collectAutomatically: true,
      requireExplicitFeedback: false,
      improvementThreshold: 0.8
    }
  }),

  /**
   * Valida configuração completa
   */
  validateConfig: (config: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.models?.primary) {
      errors.push('Primary model configuration is required');
    }

    if (!config.thresholds) {
      errors.push('Threshold configuration is required');
    }

    if (config.rateLimits?.requestsPerMinute <= 0) {
      errors.push('Rate limit must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Sistema de inicialização
export const AISystem = {
  /**
   * Inicializa o sistema de IA
   */
  async initialize(db: any, config?: any): Promise<boolean> {
    try {
      // Criar tabelas de auditoria se necessário
      await createAIAuditTable(db);

      // Validar configuração
      const validationResult = AIConfig.validateConfig(config || AIConfig.getDefaultConfig());
      if (!validationResult.isValid) {
        logger.error('AI System configuration is invalid', validationResult.errors);
        return false;
      }

      // Verificar conectividade com OpenAI
      try {
        const healthCheck = await openAIClient.chatCompletion([
          { role: 'user', content: 'Hello' }
        ], { maxTokens: 5 });

        if (!healthCheck.choices?.[0]?.message?.content) {
          throw new Error('Invalid response from OpenAI');
        }
      } catch (error) {
        logger.error('Failed to connect to OpenAI', error);
        return false;
      }

      logger.info('AI System initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize AI System', error);
      return false;
    }
  },

  /**
   * Verifica saúde do sistema
   */
  async healthCheck(db: any): Promise<{
    isHealthy: boolean;
    services: Record<string, boolean>;
    errors: string[];
  }> {
    const services: Record<string, boolean> = {};
    const errors: string[] = [];

    // Verificar OpenAI
    try {
      await openAIClient.getRateLimitStatus();
      services.openai = true;
    } catch (error) {
      services.openai = false;
      errors.push(`OpenAI: ${error}`);
    }

    // Verificar banco de dados
    try {
      await db.get('SELECT 1');
      services.database = true;
    } catch (error) {
      services.database = false;
      errors.push(`Database: ${error}`);
    }

    // Verificar tabelas de IA
    try {
      await db.get('SELECT COUNT(*) FROM ai_classifications LIMIT 1');
      services.ai_tables = true;
    } catch (error) {
      services.ai_tables = false;
      errors.push(`AI Tables: ${error}`);
    }

    return {
      isHealthy: Object.values(services).every(status => status),
      services,
      errors
    };
  }
};