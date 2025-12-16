import db from '../db/connection';
import { OpenAI } from 'openai';
import type { Ticket } from '../types/database';
import logger from '../monitoring/structured-logger';

// Extended ticket type with flattened join fields for duplicate detection
interface TicketWithDetailsFlat extends Ticket {
  user_name?: string;
  user_email?: string;
  user_role?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_agent_role?: string;
  category_name?: string;
  category_description?: string;
  category_color?: string;
  priority_name?: string;
  priority_level?: number;
  priority_color?: string;
  status_name?: string;
  status_description?: string;
  status_color?: string;
  status_is_final?: number;
  comments_count?: number;
  attachments_count?: number;
}

// AI Analysis Result Type
interface AIAnalysisResult {
  isDuplicate: boolean;
  confidence: number;
  duplicateTickets: Array<{
    ticketId: number;
    similarity: number;
    duplicateType: 'exact' | 'semantic' | 'user_pattern' | 'system_pattern';
    reasoning: string;
    recommendedAction: 'merge' | 'link' | 'flag_for_review' | 'auto_close';
    keyMatchingElements?: string[];
    differenceNotes?: string;
  }>;
  overallReasoning: string;
  recommendedAction: string;
  confidenceFactors?: string[];
}

// Rule-Based Detection Result Type
interface RuleBasedResult {
  isDuplicate: boolean;
  confidence: number;
  duplicateTickets: DuplicateTicketResult[];
  overallReasoning: string;
  recommendedAction: string;
}

// Duplicate Ticket Result Type
interface DuplicateTicketResult {
  ticketId: number;
  similarity: number;
  duplicateType: 'exact' | 'semantic' | 'user_pattern' | 'system_pattern';
  reasoning: string;
  recommendedAction: 'merge' | 'link' | 'flag_for_review' | 'auto_close';
  keyMatchingElements?: string[];
  differenceNotes?: string;
}

// Automatic Duplicate Detection System
export class DuplicateDetector {
  private openai: OpenAI;
  private modelName: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.modelName = process.env.AI_MODEL_NAME || 'gpt-4-turbo-preview';
  }

  /**
   * Detect potential duplicate tickets with high accuracy
   * Uses semantic analysis to identify duplicates even with different wording
   */
  async detectDuplicates(ticketTitle: string, ticketDescription: string, userId?: number, timeWindowHours: number = 72): Promise<{
    isDuplicate: boolean;
    confidence: number;
    duplicateTickets: Array<{
      ticket: TicketWithDetailsFlat;
      similarity: number;
      duplicateType: 'exact' | 'semantic' | 'user_pattern' | 'system_pattern';
      reasoning: string;
      recommendedAction: 'merge' | 'link' | 'flag_for_review' | 'auto_close';
    }>;
    reasoning: string;
    recommendedAction: string;
  }> {
    // First, get recent tickets to analyze
    const recentTickets = this.getRecentTickets(timeWindowHours, userId);

    if (recentTickets.length === 0) {
      return {
        isDuplicate: false,
        confidence: 1.0,
        duplicateTickets: [],
        reasoning: 'No recent tickets found for comparison',
        recommendedAction: 'proceed_normal'
      };
    }

    // Perform AI-powered semantic analysis
    const duplicateAnalysis = await this.performSemanticAnalysis(
      ticketTitle,
      ticketDescription,
      recentTickets
    );

    // Combine with rule-based detection
    const ruleBasedResults = this.performRuleBasedDetection(
      ticketTitle,
      ticketDescription,
      recentTickets,
      userId
    );

    // Merge results and determine final outcome
    return this.mergeDetectionResults(duplicateAnalysis, ruleBasedResults);
  }

  /**
   * Perform AI-powered semantic analysis for duplicate detection
   */
  private async performSemanticAnalysis(
    title: string,
    description: string,
    candidateTickets: TicketWithDetailsFlat[]
  ): Promise<AIAnalysisResult> {
    const ticketsForAnalysis = candidateTickets.map(ticket => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description.substring(0, 800), // Limit for token efficiency
      category: ticket.category_name,
      priority: ticket.priority_name,
      status: ticket.status_name,
      created_at: ticket.created_at,
      user_name: ticket.user_name
    }));

    const prompt = `
You are an expert duplicate detection specialist for IT support tickets. Analyze if the new ticket is a duplicate of any existing tickets.

NEW TICKET:
Title: ${title}
Description: ${description}

EXISTING TICKETS (last 72 hours):
${JSON.stringify(ticketsForAnalysis, null, 2)}

DUPLICATE DETECTION CRITERIA:
1. EXACT DUPLICATES: Nearly identical title/description
2. SEMANTIC DUPLICATES: Same issue described differently
3. USER PATTERN DUPLICATES: Same user reporting same/similar issue
4. SYSTEM PATTERN DUPLICATES: Multiple users reporting same system issue

For each potential duplicate, analyze:
- Similarity level (0.0 to 1.0)
- Type of duplication
- Confidence level
- Whether they describe the same underlying issue
- Recommended action (merge, link, flag, auto-close)

A ticket is considered a duplicate if:
- Similarity > 0.8 (exact/semantic match)
- Same user + similarity > 0.6 (user pattern)
- Same error/system + similarity > 0.7 (system pattern)

Respond in JSON format:
{
  "isDuplicate": boolean,
  "confidence": number,
  "duplicateTickets": [
    {
      "ticketId": number,
      "similarity": number,
      "duplicateType": "exact|semantic|user_pattern|system_pattern",
      "reasoning": "Detailed explanation of why this is a duplicate",
      "recommendedAction": "merge|link|flag_for_review|auto_close",
      "keyMatchingElements": ["element1", "element2"],
      "differenceNotes": "Any notable differences"
    }
  ],
  "overallReasoning": "Overall analysis explanation",
  "recommendedAction": "proceed_normal|review_duplicates|auto_handle",
  "confidenceFactors": ["factor1", "factor2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert duplicate detection specialist. Analyze tickets for potential duplicates with high accuracy to prevent redundant work and improve efficiency.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      return JSON.parse(content || '{}');

    } catch (error) {
      logger.error('Semantic Duplicate Detection Error', error);
      // Return conservative result on error
      return {
        isDuplicate: false,
        confidence: 0.5,
        duplicateTickets: [],
        overallReasoning: 'AI analysis failed - performed basic comparison only',
        recommendedAction: 'review_manually'
      };
    }
  }

  /**
   * Perform rule-based duplicate detection for high-confidence patterns
   */
  private performRuleBasedDetection(
    title: string,
    description: string,
    candidateTickets: TicketWithDetailsFlat[],
    userId?: number
  ): RuleBasedResult {
    const duplicates: DuplicateTicketResult[] = [];
    const titleWords = this.normalizeText(title);
    const descWords = this.normalizeText(description);

    for (const ticket of candidateTickets) {
      const ticketTitleWords = this.normalizeText(ticket.title);
      const ticketDescWords = this.normalizeText(ticket.description);

      // Check for exact title match
      const titleSimilarity = this.calculateTextSimilarity(titleWords, ticketTitleWords);
      const descSimilarity = this.calculateTextSimilarity(descWords, ticketDescWords);

      let duplicateType: 'exact' | 'semantic' | 'user_pattern' | 'system_pattern' | null = null;
      let similarity = 0;
      let reasoning = '';
      let recommendedAction: 'merge' | 'link' | 'flag_for_review' | 'auto_close' = 'flag_for_review';

      // Exact duplicate detection
      if (titleSimilarity > 0.9 && descSimilarity > 0.8) {
        duplicateType = 'exact';
        similarity = Math.max(titleSimilarity, descSimilarity);
        reasoning = 'Nearly identical title and description';
        recommendedAction = 'auto_close';
      }
      // Same user pattern
      else if (userId && ticket.user_id === userId && (titleSimilarity > 0.7 || descSimilarity > 0.6)) {
        duplicateType = 'user_pattern';
        similarity = Math.max(titleSimilarity, descSimilarity);
        reasoning = 'Same user reporting similar issue within short timeframe';
        recommendedAction = 'merge';
      }
      // System pattern (same error codes, system names)
      else if (this.hasSystemPatternMatch(title + ' ' + description, ticket.title + ' ' + ticket.description)) {
        duplicateType = 'system_pattern';
        similarity = 0.8;
        reasoning = 'Similar system errors or components mentioned';
        recommendedAction = 'link';
      }

      if (duplicateType && similarity > 0.6) {
        duplicates.push({
          ticketId: ticket.id,
          similarity,
          duplicateType,
          reasoning,
          recommendedAction,
          keyMatchingElements: this.findMatchingElements(
            title + ' ' + description,
            ticket.title + ' ' + ticket.description
          )
        });
      }
    }

    return {
      isDuplicate: duplicates.length > 0,
      confidence: duplicates.length > 0 ? Math.max(...duplicates.map(d => d.similarity)) : 0,
      duplicateTickets: duplicates,
      overallReasoning: 'Rule-based pattern matching analysis',
      recommendedAction: duplicates.length > 0 ? 'review_duplicates' : 'proceed_normal'
    };
  }

  /**
   * Get recent tickets for comparison
   */
  private getRecentTickets(hours: number, userId?: number): TicketWithDetailsFlat[] {
    let query = `
      SELECT
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.created_at >= datetime('now', '-${hours} hours')
    `;

    const params: (number | string)[] = [];

    // If userId provided, prioritize tickets from same user but include others
    if (userId) {
      query += ` ORDER BY CASE WHEN t.user_id = ? THEN 0 ELSE 1 END, t.created_at DESC`;
      params.push(userId);
    } else {
      query += ` ORDER BY t.created_at DESC`;
    }

    query += ` LIMIT 50`; // Reasonable limit for performance

    try {
      return db.prepare(query).all(...params) as TicketWithDetailsFlat[];
    } catch (error) {
      logger.error('Error fetching recent tickets', error);
      return [];
    }
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate text similarity using word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Check for system pattern matches (error codes, system names, etc.)
   */
  private hasSystemPatternMatch(text1: string, text2: string): boolean {
    const systemPatterns = [
      /error\s+\d+/gi,
      /\b[A-Z]{2,}\d{3,}\b/g, // Error codes like ERR404, SQL1001
      /(outlook|excel|word|windows|office|server|database|network|wifi|printer)/gi,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
      /(can't\s+login|cannot\s+access|not\s+working|error\s+message)/gi
    ];

    for (const pattern of systemPatterns) {
      const matches1 = text1.match(pattern) || [];
      const matches2 = text2.match(pattern) || [];

      if (matches1.length > 0 && matches2.length > 0) {
        // Check for common matches
        const commonMatches = matches1.filter(m =>
          matches2.some(m2 => m.toLowerCase() === m2.toLowerCase())
        );
        if (commonMatches.length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find matching elements between two texts
   */
  private findMatchingElements(text1: string, text2: string): string[] {
    const elements: string[] = [];

    // Find matching phrases (3+ words)
    const words1 = text1.toLowerCase().split(/\s+/);

    for (let i = 0; i < words1.length - 2; i++) {
      const phrase = words1.slice(i, i + 3).join(' ');
      if (text2.toLowerCase().includes(phrase)) {
        elements.push(phrase);
      }
    }

    // Find system/technical terms
    const techTerms = [
      /\b(error|exception|failed|timeout|connection|server|database|login|password|access|network|wifi|printer|email|outlook|office|windows|microsoft|adobe|chrome|firefox|safari|internet\s+explorer)\b/gi
    ];

    for (const pattern of techTerms) {
      const matches1 = text1.match(pattern) || [];
      const matches2 = text2.match(pattern) || [];

      const commonTerms = matches1.filter(m =>
        matches2.some(m2 => m.toLowerCase() === m2.toLowerCase())
      );

      elements.push(...commonTerms.map(t => t.toLowerCase()));
    }

    return [...new Set(elements)].slice(0, 10); // Remove duplicates and limit
  }

  /**
   * Merge results from AI and rule-based detection
   */
  private mergeDetectionResults(aiResults: any, ruleResults: any): any {
    interface DuplicateResult {
      ticketId: number;
      similarity: number;
      [key: string]: any;
    }

    const allDuplicates = [...(aiResults.duplicateTickets || []), ...(ruleResults.duplicateTickets || [])] as DuplicateResult[];

    // Remove duplicates and keep highest confidence
    const mergedDuplicates = allDuplicates.reduce((acc: DuplicateResult[], current: DuplicateResult) => {
      const existing = acc.find((d: DuplicateResult) => d.ticketId === current.ticketId);
      if (!existing || current.similarity > existing.similarity) {
        return [...acc.filter((d: DuplicateResult) => d.ticketId !== current.ticketId), current];
      }
      return acc;
    }, [] as DuplicateResult[]);

    const isDuplicate = mergedDuplicates.length > 0 && mergedDuplicates.some((d: DuplicateResult) => d.similarity > 0.7);
    const confidence = Math.max(aiResults.confidence || 0, ruleResults.confidence || 0);

    return {
      isDuplicate,
      confidence,
      duplicateTickets: mergedDuplicates.map((d: DuplicateResult) => ({
        ...d,
        ticket: d.ticketId // Will be mapped to full ticket object in the calling function
      })),
      reasoning: `Combined AI and rule-based analysis. ${aiResults.overallReasoning || ''} ${ruleResults.overallReasoning || ''}`,
      recommendedAction: isDuplicate ? 'review_duplicates' : 'proceed_normal'
    };
  }

  /**
   * Auto-handle duplicates based on confidence and type
   */
  async autoHandleDuplicate(
    originalTicketId: number,
    duplicateTicketId: number,
    duplicateType: string,
    confidence: number,
    handledBy: number
  ): Promise<{
    success: boolean;
    action: string;
    message: string;
  }> {
    try {
      if (confidence > 0.9 && duplicateType === 'exact') {
        // Auto-close with reference to original
        const updateStmt = db.prepare(`
          UPDATE tickets
          SET status_id = (SELECT id FROM statuses WHERE name = 'Closed' LIMIT 1),
              description = description || '\n\n[AUTO-CLOSED] Duplicate of ticket #' || ?
          WHERE id = ?
        `);
        updateStmt.run(originalTicketId, duplicateTicketId);

        // Log the action
        this.logDuplicateAction(duplicateTicketId, originalTicketId, 'auto_closed', handledBy);

        return {
          success: true,
          action: 'auto_closed',
          message: `Ticket automatically closed as exact duplicate of #${originalTicketId}`
        };
      } else if (confidence > 0.8) {
        // Link tickets for review
        this.linkTickets(originalTicketId, duplicateTicketId, 'potential_duplicate', handledBy);

        return {
          success: true,
          action: 'linked',
          message: `Tickets linked for duplicate review (confidence: ${Math.round(confidence * 100)}%)`
        };
      } else {
        // Flag for manual review
        this.flagForReview(duplicateTicketId, originalTicketId, confidence, handledBy);

        return {
          success: true,
          action: 'flagged',
          message: `Ticket flagged for manual duplicate review`
        };
      }
    } catch (error) {
      logger.error('Auto-handle duplicate error', error);
      return {
        success: false,
        action: 'error',
        message: 'Failed to auto-handle duplicate'
      };
    }
  }

  /**
   * Log duplicate handling action
   */
  private logDuplicateAction(ticketId: number, originalTicketId: number, action: string, userId: number) {
    const logStmt = db.prepare(`
      INSERT INTO audit_logs (user_id, entity_type, entity_id, action, new_values, created_at)
      VALUES (?, 'ticket', ?, 'duplicate_' || ?, ?, CURRENT_TIMESTAMP)
    `);

    logStmt.run(
      userId,
      ticketId,
      action,
      JSON.stringify({ originalTicketId, action, automated: true })
    );
  }

  /**
   * Link tickets for review
   */
  private linkTickets(originalId: number, duplicateId: number, _linkType: string, userId: number) {
    // This would typically involve a ticket_relationships table
    // For now, we'll add a comment to both tickets
    const commentStmt = db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal, created_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);

    commentStmt.run(
      duplicateId,
      userId,
      `[SYSTEM] Potential duplicate of ticket #${originalId} - flagged for review`
    );

    commentStmt.run(
      originalId,
      userId,
      `[SYSTEM] Potential duplicate: ticket #${duplicateId}`
    );
  }

  /**
   * Flag ticket for manual review
   */
  private flagForReview(ticketId: number, originalTicketId: number, confidence: number, userId: number) {
    const commentStmt = db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal, created_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);

    commentStmt.run(
      ticketId,
      userId,
      `[SYSTEM] Flagged for duplicate review - ${Math.round(confidence * 100)}% similarity to ticket #${originalTicketId}`
    );
  }
}

export const duplicateDetector = new DuplicateDetector();