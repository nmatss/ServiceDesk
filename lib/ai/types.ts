// AI-specific types for the ServiceDesk system

export interface AIOperationContext {
  userId: number;
  userRole: string;
  sessionId?: string;
  ipAddress?: string;
  requestId?: string;
  organizationId?: number;
}

export interface AIModelConfig {
  name: string;
  version: string;
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  maxTokens: number;
  temperature: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  rateLimitPerMinute?: number;
  isActive: boolean;
}

export interface AIClassificationRequest {
  ticketTitle: string;
  ticketDescription: string;
  userId?: number;
  includeHistoricalData?: boolean;
  generateEmbedding?: boolean;
  context?: AIOperationContext;
}

export interface AIClassificationResponse {
  classificationId: number;
  categoryId: number;
  categoryName: string;
  priorityId: number;
  priorityName: string;
  confidenceScore: number;
  reasoning: string;
  suggestedActions: string[];
  estimatedResolutionTimeHours: number;
  metadata: AIOperationMetadata;
}

export interface AISuggestionRequest {
  ticketId?: number;
  ticketTitle: string;
  ticketDescription: string;
  category: string;
  priority: string;
  maxKnowledgeArticles?: number;
  maxSimilarTickets?: number;
  includeUserContext?: boolean;
  context?: AIOperationContext;
}

export interface AISuggestionResponse {
  suggestionId: number;
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
  escalationTriggers: string[];
  preventiveMeasures: string[];
  confidenceScore: number;
  requiresSpecialist: boolean;
  sources: {
    knowledgeArticles: Array<{
      id: number;
      title: string;
      relevanceScore: number;
    }>;
    similarTickets: Array<{
      id: number;
      title: string;
      similarityScore: number;
    }>;
  };
  metadata: AIOperationMetadata;
}

export interface AIResponseGenerationRequest {
  ticketId: number;
  responseType: 'initial_response' | 'follow_up' | 'resolution' | 'escalation';
  tone: 'professional' | 'friendly' | 'technical' | 'formal';
  includeKnowledgeBase?: boolean;
  maxKnowledgeArticles?: number;
  customContext?: string;
  context?: AIOperationContext;
}

export interface AIResponseGenerationResponse {
  responseId: number;
  text: string;
  type: string;
  tone: string;
  nextActions: string[];
  escalationNeeded: boolean;
  estimatedResolutionTime: string;
  followUpInHours?: number;
  knowledgeBaseReferences: number[];
  metadata: AIOperationMetadata;
}

export interface AISentimentAnalysisRequest {
  text: string;
  ticketId?: number;
  includeHistory?: boolean;
  autoAdjustPriority?: boolean;
  context?: AIOperationContext;
}

export interface AISentimentAnalysisResponse {
  analysisId: number;
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
  actions: {
    priorityAdjusted?: boolean;
    newPriority?: {
      id: number;
      name: string;
      level: number;
    };
    urgentNotificationSent?: boolean;
  };
  metadata: AIOperationMetadata;
}

export interface AIDuplicateDetectionRequest {
  currentTicket: {
    title: string;
    description: string;
    user: string;
  };
  searchRadius?: number; // days to search back
  similarityThreshold?: number;
  context?: AIOperationContext;
}

export interface AIDuplicateDetectionResponse {
  isDuplicate: boolean;
  duplicateOfTicketId?: number;
  similarityScore: number;
  duplicateType: 'exact' | 'similar' | 'related' | 'none';
  reasoning: string;
  recommendedAction: 'merge' | 'link' | 'separate' | 'escalate';
  confidenceScore: number;
  candidateTickets: Array<{
    id: number;
    title: string;
    similarityScore: number;
    user: string;
    createdAt: string;
  }>;
  metadata: AIOperationMetadata;
}

export interface AIOperationMetadata {
  processingTimeMs: number;
  modelName: string;
  modelVersion?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
  executedAt: string;
}

export interface AITrainingDataEntry {
  id?: number;
  input_text: string;
  expected_output: string;
  actual_output?: string;
  feedback?: string;
  data_type: 'classification' | 'suggestion' | 'sentiment' | 'response' | 'duplicate_detection';
  quality_score: number; // 0.0 to 1.0
  source_entity_type?: string;
  source_entity_id?: number;
  validated: boolean;
  created_by?: number;
  reviewed_by?: number;
  reviewed_at?: string;
  validation_source?: 'user' | 'expert' | 'automated';
  model_version: string;
  organization_id?: number;
  created_at?: string;
}

export interface AIFeedbackEntry {
  id?: number;
  aiOperationType: 'classification' | 'suggestion' | 'response' | 'sentiment';
  aiOperationId: number;
  wasCorrect?: boolean;
  wasHelpful?: boolean;
  correctedValue?: string;
  feedbackComment?: string;
  feedbackBy: number;
  feedbackAt: string;
  improvedConfidence?: number;
}

export interface AIPerformanceMetrics {
  period: string; // 'daily' | 'weekly' | 'monthly'
  periodStart: string;
  periodEnd: string;

  // Classification metrics
  classificationsTotal: number;
  classificationsAccuracy: number;
  classificationAvgConfidence: number;
  classificationAvgProcessingTime: number;

  // Suggestion metrics
  suggestionsTotal: number;
  suggestionsUsageRate: number;
  suggestionsHelpfulnessRate: number;
  suggestionAvgConfidence: number;

  // Response generation metrics
  responsesGenerated: number;
  responsesUsed: number;
  responseAvgLength: number;
  responseUserSatisfaction: number;

  // Sentiment analysis metrics
  sentimentAnalysesTotal: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  urgentCasesDetected: number;
  priorityAdjustments: number;

  // Cost and efficiency
  totalTokensUsed: number;
  estimatedCostUSD: number;
  cacheHitRate: number;
  averageProcessingTime: number;
}

export interface AISystemStatus {
  isOnline: boolean;
  lastHealthCheck: string;
  activeModels: AIModelConfig[];
  rateLimits: {
    current: number;
    limit: number;
    resetAt: string;
  };
  cacheStats: {
    hitRate: number;
    entries: number;
    sizeBytes: number;
  };
  errorRate: number;
  averageResponseTime: number;
}

// Vector database specific types
export interface VectorSearchRequest {
  query: string;
  entityTypes?: string[];
  maxResults?: number;
  similarityThreshold?: number;
  excludeEntityIds?: number[];
  includeMetadata?: boolean;
}

export interface VectorSearchResult {
  entityType: string;
  entityId: number;
  similarityScore: number;
  content?: string;
  metadata?: Record<string, unknown>;
  distance?: number;
}

export interface EmbeddingGenerationJob {
  id?: number;
  entityType: string;
  entityId: number;
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  modelName: string;
  priority: number;
  attempts: number;
  lastAttemptAt?: string;
  completedAt?: string;
  errorMessage?: string;
  processingTimeMs?: number;
}

// Configuration and settings
export interface AIConfiguration {
  enabled: boolean;
  autoClassificationEnabled: boolean;
  autoSuggestionEnabled: boolean;
  autoResponseEnabled: boolean;
  autoSentimentEnabled: boolean;
  autoDuplicateDetectionEnabled: boolean;

  models: {
    primary: AIModelConfig;
    fallback?: AIModelConfig;
    sentiment?: AIModelConfig;
    embedding?: AIModelConfig;
  };

  thresholds: {
    classificationConfidence: number;
    suggestionConfidence: number;
    sentimentUrgency: number;
    duplicateDetection: number;
  };

  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    costLimitPerDay: number;
  };

  caching: {
    enabled: boolean;
    ttlMinutes: number;
    maxEntries: number;
  };

  vectorDatabase: {
    enabled: boolean;
    autoGenerateEmbeddings: boolean;
    batchSize: number;
    updateFrequencyHours: number;
  };

  feedback: {
    collectAutomatically: boolean;
    requireExplicitFeedback: boolean;
    improvementThreshold: number;
  };
}

// Integration types
export interface AIIntegrationEvent {
  eventType: string;
  entityType: string;
  entityId: number;
  triggeredBy: string;
  payload: Record<string, unknown>;
  context: AIOperationContext;
  timestamp: string;
}

export interface AIWorkflowStep {
  stepType: 'classification' | 'suggestion' | 'response' | 'sentiment' | 'duplicate_check';
  config: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  onSuccess?: string;
  onFailure?: string;
  timeout?: number;
  retries?: number;
}

// Error types
export class AIOperationError extends Error {
  constructor(
    message: string,
    public code: string,
    public operationType: string,
    public originalError?: Error,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIOperationError';
  }
}

export class AIRateLimitError extends AIOperationError {
  constructor(
    message: string,
    public resetAt: string,
    public limit: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 'rate_limit');
  }
}

export class AIModelUnavailableError extends AIOperationError {
  constructor(
    message: string,
    public modelName: string,
    public fallbackAvailable: boolean
  ) {
    super(message, 'MODEL_UNAVAILABLE', 'model_access');
  }
}

// Utility types
export type AIOperationType =
  | 'classification'
  | 'suggestion'
  | 'response_generation'
  | 'sentiment_analysis'
  | 'duplicate_detection'
  | 'embedding_generation'
  | 'vector_search';

export type AIFeedbackType =
  | 'accuracy'
  | 'helpfulness'
  | 'relevance'
  | 'quality'
  | 'user_satisfaction';

export type AIModelProvider =
  | 'openai'
  | 'anthropic'
  | 'huggingface'
  | 'local'
  | 'custom';

export type AIProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';