/**
 * Knowledge Base Content Analyzer
 * Analyzes article quality, readability, completeness, and generates scores
 */

import type { KnowledgeArticle } from '../types/database';

export interface QualityScore {
  overall: number; // 0-100
  readability: number; // 0-100
  completeness: number; // 0-100
  freshness: number; // 0-100
  engagement: number; // 0-100
  technicalAccuracy: number; // 0-100
  seoOptimization: number; // 0-100
  recommendations: string[];
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
  }>;
}

export interface ReadabilityMetrics {
  fleschReadingEase: number; // 0-100 (higher = easier)
  fleschKincaidGrade: number; // Grade level
  averageSentenceLength: number;
  averageWordLength: number;
  complexWordPercentage: number;
  estimatedReadingTime: number; // minutes
}

export interface ContentMetrics {
  wordCount: number;
  paragraphCount: number;
  sentenceCount: number;
  headingCount: number;
  listCount: number;
  codeBlockCount: number;
  imageCount: number;
  linkCount: number;
}

export class ContentAnalyzer {
  /**
   * Analyze article quality
   */
  async analyzeArticleQuality(article: Partial<KnowledgeArticle>): Promise<QualityScore> {
    const content = article.content || '';
    const title = article.title || '';

    const readabilityScore = this.calculateReadability(content);
    const completenessScore = this.calculateCompleteness(article);
    const freshnessScore = this.calculateFreshness(article);
    const engagementScore = this.calculateEngagement(article);
    const seoScore = this.calculateSEOScore(article);

    const issues: QualityScore['issues'] = [];
    const recommendations: string[] = [];

    // Check for critical issues
    if (content.length < 300) {
      issues.push({
        severity: 'critical',
        category: 'content',
        message: 'Content is too short (minimum 300 characters recommended)'
      });
    }

    if (!title || title.length < 10) {
      issues.push({
        severity: 'critical',
        category: 'title',
        message: 'Title is too short (minimum 10 characters)'
      });
    }

    if (readabilityScore.fleschReadingEase < 30) {
      issues.push({
        severity: 'warning',
        category: 'readability',
        message: 'Content is difficult to read. Consider simplifying language.'
      });
    }

    // Generate recommendations
    if (completenessScore < 70) {
      recommendations.push('Add more headings to structure the content better');
      recommendations.push('Include code examples or screenshots where relevant');
    }

    if (seoScore < 60) {
      recommendations.push('Optimize meta title and description for search engines');
      recommendations.push('Add more relevant keywords throughout the content');
    }

    if (engagementScore < 50) {
      recommendations.push('Add interactive elements like lists or step-by-step guides');
      recommendations.push('Include visuals to break up text');
    }

    const overall = (
      readabilityScore.fleschReadingEase * 0.2 +
      completenessScore * 0.25 +
      freshnessScore * 0.15 +
      engagementScore * 0.2 +
      seoScore * 0.2
    );

    return {
      overall: Math.round(overall),
      readability: Math.round(readabilityScore.fleschReadingEase),
      completeness: Math.round(completenessScore),
      freshness: Math.round(freshnessScore),
      engagement: Math.round(engagementScore),
      technicalAccuracy: 75, // Would require AI analysis in production
      seoOptimization: Math.round(seoScore),
      recommendations,
      issues
    };
  }

  /**
   * Calculate readability metrics
   */
  calculateReadability(content: string): ReadabilityMetrics {
    const sentences = this.splitIntoSentences(content);
    const words = this.splitIntoWords(content);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);

    const sentenceCount = sentences.length || 1;
    const wordCount = words.length || 1;
    const syllableCount = syllables || 1;

    // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
    const avgWordsPerSentence = wordCount / sentenceCount;
    const avgSyllablesPerWord = syllableCount / wordCount;

    let fleschReadingEase = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    fleschReadingEase = Math.max(0, Math.min(100, fleschReadingEase));

    // Flesch-Kincaid Grade Level: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
    let fleschKincaidGrade = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
    fleschKincaidGrade = Math.max(0, fleschKincaidGrade);

    // Complex words (3+ syllables)
    const complexWords = words.filter(word => this.countSyllables(word) >= 3);
    const complexWordPercentage = (complexWords.length / wordCount) * 100;

    // Average word length
    const totalCharacters = words.reduce((sum, word) => sum + word.length, 0);
    const averageWordLength = totalCharacters / wordCount;

    // Estimated reading time (average 200 words per minute)
    const estimatedReadingTime = Math.ceil(wordCount / 200);

    return {
      fleschReadingEase,
      fleschKincaidGrade,
      averageSentenceLength: avgWordsPerSentence,
      averageWordLength,
      complexWordPercentage,
      estimatedReadingTime
    };
  }

  /**
   * Calculate content completeness score
   */
  private calculateCompleteness(article: Partial<KnowledgeArticle>): number {
    let score = 0;
    const content = article.content || '';

    // Has title (15 points)
    if (article.title && article.title.length >= 10) score += 15;

    // Has summary (10 points)
    if (article.summary && article.summary.length >= 50) score += 10;

    // Content length (20 points)
    const wordCount = this.splitIntoWords(content).length;
    if (wordCount >= 300) score += 10;
    if (wordCount >= 600) score += 10;

    // Has headings (15 points)
    const headingCount = (content.match(/^#+\s/gm) || []).length;
    if (headingCount >= 2) score += 8;
    if (headingCount >= 4) score += 7;

    // Has lists (10 points)
    const listCount = (content.match(/^(\*|-|\d+\.)\s/gm) || []).length;
    if (listCount >= 3) score += 5;
    if (listCount >= 6) score += 5;

    // Has code blocks (10 points)
    const codeBlockCount = (content.match(/```/g) || []).length / 2;
    if (codeBlockCount >= 1) score += 5;
    if (codeBlockCount >= 2) score += 5;

    // Has links (10 points)
    const linkCount = (content.match(/\[.+?\]\(.+?\)/g) || []).length;
    if (linkCount >= 1) score += 5;
    if (linkCount >= 3) score += 5;

    // Has tags (10 points)
    if (article.tags) {
      try {
        const tags = typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags;
        if (Array.isArray(tags) && tags.length >= 3) score += 10;
      } catch {}
    }

    return score;
  }

  /**
   * Calculate freshness score
   */
  private calculateFreshness(article: Partial<KnowledgeArticle>): number {
    const now = new Date();
    const updatedAt = article.updated_at ? new Date(article.updated_at) : now;
    const createdAt = article.created_at ? new Date(article.created_at) : now;

    const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    let score = 100;

    // Decay based on time since last update
    if (daysSinceUpdate > 365) score -= 50; // Over a year old
    else if (daysSinceUpdate > 180) score -= 30; // 6+ months old
    else if (daysSinceUpdate > 90) score -= 15; // 3+ months old
    else if (daysSinceUpdate > 30) score -= 5; // 1+ month old

    // Bonus for recently created content
    if (daysSinceCreation <= 7) score += 10;

    return Math.max(0, score);
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagement(article: Partial<KnowledgeArticle>): number {
    let score = 50; // Base score

    const viewCount = article.view_count || 0;
    const helpfulCount = article.helpful_count || 0;
    const notHelpfulCount = article.not_helpful_count || 0;

    // View count (20 points)
    if (viewCount > 1000) score += 20;
    else if (viewCount > 500) score += 15;
    else if (viewCount > 100) score += 10;
    else if (viewCount > 50) score += 5;

    // Helpful ratio (30 points)
    const totalVotes = helpfulCount + notHelpfulCount;
    if (totalVotes > 0) {
      const helpfulRatio = helpfulCount / totalVotes;
      score += Math.round(helpfulRatio * 30);
    }

    return Math.min(100, score);
  }

  /**
   * Calculate SEO optimization score
   */
  private calculateSEOScore(article: Partial<KnowledgeArticle>): number {
    let score = 0;
    const title = article.title || '';
    const content = article.content || '';

    // Title length (15 points)
    if (title.length >= 30 && title.length <= 60) score += 15;
    else if (title.length >= 20 && title.length <= 70) score += 10;

    // Meta description (15 points)
    const summary = article.summary || '';
    if (summary.length >= 120 && summary.length <= 160) score += 15;
    else if (summary.length >= 100 && summary.length <= 180) score += 10;

    // Keyword in title (10 points)
    const firstSentence = content.split(/[.!?]/)[0] || '';
    const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const contentWords = new Set(firstSentence.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    const intersection = new Set([...titleWords].filter(x => contentWords.has(x)));
    if (intersection.size >= 2) score += 10;

    // Content length (20 points)
    const wordCount = this.splitIntoWords(content).length;
    if (wordCount >= 1000) score += 20;
    else if (wordCount >= 600) score += 15;
    else if (wordCount >= 300) score += 10;

    // Headings (15 points)
    const headings = content.match(/^#+\s/gm) || [];
    if (headings.length >= 3) score += 15;
    else if (headings.length >= 2) score += 10;

    // Internal/external links (15 points)
    const links = content.match(/\[.+?\]\(.+?\)/g) || [];
    if (links.length >= 5) score += 15;
    else if (links.length >= 3) score += 10;
    else if (links.length >= 1) score += 5;

    // Images (10 points)
    const images = content.match(/!\[.+?\]\(.+?\)/g) || [];
    if (images.length >= 2) score += 10;
    else if (images.length >= 1) score += 5;

    return score;
  }

  /**
   * Get content metrics
   */
  getContentMetrics(content: string): ContentMetrics {
    const words = this.splitIntoWords(content);
    const sentences = this.splitIntoSentences(content);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

    return {
      wordCount: words.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      headingCount: (content.match(/^#+\s/gm) || []).length,
      listCount: (content.match(/^(\*|-|\d+\.)\s/gm) || []).length,
      codeBlockCount: (content.match(/```/g) || []).length / 2,
      imageCount: (content.match(/!\[.+?\]\(.+?\)/g) || []).length,
      linkCount: (content.match(/\[.+?\]\(.+?\)/g) || []).length
    };
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .replace(/\s+/g, ' ')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Split text into words
   */
  private splitIntoWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  /**
   * Count syllables in a word (simplified)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    // Remove silent e
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');

    // Count vowel groups
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
  }

  /**
   * Detect content gaps
   */
  async detectContentGaps(articles: Partial<KnowledgeArticle>[]): Promise<Array<{
    category: string;
    missingTopics: string[];
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>> {
    const gaps: Array<any> = [];

    // Analyze category coverage
    const categoryCounts = new Map<number, number>();
    articles.forEach(article => {
      if (article.category_id) {
        categoryCounts.set(
          article.category_id,
          (categoryCounts.get(article.category_id) || 0) + 1
        );
      }
    });

    // Identify under-documented categories
    categoryCounts.forEach((count, categoryId) => {
      if (count < 3) {
        gaps.push({
          category: `Category ${categoryId}`,
          missingTopics: ['Getting Started', 'Best Practices', 'Troubleshooting'],
          priority: count === 0 ? 'high' : 'medium',
          reason: `Only ${count} article(s) in this category`
        });
      }
    });

    return gaps;
  }

  /**
   * Suggest improvements for article
   */
  suggestImprovements(article: Partial<KnowledgeArticle>): string[] {
    const suggestions: string[] = [];
    const content = article.content || '';
    const wordCount = this.splitIntoWords(content).length;

    if (wordCount < 300) {
      suggestions.push('Expand the content with more details and examples');
    }

    if ((content.match(/^#+\s/gm) || []).length < 2) {
      suggestions.push('Add more section headings to improve structure');
    }

    if ((content.match(/```/g) || []).length === 0 && content.toLowerCase().includes('code')) {
      suggestions.push('Add code examples to illustrate technical concepts');
    }

    if ((content.match(/!\[.+?\]\(.+?\)/g) || []).length === 0) {
      suggestions.push('Include screenshots or diagrams to enhance understanding');
    }

    if ((content.match(/^(\*|-|\d+\.)\s/gm) || []).length < 3) {
      suggestions.push('Use bullet points or numbered lists for better readability');
    }

    const readability = this.calculateReadability(content);
    if (readability.fleschReadingEase < 40) {
      suggestions.push('Simplify language for better readability');
    }

    if (!article.tags || (Array.isArray(article.tags) && article.tags.length < 3)) {
      suggestions.push('Add more relevant tags to improve discoverability');
    }

    return suggestions;
  }
}

// Singleton instance
export const contentAnalyzer = new ContentAnalyzer();
