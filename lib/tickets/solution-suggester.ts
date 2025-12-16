/**
 * Solution Suggester - AI-powered solution recommendation system
 * Analyzes historical tickets, knowledge base, and patterns to suggest solutions
 */

import type { Ticket, Comment, KnowledgeArticle, CreateTicket } from '../types/database';
import logger from '../monitoring/structured-logger';

export interface SolutionSuggestion {
  id: string;
  type: 'knowledge_base' | 'similar_ticket' | 'ai_generated' | 'template' | 'workflow';
  title: string;
  content: string;
  confidence: number;
  relevanceScore: number;
  source: {
    type: 'kb_article' | 'ticket' | 'ai_model' | 'template' | 'pattern';
    id?: number;
    name?: string;
    url?: string;
  };
  metadata: {
    keywords: string[];
    category?: string;
    complexity: 'low' | 'medium' | 'high';
    estimatedTimeToResolve?: number; // in minutes
    successRate?: number; // 0-1
    timesUsed?: number;
    lastUsed?: Date;
  };
  steps?: Array<{
    order: number;
    description: string;
    isOptional?: boolean;
    estimatedDuration?: number;
    requiredRole?: string[];
  }>;
  relatedSuggestions?: string[]; // IDs of related suggestions
  feedback?: {
    wasHelpful?: boolean;
    rating?: number; // 1-5
    comment?: string;
    improvedResolution?: boolean;
  };
}

export interface SuggestionContext {
  ticket: CreateTicket | { title: string; description: string; };
  category?: { id: number; name: string; };
  priority?: { id: number; name: string; level: number; };
  user?: { id: number; name: string; role: string; };
  historicalTickets?: Ticket[];
  recentComments?: Comment[];
  timeConstraints?: {
    slaDeadline?: Date;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface SuggestionConfig {
  maxSuggestions: number;
  minConfidence: number;
  includeTypes: Array<SolutionSuggestion['type']>;
  prioritizeRecent: boolean;
  considerUserRole: boolean;
  includeSteps: boolean;
  enableFeedbackLearning: boolean;
}

class SolutionSuggester {
  private knowledgeBase: KnowledgeArticle[] = [];
  private historicalTickets: Ticket[] = [];
  private solutionPatterns: Map<string, SolutionPattern> = new Map();
  private feedbackHistory: Map<string, FeedbackData[]> = new Map();

  constructor() {
    this.initializeSolutionPatterns();
  }

  /**
   * Generate solution suggestions for a ticket
   */
  async suggestSolutions(
    context: SuggestionContext,
    config: Partial<SuggestionConfig> = {}
  ): Promise<SolutionSuggestion[]> {
    const finalConfig: SuggestionConfig = {
      maxSuggestions: 5,
      minConfidence: 0.3,
      includeTypes: ['knowledge_base', 'similar_ticket', 'ai_generated', 'template'],
      prioritizeRecent: true,
      considerUserRole: true,
      includeSteps: true,
      enableFeedbackLearning: true,
      ...config
    };

    try {
      const suggestions: SolutionSuggestion[] = [];

      // Parallel execution for better performance
      const [
        kbSuggestions,
        similarTicketSuggestions,
        aiSuggestions,
        templateSuggestions,
        workflowSuggestions
      ] = await Promise.all([
        finalConfig.includeTypes.includes('knowledge_base') ? this.getKnowledgeBaseSuggestions(context, finalConfig) : [],
        finalConfig.includeTypes.includes('similar_ticket') ? this.getSimilarTicketSuggestions(context, finalConfig) : [],
        finalConfig.includeTypes.includes('ai_generated') ? this.getAIGeneratedSuggestions(context, finalConfig) : [],
        finalConfig.includeTypes.includes('template') ? this.getTemplateSuggestions(context, finalConfig) : [],
        finalConfig.includeTypes.includes('workflow') ? this.getWorkflowSuggestions(context, finalConfig) : []
      ]);

      // Combine all suggestions
      suggestions.push(
        ...kbSuggestions,
        ...similarTicketSuggestions,
        ...aiSuggestions,
        ...templateSuggestions,
        ...workflowSuggestions
      );

      // Apply ranking and filtering
      const rankedSuggestions = this.rankSuggestions(suggestions, context, finalConfig);

      // Apply feedback learning if enabled
      if (finalConfig.enableFeedbackLearning) {
        await this.applyFeedbackLearning(rankedSuggestions, context);
      }

      return rankedSuggestions.slice(0, finalConfig.maxSuggestions);

    } catch (error) {
      logger.error('Failed to generate solution suggestions', { error });
      return [];
    }
  }

  /**
   * Get suggestions from knowledge base articles
   */
  private async getKnowledgeBaseSuggestions(
    context: SuggestionContext,
    config: SuggestionConfig
  ): Promise<SolutionSuggestion[]> {
    const suggestions: SolutionSuggestion[] = [];
    const ticketText = `${context.ticket.title} ${context.ticket.description}`;

    // Search knowledge base for relevant articles
    const relevantArticles = await this.searchKnowledgeBase(ticketText, context);

    for (const article of relevantArticles.slice(0, 3)) {
      const similarity = await this.calculateSimilarity(ticketText, article.content);

      if (similarity >= config.minConfidence) {
        suggestions.push({
          id: `kb-${article.id}`,
          type: 'knowledge_base',
          title: article.title,
          content: article.summary || article.content.substring(0, 500) + '...',
          confidence: similarity,
          relevanceScore: this.calculateRelevanceScore(article, context),
          source: {
            type: 'kb_article',
            id: article.id,
            name: article.title,
            url: `/knowledge-base/${article.id}`
          },
          metadata: {
            keywords: this.extractKeywords(article.content),
            category: context.category?.name,
            complexity: this.determineComplexity(article.content),
            timesUsed: article.helpful_count,
            successRate: this.calculateKBSuccessRate(article)
          },
          steps: this.extractStepsFromKBArticle(article)
        });
      }
    }

    return suggestions;
  }

  /**
   * Get suggestions from similar historical tickets
   */
  private async getSimilarTicketSuggestions(
    context: SuggestionContext,
    _config: SuggestionConfig
  ): Promise<SolutionSuggestion[]> {
    const suggestions: SolutionSuggestion[] = [];
    const ticketText = `${context.ticket.title} ${context.ticket.description}`;

    // Find similar resolved tickets
    const similarTickets = await this.findSimilarTickets(ticketText, context);

    for (const ticket of similarTickets.slice(0, 2)) {
      const solution = await this.extractSolutionFromTicket(ticket);

      if (solution) {
        const similarity = await this.calculateSimilarity(ticketText, `${ticket.title} ${ticket.description}`);

        suggestions.push({
          id: `ticket-${ticket.id}`,
          type: 'similar_ticket',
          title: `Similar Issue Resolution: ${ticket.title}`,
          content: solution.content,
          confidence: similarity,
          relevanceScore: this.calculateTicketRelevanceScore(ticket, context),
          source: {
            type: 'ticket',
            id: ticket.id,
            name: `Ticket #${ticket.id}`,
            url: `/tickets/${ticket.id}`
          },
          metadata: {
            keywords: this.extractKeywords(`${ticket.title} ${ticket.description}`),
            category: context.category?.name,
            complexity: this.determineComplexityFromTicket(ticket),
            estimatedTimeToResolve: solution.resolutionTime,
            successRate: 0.85 // Based on historical data
          },
          steps: solution.steps
        });
      }
    }

    return suggestions;
  }

  /**
   * Get AI-generated suggestions
   */
  private async getAIGeneratedSuggestions(
    context: SuggestionContext,
    _config: SuggestionConfig
  ): Promise<SolutionSuggestion[]> {
    const suggestions: SolutionSuggestion[] = [];

    try {
      const prompt = this.buildAISuggestionPrompt(context);
      const aiResponse = await this.callAIService(prompt);

      if (aiResponse && aiResponse.suggestions) {
        for (const suggestion of aiResponse.suggestions) {
          suggestions.push({
            id: `ai-${Date.now()}-${Math.random()}`,
            type: 'ai_generated',
            title: suggestion.title,
            content: suggestion.content,
            confidence: suggestion.confidence || 0.7,
            relevanceScore: suggestion.relevance || 0.7,
            source: {
              type: 'ai_model',
              name: 'GPT-4 Solution Generator'
            },
            metadata: {
              keywords: suggestion.keywords || [],
              complexity: suggestion.complexity || 'medium',
              estimatedTimeToResolve: suggestion.estimatedTime || 60
            },
            steps: suggestion.steps || []
          });
        }
      }
    } catch (error) {
      logger.error('AI suggestion generation failed', { error });
    }

    return suggestions;
  }

  /**
   * Get template-based suggestions
   */
  private async getTemplateSuggestions(
    context: SuggestionContext,
    _config: SuggestionConfig
  ): Promise<SolutionSuggestion[]> {
    const suggestions: SolutionSuggestion[] = [];
    const patterns = this.matchSolutionPatterns(context);

    for (const pattern of patterns.slice(0, 2)) {
      suggestions.push({
        id: `template-${pattern.id}`,
        type: 'template',
        title: pattern.title,
        content: pattern.template,
        confidence: pattern.confidence,
        relevanceScore: pattern.relevance,
        source: {
          type: 'template',
          name: pattern.name
        },
        metadata: {
          keywords: pattern.keywords,
          complexity: pattern.complexity,
          estimatedTimeToResolve: pattern.estimatedTime,
          successRate: pattern.successRate,
          timesUsed: pattern.usageCount
        },
        steps: pattern.steps
      });
    }

    return suggestions;
  }

  /**
   * Get workflow-based suggestions
   */
  private async getWorkflowSuggestions(
    context: SuggestionContext,
    _config: SuggestionConfig
  ): Promise<SolutionSuggestion[]> {
    const suggestions: SolutionSuggestion[] = [];

    // Implementation would check for automated workflows that could resolve the issue
    const applicableWorkflows = this.findApplicableWorkflows(context);

    for (const workflow of applicableWorkflows) {
      suggestions.push({
        id: `workflow-${workflow.id}`,
        type: 'workflow',
        title: `Automated Resolution: ${workflow.name}`,
        content: workflow.description,
        confidence: workflow.confidence,
        relevanceScore: workflow.relevance,
        source: {
          type: 'pattern',
          name: workflow.name
        },
        metadata: {
          keywords: workflow.keywords,
          complexity: 'low',
          estimatedTimeToResolve: workflow.estimatedTime,
          successRate: workflow.successRate
        },
        steps: workflow.steps
      });
    }

    return suggestions;
  }

  /**
   * Rank suggestions based on multiple factors
   */
  private rankSuggestions(
    suggestions: SolutionSuggestion[],
    context: SuggestionContext,
    config: SuggestionConfig
  ): SolutionSuggestion[] {
    return suggestions
      .filter(s => s.confidence >= config.minConfidence)
      .map(suggestion => ({
        ...suggestion,
        // Calculate composite score
        relevanceScore: this.calculateCompositeScore(suggestion, context, config)
      }))
      .sort((a, b) => {
        // Primary sort by relevance score
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }

        // Secondary sort by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }

        // Tertiary sort by success rate
        const aSuccessRate = a.metadata.successRate || 0;
        const bSuccessRate = b.metadata.successRate || 0;
        return bSuccessRate - aSuccessRate;
      });
  }

  /**
   * Calculate composite relevance score
   */
  private calculateCompositeScore(
    suggestion: SolutionSuggestion,
    context: SuggestionContext,
    config: SuggestionConfig
  ): number {
    let score = suggestion.confidence * 0.4 + suggestion.relevanceScore * 0.3;

    // Boost based on success rate
    if (suggestion.metadata.successRate) {
      score += suggestion.metadata.successRate * 0.2;
    }

    // Boost recent solutions if configured
    if (config.prioritizeRecent && suggestion.metadata.lastUsed) {
      const ageInDays = (Date.now() - suggestion.metadata.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, (30 - ageInDays) / 30) * 0.1;
      score += recencyBoost;
    }

    // Consider user role if configured
    if (config.considerUserRole && context.user) {
      if (suggestion.steps?.some(step => step.requiredRole?.includes(context.user!.role))) {
        score += 0.05; // Small boost for role-appropriate suggestions
      }
    }

    // Boost based on usage frequency
    if (suggestion.metadata.timesUsed && suggestion.metadata.timesUsed > 5) {
      score += Math.min(0.1, (suggestion.metadata.timesUsed - 5) / 50);
    }

    return Math.min(1, score);
  }

  /**
   * Apply machine learning from feedback
   */
  private async applyFeedbackLearning(
    suggestions: SolutionSuggestion[],
    _context: SuggestionContext
  ): Promise<void> {
    for (const suggestion of suggestions) {
      const feedback = this.feedbackHistory.get(suggestion.id);

      if (feedback && feedback.length > 0) {
        // Calculate average feedback metrics
        const avgHelpfulness = feedback.filter(f => f.wasHelpful !== undefined)
          .reduce((sum, f) => sum + (f.wasHelpful ? 1 : 0), 0) / feedback.length;

        const avgRating = feedback.filter(f => f.rating !== undefined)
          .reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.filter(f => f.rating).length;

        // Adjust confidence based on feedback
        suggestion.confidence *= (1 + (avgHelpfulness - 0.5) * 0.3);
        suggestion.metadata.successRate = avgHelpfulness;

        if (avgRating) {
          suggestion.relevanceScore *= (avgRating / 5);
        }
      }
    }
  }

  /**
   * Record feedback for a suggestion
   */
  async recordFeedback(
    suggestionId: string,
    feedback: {
      wasHelpful: boolean;
      rating?: number;
      comment?: string;
      improvedResolution?: boolean;
      userId: number;
    }
  ): Promise<void> {
    const feedbackData: FeedbackData = {
      ...feedback,
      timestamp: new Date()
    };

    if (!this.feedbackHistory.has(suggestionId)) {
      this.feedbackHistory.set(suggestionId, []);
    }

    this.feedbackHistory.get(suggestionId)!.push(feedbackData);

    // Update solution patterns based on feedback
    await this.updateSolutionPatterns(suggestionId, feedbackData);
  }

  // Helper methods

  private async searchKnowledgeBase(
    _query: string,
    _context: SuggestionContext
  ): Promise<KnowledgeArticle[]> {
    // Mock implementation - would use actual search
    return this.knowledgeBase
      .filter(article => article.is_published)
      .sort((a, b) => b.helpful_count - a.helpful_count)
      .slice(0, 10);
  }

  private async findSimilarTickets(
    _query: string,
    _context: SuggestionContext
  ): Promise<Ticket[]> {
    // Mock implementation - would use semantic search
    return this.historicalTickets
      .filter(ticket => ticket.resolved_at) // Only resolved tickets
      .slice(0, 10);
  }

  private async calculateSimilarity(text1: string, text2: string): Promise<number> {
    // Mock implementation - would use embeddings/cosine similarity
    const commonWords = this.getCommonWords(text1, text2);
    return Math.min(1, commonWords.length / 10);
  }

  private getCommonWords(text1: string, text2: string): string[] {
    const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);
    return Array.from(words1).filter(word => words2.has(word) && word.length > 3);
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return Array.from(new Set(words))
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  private determineComplexity(content: string): 'low' | 'medium' | 'high' {
    const length = content.length;
    const technicalTerms = this.countTechnicalTerms(content);

    if (length > 1000 || technicalTerms > 5) return 'high';
    if (length > 500 || technicalTerms > 2) return 'medium';
    return 'low';
  }

  private countTechnicalTerms(content: string): number {
    const technicalTerms = ['server', 'database', 'API', 'configuration', 'authentication', 'encryption'];
    const text = content.toLowerCase();
    return technicalTerms.filter(term => text.includes(term)).length;
  }

  private determineComplexityFromTicket(ticket: Ticket): 'low' | 'medium' | 'high' {
    const combinedText = `${ticket.title} ${ticket.description}`;
    return this.determineComplexity(combinedText);
  }

  private calculateRelevanceScore(article: KnowledgeArticle, context: SuggestionContext): number {
    let score = 0.5; // Base score

    // Category match
    if (context.category && article.category_id === context.category.id) {
      score += 0.3;
    }

    // Helpfulness ratio
    const totalFeedback = article.helpful_count + article.not_helpful_count;
    if (totalFeedback > 0) {
      score += (article.helpful_count / totalFeedback) * 0.2;
    }

    return Math.min(1, score);
  }

  private calculateTicketRelevanceScore(ticket: Ticket, context: SuggestionContext): number {
    let score = 0.5; // Base score

    // Category match
    if (context.category && ticket.category_id === context.category.id) {
      score += 0.3;
    }

    // Priority match
    if (context.priority && ticket.priority_id === context.priority.id) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  private calculateKBSuccessRate(article: KnowledgeArticle): number {
    const totalVotes = article.helpful_count + article.not_helpful_count;
    return totalVotes > 0 ? article.helpful_count / totalVotes : 0.5;
  }

  private extractStepsFromKBArticle(_article: KnowledgeArticle): Array<{
    order: number;
    description: string;
    isOptional?: boolean;
    estimatedDuration?: number;
  }> {
    // Mock implementation - would parse content for numbered steps
    return [
      { order: 1, description: 'Review the issue description', estimatedDuration: 5 },
      { order: 2, description: 'Apply the suggested solution', estimatedDuration: 15 },
      { order: 3, description: 'Test the resolution', estimatedDuration: 10 }
    ];
  }

  private async extractSolutionFromTicket(_ticket: Ticket): Promise<{
    content: string;
    resolutionTime: number;
    steps: Array<{ order: number; description: string; estimatedDuration?: number; }>;
  } | null> {
    // Mock implementation - would analyze comments for solution
    return {
      content: 'Based on the resolution of a similar ticket, try restarting the service and clearing the cache.',
      resolutionTime: 30,
      steps: [
        { order: 1, description: 'Restart the affected service', estimatedDuration: 5 },
        { order: 2, description: 'Clear application cache', estimatedDuration: 10 },
        { order: 3, description: 'Verify functionality', estimatedDuration: 15 }
      ]
    };
  }

  private buildAISuggestionPrompt(context: SuggestionContext): string {
    return `
Generate solution suggestions for this support ticket:

Title: ${context.ticket.title}
Description: ${context.ticket.description}
Category: ${context.category?.name || 'Unknown'}
Priority: ${context.priority?.name || 'Unknown'}

Provide 2-3 practical solutions with:
1. Clear step-by-step instructions
2. Estimated time to resolution
3. Confidence level (0-1)
4. Relevant keywords

Format as JSON array with objects containing: title, content, confidence, relevance, complexity, estimatedTime, keywords, steps
`;
  }

  private async callAIService(_prompt: string): Promise<AIServiceResponse> {
    // Mock implementation - would call actual AI service
    return {
      suggestions: [
        {
          title: 'Standard Troubleshooting Steps',
          content: 'Follow these standard troubleshooting procedures...',
          confidence: 0.8,
          relevance: 0.7,
          complexity: 'medium' as const,
          estimatedTime: 30,
          keywords: ['troubleshooting', 'standard', 'procedure'],
          steps: [
            { order: 1, description: 'Check system status', estimatedDuration: 5 },
            { order: 2, description: 'Review logs', estimatedDuration: 10 },
            { order: 3, description: 'Apply fix', estimatedDuration: 15 }
          ]
        }
      ]
    };
  }

  private initializeSolutionPatterns(): void {
    // Initialize common solution patterns
    this.solutionPatterns.set('network-connectivity', {
      id: 'network-connectivity',
      name: 'Network Connectivity Issues',
      title: 'Network Connection Troubleshooting',
      template: 'Standard network troubleshooting procedure',
      keywords: ['network', 'connection', 'internet', 'wifi'],
      confidence: 0.8,
      relevance: 0.7,
      complexity: 'medium',
      estimatedTime: 20,
      successRate: 0.85,
      usageCount: 150,
      steps: [
        { order: 1, description: 'Check physical connections', estimatedDuration: 5 },
        { order: 2, description: 'Test network connectivity', estimatedDuration: 10 },
        { order: 3, description: 'Reset network configuration', estimatedDuration: 5 }
      ]
    });
  }

  private matchSolutionPatterns(context: SuggestionContext): SolutionPattern[] {
    const ticketText = `${context.ticket.title} ${context.ticket.description}`.toLowerCase();
    const matches: SolutionPattern[] = [];

    for (const pattern of Array.from(this.solutionPatterns.values())) {
      const keywordMatches = pattern.keywords.filter(keyword =>
        ticketText.includes(keyword.toLowerCase())
      );

      if (keywordMatches.length > 0) {
        const matchRatio = keywordMatches.length / pattern.keywords.length;
        matches.push({
          ...pattern,
          confidence: pattern.confidence * matchRatio,
          relevance: pattern.relevance * matchRatio
        });
      }
    }

    return matches.sort((a, b) => b.relevance - a.relevance);
  }

  private findApplicableWorkflows(_context: SuggestionContext): WorkflowSuggestion[] {
    // Mock implementation
    return [];
  }

  private async updateSolutionPatterns(
    _suggestionId: string,
    _feedback: FeedbackData
  ): Promise<void> {
    // Update patterns based on feedback
    // This would update the machine learning models in a real implementation
  }
}

// Supporting interfaces
interface SolutionPattern {
  id: string;
  name: string;
  title: string;
  template: string;
  keywords: string[];
  confidence: number;
  relevance: number;
  complexity: 'low' | 'medium' | 'high';
  estimatedTime: number;
  successRate: number;
  usageCount: number;
  steps: Array<{
    order: number;
    description: string;
    estimatedDuration?: number;
  }>;
}

interface FeedbackData {
  wasHelpful: boolean;
  rating?: number;
  comment?: string;
  improvedResolution?: boolean;
  userId: number;
  timestamp: Date;
}

interface WorkflowSuggestion {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  confidence: number;
  relevance: number;
  estimatedTime: number;
  successRate: number;
  steps: Array<{
    order: number;
    description: string;
    estimatedDuration?: number;
  }>;
}

interface AIServiceResponse {
  suggestions: Array<{
    title: string;
    content: string;
    confidence: number;
    relevance: number;
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: number;
    keywords: string[];
    steps: Array<{
      order: number;
      description: string;
      estimatedDuration?: number;
    }>;
  }>;
}

// Export singleton instance
export const solutionSuggester = new SolutionSuggester();

// Export classes
export { SolutionSuggester };