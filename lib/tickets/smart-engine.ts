/**
 * Smart Ticket Engine - Main AI Integration Engine
 * Orchestrates all AI-powered ticket operations with enterprise-grade features
 */

import logger from '../monitoring/structured-logger';
import type {
  Ticket,
  CreateTicket,
  Category,
  Priority,
  User
} from '../types/database';
// TODO: Import these types when database integration is ready
// import type { CreateAIClassification, CreateAISuggestion } from '../types/database';

export interface SmartTicketAnalysis {
  category: {
    suggested: Category;
    confidence: number;
    reasoning: string;
    alternatives: Array<{ category: Category; confidence: number; }>;
  };
  priority: {
    suggested: Priority;
    confidence: number;
    reasoning: string;
    urgencyIndicators: string[];
  };
  duplicates: {
    found: boolean;
    tickets: Array<{
      ticket: Ticket;
      similarity: number;
      commonTerms: string[];
    }>;
  };
  solutions: {
    suggestions: Array<{
      type: 'knowledge_base' | 'similar_tickets' | 'ai_generated';
      content: string;
      confidence: number;
      source?: string;
    }>;
  };
  escalation: {
    predicted: boolean;
    probability: number;
    reasons: string[];
    suggestedAgent?: User;
  };
  sentiment: {
    score: number; // -1 to 1
    label: 'negative' | 'neutral' | 'positive';
    urgencyFactors: string[];
  };
  estimatedResolutionTime: number; // in hours
  complexity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SmartEngineConfig {
  models: {
    classification: string;
    sentiment: string;
    similarity: string;
    suggestion: string;
  };
  thresholds: {
    categoryConfidence: number;
    priorityConfidence: number;
    duplicateSimilarity: number;
    escalationProbability: number;
  };
  features: {
    autoClassification: boolean;
    duplicateDetection: boolean;
    solutionSuggestion: boolean;
    escalationPrediction: boolean;
    sentimentAnalysis: boolean;
  };
}

// Internal type definitions
interface AIModelResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface SentimentResult {
  score: number;
  label: 'negative' | 'neutral' | 'positive';
  urgencyFactors: string[];
}

interface SolutionSuggestion {
  type: 'knowledge_base' | 'similar_tickets' | 'ai_generated';
  content: string;
  confidence: number;
  source?: string;
}

interface EscalationFeatures {
  complexity: number;
  urgencyKeywords: string[];
  technicalDepth: number;
}

interface ResolutionFactors {
  category: Category;
  priority: Priority;
  complexity: 'low' | 'medium' | 'high' | 'critical';
  sentiment: SentimentResult;
}

interface AnalysisMetrics {
  processingTime: number;
  ticketId?: number;
  features: string[];
}

class SmartTicketEngine {
  private config: SmartEngineConfig;

  constructor(config?: Partial<SmartEngineConfig>) {
    this.config = {
      models: {
        classification: 'gpt-4o',
        sentiment: 'claude-3-sonnet',
        similarity: 'text-embedding-3-small',
        suggestion: 'gpt-4o',
        ...config?.models
      },
      thresholds: {
        categoryConfidence: 0.75,
        priorityConfidence: 0.70,
        duplicateSimilarity: 0.85,
        escalationProbability: 0.60,
        ...config?.thresholds
      },
      features: {
        autoClassification: true,
        duplicateDetection: true,
        solutionSuggestion: true,
        escalationPrediction: true,
        sentimentAnalysis: true,
        ...config?.features
      }
    };
  }

  /**
   * Main analysis function - processes a ticket through all AI systems
   */
  async analyzeTicket(
    ticketData: CreateTicket | { title: string; description: string; },
    context?: {
      userId?: number;
      categories?: Category[];
      priorities?: Priority[];
      agents?: User[];
      historicalTickets?: Ticket[];
    }
  ): Promise<SmartTicketAnalysis> {
    const startTime = Date.now();

    try {
      // Parallel execution of AI analyses for performance
      const [
        categoryAnalysis,
        priorityAnalysis,
        duplicateAnalysis,
        solutionAnalysis,
        escalationAnalysis,
        sentimentAnalysis
      ] = await Promise.all([
        this.analyzeCategory(ticketData, context?.categories),
        this.analyzePriority(ticketData, context?.priorities),
        this.detectDuplicates(ticketData, context?.historicalTickets),
        this.suggestSolutions(ticketData),
        this.predictEscalation(ticketData, context?.agents),
        this.analyzeSentiment(ticketData)
      ]);

      // Calculate estimated resolution time based on all factors
      const estimatedResolutionTime = this.calculateResolutionTime({
        category: categoryAnalysis.suggested,
        priority: priorityAnalysis.suggested,
        complexity: this.determineComplexity(ticketData, sentimentAnalysis),
        sentiment: sentimentAnalysis
      });

      const analysis: SmartTicketAnalysis = {
        category: categoryAnalysis,
        priority: priorityAnalysis,
        duplicates: duplicateAnalysis,
        solutions: solutionAnalysis,
        escalation: escalationAnalysis,
        sentiment: sentimentAnalysis,
        estimatedResolutionTime,
        complexity: this.determineComplexity(ticketData, sentimentAnalysis)
      };

      // Log performance metrics
      this.logAnalysisMetrics({
        processingTime: Date.now() - startTime,
        ticketId: 'id' in ticketData ? (ticketData as { id: number }).id : undefined,
        features: Object.keys(this.config.features).filter(f => this.config.features[f as keyof typeof this.config.features])
      });

      return analysis;

    } catch (error) {
      logger.error('Smart Ticket Engine analysis failed', error);
      throw new Error('Failed to analyze ticket with AI systems');
    }
  }

  /**
   * Auto-categorize ticket with high precision
   */
  private async analyzeCategory(
    ticketData: CreateTicket | { title: string; description: string; },
    availableCategories?: Category[]
  ): Promise<{
    suggested: Category;
    confidence: number;
    reasoning: string;
    alternatives: Array<{ category: Category; confidence: number; }>;
  }> {
    if (!this.config.features.autoClassification) {
      throw new Error('Auto-classification is disabled');
    }

    // Use sophisticated prompt engineering for high accuracy
    const prompt = this.buildCategorizationPrompt(ticketData, availableCategories);

    try {
      const response = await this.callAIModel('classification', prompt);
      const result = this.parseClassificationResponse(response);

      // Find the category object from the ID
      const category = availableCategories?.find(c => c.id === result.category_id) || {
        id: result.category_id,
        name: 'Unknown',
        description: '',
        icon: '',
        color: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const alternatives = result.alternatives.map(alt => ({
        category: availableCategories?.find(c => c.id === alt.category_id) || {
          id: alt.category_id,
          name: 'Unknown',
          description: '',
          icon: '',
          color: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        confidence: alt.confidence
      }));

      return {
        suggested: category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        alternatives
      };
    } catch (error) {
      logger.error('Category analysis failed', error);
      throw error;
    }
  }

  /**
   * Predict ticket priority based on content and context
   */
  private async analyzePriority(
    ticketData: CreateTicket | { title: string; description: string; },
    availablePriorities?: Priority[]
  ): Promise<{
    suggested: Priority;
    confidence: number;
    reasoning: string;
    urgencyIndicators: string[];
  }> {
    const prompt = this.buildPriorityPrompt(ticketData, availablePriorities);

    try {
      const response = await this.callAIModel('classification', prompt);
      const result = this.parsePriorityResponse(response);

      // Find the priority object from the ID
      const priority = availablePriorities?.find(p => p.id === result.priority_id) || {
        id: result.priority_id,
        name: 'Unknown',
        level: 1,
        color: '#gray',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return {
        suggested: priority,
        confidence: result.confidence,
        reasoning: result.reasoning,
        urgencyIndicators: result.urgencyIndicators
      };
    } catch (error) {
      logger.error('Priority analysis failed', error);
      throw error;
    }
  }

  /**
   * Detect duplicate tickets using semantic similarity
   */
  private async detectDuplicates(
    ticketData: CreateTicket | { title: string; description: string; },
    historicalTickets?: Ticket[]
  ) {
    if (!this.config.features.duplicateDetection) {
      return { found: false, tickets: [] };
    }

    try {
      // Generate embedding for current ticket
      const currentEmbedding = await this.generateEmbedding(
        `${ticketData.title} ${ticketData.description}`
      );

      // Compare with historical tickets
      const duplicates = [];

      if (historicalTickets) {
        for (const ticket of historicalTickets) {
          const ticketEmbedding = await this.generateEmbedding(
            `${ticket.title} ${ticket.description}`
          );

          const similarity = this.calculateCosineSimilarity(
            currentEmbedding,
            ticketEmbedding
          );

          if (similarity >= this.config.thresholds.duplicateSimilarity) {
            duplicates.push({
              ticket,
              similarity,
              commonTerms: this.extractCommonTerms(ticketData, ticket)
            });
          }
        }
      }

      return {
        found: duplicates.length > 0,
        tickets: duplicates.sort((a, b) => b.similarity - a.similarity)
      };
    } catch (error) {
      logger.error('Duplicate detection failed', error);
      return { found: false, tickets: [] };
    }
  }

  /**
   * Generate solution suggestions from multiple sources
   */
  private async suggestSolutions(
    ticketData: CreateTicket | { title: string; description: string; }
  ) {
    if (!this.config.features.solutionSuggestion) {
      return { suggestions: [] };
    }

    try {
      const suggestions = [];

      // AI-generated suggestions
      const aiSuggestions = await this.generateAISolutions(ticketData);
      suggestions.push(...aiSuggestions);

      // Knowledge base suggestions
      const kbSuggestions = await this.findKnowledgeBaseSolutions(ticketData);
      suggestions.push(...kbSuggestions);

      // Similar ticket solutions
      const similarSolutions = await this.findSimilarTicketSolutions(ticketData);
      suggestions.push(...similarSolutions);

      return {
        suggestions: suggestions
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5) // Top 5 suggestions
      };
    } catch (error) {
      logger.error('Solution suggestion failed', error);
      return { suggestions: [] };
    }
  }

  /**
   * Predict if ticket will need escalation
   */
  private async predictEscalation(
    ticketData: CreateTicket | { title: string; description: string; },
    availableAgents?: User[]
  ) {
    if (!this.config.features.escalationPrediction) {
      return { predicted: false, probability: 0, reasons: [] };
    }

    try {
      const features = this.extractEscalationFeatures(ticketData);
      const probability = await this.calculateEscalationProbability(features);

      const predicted = probability >= this.config.thresholds.escalationProbability;

      let suggestedAgent;
      if (predicted && availableAgents) {
        suggestedAgent = await this.findBestAgent(ticketData, availableAgents);
      }

      return {
        predicted,
        probability,
        reasons: this.generateEscalationReasons(features),
        suggestedAgent
      };
    } catch (error) {
      logger.error('Escalation prediction failed', error);
      return { predicted: false, probability: 0, reasons: [] };
    }
  }

  /**
   * Analyze sentiment and emotional context
   */
  private async analyzeSentiment(
    ticketData: CreateTicket | { title: string; description: string; }
  ) {
    if (!this.config.features.sentimentAnalysis) {
      return { score: 0, label: 'neutral' as const, urgencyFactors: [] };
    }

    try {
      const text = `${ticketData.title} ${ticketData.description}`;
      const sentiment = await this.callSentimentModel(text);

      return {
        score: sentiment.score,
        label: sentiment.label,
        urgencyFactors: sentiment.urgencyFactors || []
      };
    } catch (error) {
      logger.error('Sentiment analysis failed', error);
      return { score: 0, label: 'neutral' as const, urgencyFactors: [] };
    }
  }

  /**
   * Apply smart analysis results to ticket creation
   */
  async applySmartAnalysis(
    ticketData: CreateTicket,
    analysis: SmartTicketAnalysis,
    options: {
      autoApplyCategory?: boolean;
      autoApplyPriority?: boolean;
      createSuggestions?: boolean;
    } = {}
  ): Promise<CreateTicket> {
    const enhancedTicket = { ...ticketData };

    // Auto-apply category if confidence is high enough
    if (
      options.autoApplyCategory &&
      analysis.category.confidence >= this.config.thresholds.categoryConfidence
    ) {
      enhancedTicket.category_id = analysis.category.suggested.id;
    }

    // Auto-apply priority if confidence is high enough
    if (
      options.autoApplyPriority &&
      analysis.priority.confidence >= this.config.thresholds.priorityConfidence
    ) {
      enhancedTicket.priority_id = analysis.priority.suggested.id;
    }

    return enhancedTicket;
  }

  /**
   * Store analysis results for learning and improvement
   */
  async storeAnalysisResults(
    ticketId: number,
    analysis: SmartTicketAnalysis
  ): Promise<void> {
    try {
      // TODO: Store AI classifications when database integration is ready
      // Store AI classifications
      // const classification: Partial<CreateAIClassification> = {
      //   ticket_id: ticketId,
      //   suggested_category_id: analysis.category.suggested.id,
      //   suggested_priority_id: analysis.priority.suggested.id,
      //   confidence_score: Math.min(
      //     analysis.category.confidence,
      //     analysis.priority.confidence
      //   ),
      //   reasoning: `Category: ${analysis.category.reasoning}. Priority: ${analysis.priority.reasoning}`,
      //   model_name: this.config.models.classification,
      //   model_version: '2024-08-06',
      //   processing_time_ms: 0 // Will be set by database
      // };
      // await aiClassificationQueries.create(classification);

      // Store solution suggestions
      for (const suggestion of analysis.solutions.suggestions) {
        // const aiSuggestion: Partial<CreateAISuggestion> = {
        //   ticket_id: ticketId,
        //   suggestion_type: 'solution',
        //   content: suggestion.content,
        //   suggested_content: suggestion.content,
        //   confidence_score: suggestion.confidence,
        //   model_name: this.config.models.suggestion,
        //   reasoning: `Generated based on ${suggestion.type} analysis`
        // };
        // await aiSuggestionQueries.create(aiSuggestion);
        void suggestion; // Prevent unused variable error
      }

      // Store escalation prediction
      if (analysis.escalation.predicted) {
        // const escalationSuggestion: Partial<CreateAISuggestion> = {
        //   ticket_id: ticketId,
        //   suggestion_type: 'escalation',
        //   content: `Escalation recommended: ${analysis.escalation.reasons.join(', ')}`,
        //   suggested_content: `Escalation recommended: ${analysis.escalation.reasons.join(', ')}`,
        //   confidence_score: analysis.escalation.probability,
        //   model_name: this.config.models.classification,
        //   reasoning: `Escalation probability: ${analysis.escalation.probability}`
        // };
        // await aiSuggestionQueries.create(escalationSuggestion);
      }

      // Prevent unused parameter errors
      void ticketId;
      void analysis;

    } catch (error) {
      logger.error('Failed to store analysis results', error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  // Helper methods

  private buildCategorizationPrompt(
    ticketData: CreateTicket | { title: string; description: string; },
    categories?: Category[]
  ): string {
    const categoriesStr = categories
      ? categories.map(c => `${c.id}: ${c.name} - ${c.description || 'No description'}`).join('\n')
      : 'Available categories not provided';

    return `
Analyze this support ticket and categorize it with high precision:

Title: ${ticketData.title}
Description: ${ticketData.description}

Available Categories:
${categoriesStr}

Provide a JSON response with:
{
  "category_id": number,
  "confidence": number (0-1),
  "reasoning": "detailed explanation",
  "alternatives": [{"category_id": number, "confidence": number}]
}

Focus on precision over recall. Only suggest high-confidence categorizations.
`;
  }

  private buildPriorityPrompt(
    ticketData: CreateTicket | { title: string; description: string; },
    priorities?: Priority[]
  ): string {
    const prioritiesStr = priorities
      ? priorities.map(p => `${p.id}: ${p.name} (Level ${p.level})`).join('\n')
      : 'Available priorities not provided';

    return `
Analyze this support ticket and determine its priority based on urgency and business impact:

Title: ${ticketData.title}
Description: ${ticketData.description}

Available Priorities:
${prioritiesStr}

Consider factors like:
- Customer impact
- System downtime
- Security implications
- Time sensitivity
- Business criticality

Provide a JSON response with:
{
  "priority_id": number,
  "confidence": number (0-1),
  "reasoning": "detailed explanation",
  "urgencyIndicators": ["list", "of", "factors"]
}
`;
  }

  private async callAIModel(_modelType: string, _prompt: string): Promise<AIModelResponse> {
    // Implementation would depend on your AI service provider
    // This is a placeholder for the actual API call
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock response for development
        resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                category_id: 1,
                confidence: 0.89,
                reasoning: "Based on keywords and context analysis",
                alternatives: []
              })
            }
          }]
        });
      }, 100);
    });
  }

  private parseClassificationResponse(response: AIModelResponse): {
    category_id: number;
    confidence: number;
    reasoning: string;
    alternatives: Array<{ category_id: number; confidence: number; }>;
  } {
    try {
      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error('Invalid AI response: missing content');
      }
      const parsed = JSON.parse(content) as {
        category_id: number;
        confidence: number;
        reasoning: string;
        alternatives: Array<{ category_id: number; confidence: number; }>;
      };
      return parsed;
    } catch (error) {
      logger.error('Failed to parse classification response', error);
      throw new Error('Invalid AI response format');
    }
  }

  private parsePriorityResponse(response: AIModelResponse): {
    priority_id: number;
    confidence: number;
    reasoning: string;
    urgencyIndicators: string[];
  } {
    try {
      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error('Invalid AI response: missing content');
      }
      const parsed = JSON.parse(content) as {
        priority_id: number;
        confidence: number;
        reasoning: string;
        urgencyIndicators: string[];
      };
      return parsed;
    } catch (error) {
      logger.error('Failed to parse priority response', error);
      throw new Error('Invalid AI response format');
    }
  }

  private async generateEmbedding(_text: string): Promise<number[]> {
    // Placeholder for embedding generation
    // Would use OpenAI's text-embedding-3-small or similar
    return new Array(1536).fill(0).map(() => Math.random());
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private extractCommonTerms(
    ticket1: { title: string; description: string; },
    ticket2: { title: string; description: string; }
  ): string[] {
    const text1 = `${ticket1.title} ${ticket1.description}`.toLowerCase();
    const text2 = `${ticket2.title} ${ticket2.description}`.toLowerCase();

    const words1 = new Set(text1.match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.match(/\b\w+\b/g) || []);

    return Array.from(words1).filter(word =>
      words2.has(word) && word.length > 3
    );
  }

  private async generateAISolutions(
    _ticketData: { title: string; description: string }
  ): Promise<SolutionSuggestion[]> {
    // Placeholder for AI solution generation
    return [
      {
        type: 'ai_generated',
        content: 'Based on similar issues, try restarting the service...',
        confidence: 0.85
      }
    ];
  }

  private async findKnowledgeBaseSolutions(
    _ticketData: { title: string; description: string }
  ): Promise<SolutionSuggestion[]> {
    // Placeholder for knowledge base search
    return [];
  }

  private async findSimilarTicketSolutions(
    _ticketData: { title: string; description: string }
  ): Promise<SolutionSuggestion[]> {
    // Placeholder for similar ticket analysis
    return [];
  }

  private extractEscalationFeatures(
    ticketData: { title: string; description: string }
  ): EscalationFeatures {
    return {
      complexity: this.estimateComplexity(ticketData),
      urgencyKeywords: this.findUrgencyKeywords(ticketData),
      technicalDepth: this.analyzeTechnicalDepth(ticketData)
    };
  }

  private async calculateEscalationProbability(_features: EscalationFeatures): Promise<number> {
    // Machine learning model would go here
    return Math.random() * 0.4 + 0.3; // Placeholder
  }

  private generateEscalationReasons(features: EscalationFeatures): string[] {
    const reasons: string[] = [];
    if (features.complexity > 0.7) reasons.push('High technical complexity');
    if (features.urgencyKeywords.length > 0) reasons.push('Urgent language detected');
    return reasons;
  }

  private async findBestAgent(
    _ticketData: { title: string; description: string },
    agents: User[]
  ): Promise<User | undefined> {
    // Agent matching algorithm would go here
    return agents.find(agent => agent.role === 'agent');
  }

  private async callSentimentModel(_text: string): Promise<SentimentResult> {
    // Placeholder for sentiment analysis
    const randomScore = Math.random() * 2 - 1;
    return {
      score: randomScore,
      label: randomScore > 0.3 ? 'positive' : randomScore < -0.3 ? 'negative' : 'neutral',
      urgencyFactors: []
    };
  }

  private calculateResolutionTime(factors: ResolutionFactors): number {
    // Basic algorithm - would be more sophisticated in practice
    let baseTime = 4; // 4 hours base

    if (factors.priority.level === 4) baseTime *= 0.5; // Critical
    if (factors.priority.level === 1) baseTime *= 2;   // Low

    if (factors.complexity === 'high') baseTime *= 1.5;
    if (factors.sentiment.score < -0.5) baseTime *= 0.8; // Negative sentiment = faster response

    return Math.round(baseTime);
  }

  private determineComplexity(
    ticketData: { title: string; description: string },
    sentiment: SentimentResult
  ): 'low' | 'medium' | 'high' | 'critical' {
    const textLength = (ticketData.title + ticketData.description).length;
    const technicalTerms = this.countTechnicalTerms(ticketData);

    if (sentiment.score < -0.7 || technicalTerms > 5) return 'critical';
    if (technicalTerms > 3 || textLength > 1000) return 'high';
    if (technicalTerms > 1 || textLength > 500) return 'medium';
    return 'low';
  }

  private estimateComplexity(_ticketData: { title: string; description: string }): number {
    return Math.random(); // Placeholder
  }

  private findUrgencyKeywords(ticketData: { title: string; description: string }): string[] {
    const urgentWords = ['urgent', 'critical', 'emergency', 'asap', 'immediately'];
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    return urgentWords.filter(word => text.includes(word));
  }

  private analyzeTechnicalDepth(ticketData: { title: string; description: string }): number {
    return this.countTechnicalTerms(ticketData) / 10; // Normalize
  }

  private countTechnicalTerms(ticketData: { title: string; description: string }): number {
    const technicalTerms = [
      'server', 'database', 'api', 'error', 'exception', 'timeout',
      'connection', 'authentication', 'ssl', 'firewall', 'network',
      'cpu', 'memory', 'disk', 'performance', 'latency'
    ];

    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    return technicalTerms.filter(term => text.includes(term)).length;
  }

  private logAnalysisMetrics(metrics: AnalysisMetrics): void {
    logger.info('Smart Ticket Analysis Metrics', metrics);
    // Could send to analytics service
  }
}

// Export singleton instance
export const smartTicketEngine = new SmartTicketEngine();

// Export class
export { SmartTicketEngine };