/**
 * Duplicate Detector - Advanced similarity detection for ticket deduplication
 * Uses semantic similarity, keyword analysis, and machine learning
 */

import type { Ticket, CreateTicket, User, Category } from '../types/database';
import { logger } from '../monitoring/logger';

export interface DuplicateMatch {
  ticket: Ticket;
  similarityScore: number;
  confidenceLevel: 'low' | 'medium' | 'high' | 'very_high';
  matchReasons: MatchReason[];
  recommendedAction: 'merge' | 'link' | 'monitor' | 'ignore';
  semanticSimilarity: number;
  keywordSimilarity: number;
  structuralSimilarity: number;
  temporalRelevance: number;
}

export interface MatchReason {
  type: 'semantic' | 'keyword' | 'structural' | 'temporal' | 'user' | 'category';
  description: string;
  weight: number;
  evidence: string[];
  confidence: number;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  confidence: number;
  matches: DuplicateMatch[];
  suggestedActions: SuggestedAction[];
  analysisMetadata: {
    processingTime: number;
    methodsUsed: string[];
    totalTicketsAnalyzed: number;
    embeddingDimensions?: number;
  };
}

export interface SuggestedAction {
  action: 'auto_merge' | 'suggest_merge' | 'create_link' | 'flag_review' | 'proceed_normal';
  confidence: number;
  reasoning: string;
  targetTickets?: number[];
  reviewRequired: boolean;
}

export interface DetectionConfig {
  thresholds: {
    duplicateThreshold: number;
    autoMergeThreshold: number;
    flagReviewThreshold: number;
    semanticWeight: number;
    keywordWeight: number;
    structuralWeight: number;
    temporalWeight: number;
  };
  features: {
    semanticAnalysis: boolean;
    keywordMatching: boolean;
    structuralAnalysis: boolean;
    temporalAnalysis: boolean;
    userContextAnalysis: boolean;
    categoryFiltering: boolean;
  };
  limits: {
    maxTicketsToAnalyze: number;
    maxDaysBack: number;
    minSimilarityForReport: number;
  };
}

export interface EmbeddingCache {
  ticketId: number;
  embedding: number[];
  generatedAt: Date;
  model: string;
  version: string;
}

class DuplicateDetector {
  private config: DetectionConfig;
  private embeddingCache: Map<number, EmbeddingCache> = new Map();
  private stopWords: Set<string> = new Set();
  private technicalTerms: Map<string, number> = new Map();
  private categoryPatterns: Map<number, string[]> = new Map();

  constructor(config?: Partial<DetectionConfig>) {
    this.config = {
      thresholds: {
        duplicateThreshold: 0.85,
        autoMergeThreshold: 0.95,
        flagReviewThreshold: 0.75,
        semanticWeight: 0.4,
        keywordWeight: 0.25,
        structuralWeight: 0.2,
        temporalWeight: 0.15,
        ...config?.thresholds
      },
      features: {
        semanticAnalysis: true,
        keywordMatching: true,
        structuralAnalysis: true,
        temporalAnalysis: true,
        userContextAnalysis: true,
        categoryFiltering: true,
        ...config?.features
      },
      limits: {
        maxTicketsToAnalyze: 1000,
        maxDaysBack: 30,
        minSimilarityForReport: 0.3,
        ...config?.limits
      }
    };

    this.initializeStopWords();
    this.initializeTechnicalTerms();
  }

  /**
   * Main duplicate detection method
   */
  async detectDuplicates(
    ticketData: CreateTicket | { title: string; description: string; },
    historicalTickets: Ticket[],
    context?: {
      categories?: Category[];
      users?: User[];
      currentUserId?: number;
      categoryId?: number;
    }
  ): Promise<DuplicateDetectionResult> {
    const startTime = Date.now();

    try {
      // Filter tickets based on configuration
      const relevantTickets = this.filterRelevantTickets(
        historicalTickets,
        context
      );

      // Perform different types of similarity analysis
      const matches = await this.findMatches(ticketData, relevantTickets, context);

      // Sort matches by similarity score
      const sortedMatches = matches
        .filter(match => match.similarityScore >= this.config.limits.minSimilarityForReport)
        .sort((a, b) => b.similarityScore - a.similarityScore);

      // Determine if duplicates exist
      const isDuplicate = sortedMatches.length > 0 &&
        sortedMatches[0].similarityScore >= this.config.thresholds.duplicateThreshold;

      // Generate suggested actions
      const suggestedActions = this.generateSuggestedActions(sortedMatches);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(sortedMatches);

      const result: DuplicateDetectionResult = {
        isDuplicate,
        confidence,
        matches: sortedMatches.slice(0, 10), // Top 10 matches
        suggestedActions,
        analysisMetadata: {
          processingTime: Date.now() - startTime,
          methodsUsed: this.getUsedMethods(),
          totalTicketsAnalyzed: relevantTickets.length,
          embeddingDimensions: 1536 // Standard for text-embedding-3-small
        }
      };

      return result;

    } catch (error) {
      logger.error('Duplicate detection failed', error);
      throw new Error('Failed to detect duplicates');
    }
  }

  /**
   * Find potential matches using multiple similarity methods
   */
  private async findMatches(
    ticketData: { title: string; description: string; },
    historicalTickets: Ticket[],
    context?: any
  ): Promise<DuplicateMatch[]> {
    const matches: DuplicateMatch[] = [];

    for (const ticket of historicalTickets) {
      const match = await this.analyzeTicketSimilarity(
        ticketData,
        ticket,
        context
      );

      if (match && match.similarityScore > 0) {
        matches.push(match);
      }
    }

    return matches;
  }

  /**
   * Analyze similarity between two tickets using multiple methods
   */
  private async analyzeTicketSimilarity(
    newTicket: { title: string; description: string; },
    existingTicket: Ticket,
    context?: any
  ): Promise<DuplicateMatch | null> {
    const matchReasons: MatchReason[] = [];
    let totalScore = 0;
    let weightSum = 0;

    // Semantic similarity analysis
    if (this.config.features.semanticAnalysis) {
      const semanticAnalysis = await this.performSemanticAnalysis(
        newTicket,
        existingTicket
      );

      if (semanticAnalysis.similarity > 0.3) {
        matchReasons.push({
          type: 'semantic',
          description: 'High semantic similarity detected',
          weight: this.config.thresholds.semanticWeight,
          evidence: semanticAnalysis.evidence,
          confidence: semanticAnalysis.similarity
        });

        totalScore += semanticAnalysis.similarity * this.config.thresholds.semanticWeight;
        weightSum += this.config.thresholds.semanticWeight;
      }
    }

    // Keyword similarity analysis
    if (this.config.features.keywordMatching) {
      const keywordAnalysis = this.performKeywordAnalysis(
        newTicket,
        existingTicket
      );

      if (keywordAnalysis.similarity > 0.3) {
        matchReasons.push({
          type: 'keyword',
          description: 'Significant keyword overlap found',
          weight: this.config.thresholds.keywordWeight,
          evidence: keywordAnalysis.evidence,
          confidence: keywordAnalysis.similarity
        });

        totalScore += keywordAnalysis.similarity * this.config.thresholds.keywordWeight;
        weightSum += this.config.thresholds.keywordWeight;
      }
    }

    // Structural similarity analysis
    if (this.config.features.structuralAnalysis) {
      const structuralAnalysis = this.performStructuralAnalysis(
        newTicket,
        existingTicket
      );

      if (structuralAnalysis.similarity > 0.3) {
        matchReasons.push({
          type: 'structural',
          description: 'Similar text structure and patterns',
          weight: this.config.thresholds.structuralWeight,
          evidence: structuralAnalysis.evidence,
          confidence: structuralAnalysis.similarity
        });

        totalScore += structuralAnalysis.similarity * this.config.thresholds.structuralWeight;
        weightSum += this.config.thresholds.structuralWeight;
      }
    }

    // Temporal relevance analysis
    if (this.config.features.temporalAnalysis) {
      const temporalAnalysis = this.performTemporalAnalysis(existingTicket);

      if (temporalAnalysis.relevance > 0.3) {
        matchReasons.push({
          type: 'temporal',
          description: 'Recent ticket with temporal relevance',
          weight: this.config.thresholds.temporalWeight,
          evidence: temporalAnalysis.evidence,
          confidence: temporalAnalysis.relevance
        });

        totalScore += temporalAnalysis.relevance * this.config.thresholds.temporalWeight;
        weightSum += this.config.thresholds.temporalWeight;
      }
    }

    // If no meaningful similarities found, return null
    if (matchReasons.length === 0 || weightSum === 0) {
      return null;
    }

    // Calculate final similarity score
    const similarityScore = totalScore / weightSum;

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(similarityScore);

    // Determine recommended action
    const recommendedAction = this.determineRecommendedAction(
      similarityScore,
      matchReasons
    );

    // Extract individual similarity scores for detailed analysis
    const semanticSimilarity = matchReasons
      .find(r => r.type === 'semantic')?.confidence || 0;
    const keywordSimilarity = matchReasons
      .find(r => r.type === 'keyword')?.confidence || 0;
    const structuralSimilarity = matchReasons
      .find(r => r.type === 'structural')?.confidence || 0;
    const temporalRelevance = matchReasons
      .find(r => r.type === 'temporal')?.confidence || 0;

    return {
      ticket: existingTicket,
      similarityScore,
      confidenceLevel,
      matchReasons,
      recommendedAction,
      semanticSimilarity,
      keywordSimilarity,
      structuralSimilarity,
      temporalRelevance
    };
  }

  /**
   * Perform semantic similarity analysis using embeddings
   */
  private async performSemanticAnalysis(
    newTicket: { title: string; description: string; },
    existingTicket: Ticket
  ): Promise<{ similarity: number; evidence: string[] }> {
    try {
      // Generate embeddings for both tickets
      const newTicketText = `${newTicket.title} ${newTicket.description}`;
      const existingTicketText = `${existingTicket.title} ${existingTicket.description}`;

      const [newEmbedding, existingEmbedding] = await Promise.all([
        this.getEmbedding(newTicketText),
        this.getEmbedding(existingTicketText, existingTicket.id)
      ]);

      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(
        newEmbedding,
        existingEmbedding
      );

      // Generate evidence
      const evidence = [];
      if (similarity > 0.9) evidence.push('Very high semantic similarity');
      else if (similarity > 0.8) evidence.push('High semantic similarity');
      else if (similarity > 0.6) evidence.push('Moderate semantic similarity');
      else evidence.push('Low semantic similarity');

      // Add context about similar concepts
      const conceptSimilarity = this.analyzeConceptSimilarity(
        newTicketText,
        existingTicketText
      );
      if (conceptSimilarity.length > 0) {
        evidence.push(`Similar concepts: ${conceptSimilarity.join(', ')}`);
      }

      return { similarity, evidence };

    } catch (error) {
      logger.error('Semantic analysis failed', error);
      return { similarity: 0, evidence: ['Semantic analysis unavailable'] };
    }
  }

  /**
   * Perform keyword-based similarity analysis
   */
  private performKeywordAnalysis(
    newTicket: { title: string; description: string; },
    existingTicket: Ticket
  ): Promise<{ similarity: number; evidence: string[] }> {
    const newText = `${newTicket.title} ${newTicket.description}`.toLowerCase();
    const existingText = `${existingTicket.title} ${existingTicket.description}`.toLowerCase();

    // Extract keywords (excluding stop words)
    const newKeywords = this.extractKeywords(newText);
    const existingKeywords = this.extractKeywords(existingText);

    // Calculate Jaccard similarity
    const intersection = new Set([...newKeywords].filter(k => existingKeywords.has(k)));
    const union = new Set([...newKeywords, ...existingKeywords]);

    const jaccardSimilarity = intersection.size / union.size;

    // Calculate weighted similarity based on technical terms
    const weightedSimilarity = this.calculateWeightedKeywordSimilarity(
      newKeywords,
      existingKeywords
    );

    // Use the higher of the two similarities
    const similarity = Math.max(jaccardSimilarity, weightedSimilarity);

    // Generate evidence
    const evidence = [];
    const commonKeywords = Array.from(intersection);

    if (commonKeywords.length > 0) {
      evidence.push(`Common keywords: ${commonKeywords.slice(0, 5).join(', ')}`);
    }

    if (similarity > 0.7) {
      evidence.push(`High keyword overlap: ${(similarity * 100).toFixed(1)}%`);
    }

    // Check for technical term matches
    const technicalMatches = commonKeywords.filter(k => this.technicalTerms.has(k));
    if (technicalMatches.length > 0) {
      evidence.push(`Technical terms: ${technicalMatches.join(', ')}`);
    }

    return Promise.resolve({ similarity, evidence });
  }

  /**
   * Perform structural similarity analysis
   */
  private performStructuralAnalysis(
    newTicket: { title: string; description: string; },
    existingTicket: Ticket
  ): Promise<{ similarity: number; evidence: string[] }> {
    const evidence = [];
    let similarity = 0;

    // Analyze title similarity
    const titleSimilarity = this.calculateEditDistanceSimilarity(
      newTicket.title,
      existingTicket.title
    );

    if (titleSimilarity > 0.7) {
      evidence.push(`Similar titles: ${(titleSimilarity * 100).toFixed(1)}% match`);
      similarity += titleSimilarity * 0.6;
    }

    // Analyze description length similarity
    const newDescLength = newTicket.description.length;
    const existingDescLength = existingTicket.description.length;
    const lengthRatio = Math.min(newDescLength, existingDescLength) /
                       Math.max(newDescLength, existingDescLength);

    if (lengthRatio > 0.8) {
      evidence.push('Similar description length');
      similarity += 0.2;
    }

    // Analyze sentence structure
    const structureSimilarity = this.analyzeSentenceStructure(
      newTicket.description,
      existingTicket.description
    );

    if (structureSimilarity > 0.6) {
      evidence.push('Similar sentence structure');
      similarity += structureSimilarity * 0.2;
    }

    return Promise.resolve({ similarity: Math.min(similarity, 1), evidence });
  }

  /**
   * Perform temporal relevance analysis
   */
  private performTemporalAnalysis(
    existingTicket: Ticket
  ): Promise<{ relevance: number; evidence: string[] }> {
    const evidence = [];
    let relevance = 0;

    const now = new Date();
    const ticketDate = new Date(existingTicket.created_at);
    const daysDiff = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60 * 24);

    // Calculate temporal relevance based on recency
    if (daysDiff <= 1) {
      relevance = 1.0;
      evidence.push('Very recent ticket (within 24 hours)');
    } else if (daysDiff <= 7) {
      relevance = 0.8;
      evidence.push('Recent ticket (within 1 week)');
    } else if (daysDiff <= 30) {
      relevance = 0.6;
      evidence.push('Moderately recent ticket (within 1 month)');
    } else if (daysDiff <= 90) {
      relevance = 0.3;
      evidence.push('Older ticket (within 3 months)');
    } else {
      relevance = 0.1;
      evidence.push('Old ticket (over 3 months)');
    }

    // Adjust based on ticket status
    if (existingTicket.resolved_at) {
      const resolvedDate = new Date(existingTicket.resolved_at);
      const resolvedDaysDiff = (now.getTime() - resolvedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (resolvedDaysDiff <= 7) {
        relevance *= 1.2; // Recently resolved tickets are more relevant
        evidence.push('Recently resolved');
      }
    }

    return Promise.resolve({ relevance: Math.min(relevance, 1), evidence });
  }

  /**
   * Filter tickets based on relevance criteria
   */
  private filterRelevantTickets(
    tickets: Ticket[],
    context?: any
  ): Ticket[] {
    let filtered = tickets;

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.limits.maxDaysBack);

    filtered = filtered.filter(ticket =>
      new Date(ticket.created_at) >= cutoffDate
    );

    // Filter by category if specified and feature enabled
    if (this.config.features.categoryFiltering && context?.categoryId) {
      filtered = filtered.filter(ticket =>
        ticket.category_id === context.categoryId
      );
    }

    // Limit the number of tickets to analyze
    filtered = filtered
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, this.config.limits.maxTicketsToAnalyze);

    return filtered;
  }

  /**
   * Generate suggested actions based on matches
   */
  private generateSuggestedActions(matches: DuplicateMatch[]): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (matches.length === 0) {
      actions.push({
        action: 'proceed_normal',
        confidence: 0.9,
        reasoning: 'No significant duplicates found',
        reviewRequired: false
      });
      return actions;
    }

    const highestMatch = matches[0];

    // Auto-merge for very high similarity
    if (highestMatch.similarityScore >= this.config.thresholds.autoMergeThreshold) {
      actions.push({
        action: 'auto_merge',
        confidence: highestMatch.similarityScore,
        reasoning: 'Very high similarity suggests automatic merge',
        targetTickets: [highestMatch.ticket.id],
        reviewRequired: false
      });
    }
    // Suggest merge for high similarity
    else if (highestMatch.similarityScore >= this.config.thresholds.duplicateThreshold) {
      actions.push({
        action: 'suggest_merge',
        confidence: highestMatch.similarityScore,
        reasoning: 'High similarity suggests potential duplicate',
        targetTickets: [highestMatch.ticket.id],
        reviewRequired: true
      });
    }
    // Flag for review for medium similarity
    else if (highestMatch.similarityScore >= this.config.thresholds.flagReviewThreshold) {
      actions.push({
        action: 'flag_review',
        confidence: highestMatch.similarityScore,
        reasoning: 'Moderate similarity requires human review',
        targetTickets: matches.slice(0, 3).map(m => m.ticket.id),
        reviewRequired: true
      });
    }

    // Create links for related but not duplicate tickets
    const relatedMatches = matches.filter(m =>
      m.similarityScore >= 0.5 &&
      m.similarityScore < this.config.thresholds.flagReviewThreshold
    );

    if (relatedMatches.length > 0) {
      actions.push({
        action: 'create_link',
        confidence: 0.7,
        reasoning: 'Related tickets found that could be linked',
        targetTickets: relatedMatches.map(m => m.ticket.id),
        reviewRequired: false
      });
    }

    return actions;
  }

  // Helper methods

  private async getEmbedding(text: string, ticketId?: number): Promise<number[]> {
    // Check cache first
    if (ticketId && this.embeddingCache.has(ticketId)) {
      const cached = this.embeddingCache.get(ticketId)!;
      // Check if cache is still valid (24 hours)
      const ageMs = Date.now() - cached.generatedAt.getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        return cached.embedding;
      }
    }

    // Generate new embedding (placeholder - would use actual API)
    const embedding = new Array(1536).fill(0).map(() => Math.random());

    // Cache the result
    if (ticketId) {
      this.embeddingCache.set(ticketId, {
        ticketId,
        embedding,
        generatedAt: new Date(),
        model: 'text-embedding-3-small',
        version: '1.0'
      });
    }

    return embedding;
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private extractKeywords(text: string): Set<string> {
    const words = text.match(/\b\w+\b/g) || [];
    const keywords = new Set<string>();

    for (const word of words) {
      const cleanWord = word.toLowerCase();
      if (cleanWord.length > 2 && !this.stopWords.has(cleanWord)) {
        keywords.add(cleanWord);
      }
    }

    return keywords;
  }

  private calculateWeightedKeywordSimilarity(
    keywords1: Set<string>,
    keywords2: Set<string>
  ): number {
    let totalWeight = 0;
    let matchWeight = 0;

    for (const keyword of keywords1) {
      const weight = this.technicalTerms.get(keyword) || 1;
      totalWeight += weight;

      if (keywords2.has(keyword)) {
        matchWeight += weight;
      }
    }

    for (const keyword of keywords2) {
      if (!keywords1.has(keyword)) {
        const weight = this.technicalTerms.get(keyword) || 1;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? matchWeight / totalWeight : 0;
  }

  private calculateEditDistanceSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private analyzeSentenceStructure(text1: string, text2: string): number {
    const sentences1 = text1.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    const sentences2 = text2.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

    if (sentences1.length === 0 && sentences2.length === 0) return 1;
    if (sentences1.length === 0 || sentences2.length === 0) return 0;

    // Compare sentence count similarity
    const sentenceCountSimilarity = Math.min(sentences1.length, sentences2.length) /
                                   Math.max(sentences1.length, sentences2.length);

    // Compare average sentence length
    const avgLength1 = sentences1.reduce((sum, s) => sum + s.length, 0) / sentences1.length;
    const avgLength2 = sentences2.reduce((sum, s) => sum + s.length, 0) / sentences2.length;
    const lengthSimilarity = Math.min(avgLength1, avgLength2) / Math.max(avgLength1, avgLength2);

    return (sentenceCountSimilarity + lengthSimilarity) / 2;
  }

  private analyzeConceptSimilarity(text1: string, text2: string): string[] {
    // Simplified concept analysis - would be more sophisticated in practice
    const concepts = ['error', 'network', 'login', 'password', 'system', 'application'];
    const commonConcepts = [];

    for (const concept of concepts) {
      if (text1.toLowerCase().includes(concept) && text2.toLowerCase().includes(concept)) {
        commonConcepts.push(concept);
      }
    }

    return commonConcepts;
  }

  private determineConfidenceLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.75) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  private determineRecommendedAction(
    score: number,
    reasons: MatchReason[]
  ): 'merge' | 'link' | 'monitor' | 'ignore' {
    if (score >= this.config.thresholds.autoMergeThreshold) return 'merge';
    if (score >= this.config.thresholds.duplicateThreshold) return 'link';
    if (score >= this.config.thresholds.flagReviewThreshold) return 'monitor';
    return 'ignore';
  }

  private calculateOverallConfidence(matches: DuplicateMatch[]): number {
    if (matches.length === 0) return 0;

    const highestScore = matches[0].similarityScore;
    const reasonCount = matches[0].matchReasons.length;

    // Confidence increases with score and number of matching reasons
    return Math.min(highestScore + (reasonCount * 0.05), 1);
  }

  private getUsedMethods(): string[] {
    const methods = [];
    if (this.config.features.semanticAnalysis) methods.push('semantic');
    if (this.config.features.keywordMatching) methods.push('keyword');
    if (this.config.features.structuralAnalysis) methods.push('structural');
    if (this.config.features.temporalAnalysis) methods.push('temporal');
    return methods;
  }

  private initializeStopWords(): void {
    const words = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ];

    this.stopWords = new Set(words);
  }

  private initializeTechnicalTerms(): void {
    const terms = [
      ['error', 3], ['bug', 3], ['crash', 3], ['failure', 3], ['issue', 2],
      ['problem', 2], ['server', 3], ['database', 3], ['network', 3],
      ['login', 3], ['password', 3], ['authentication', 3], ['permission', 3],
      ['application', 2], ['software', 2], ['hardware', 3], ['system', 2]
    ];

    this.technicalTerms = new Map(terms);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = {
      thresholds: { ...this.config.thresholds, ...newConfig.thresholds },
      features: { ...this.config.features, ...newConfig.features },
      limits: { ...this.config.limits, ...newConfig.limits }
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Get detection statistics
   */
  getStats(): {
    cacheSize: number;
    config: DetectionConfig;
    technicalTermsCount: number;
    stopWordsCount: number;
  } {
    return {
      cacheSize: this.embeddingCache.size,
      config: JSON.parse(JSON.stringify(this.config)),
      technicalTermsCount: this.technicalTerms.size,
      stopWordsCount: this.stopWords.size
    };
  }
}

// Export singleton instance
export const duplicateDetector = new DuplicateDetector();

// Export types and classes
export { DuplicateDetector };
export type { DetectionConfig, EmbeddingCache };