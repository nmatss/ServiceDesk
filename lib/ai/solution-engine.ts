import db from '../db/connection';
import { OpenAI } from 'openai';
import type { TicketWithDetails, KnowledgeArticle } from '../types/database';
import logger from '../monitoring/structured-logger';

// Solution Suggestion Engine - provides intelligent recommendations based on historical data
export class SolutionEngine {
  private openai: OpenAI;
  private modelName: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.modelName = process.env.AI_MODEL_NAME || 'gpt-4-turbo-preview';
  }

  /**
   * Find similar tickets based on content analysis and vector similarity
   */
  async findSimilarTickets(ticketTitle: string, ticketDescription: string, category?: string, limit: number = 5): Promise<{
    similarTickets: Array<{
      ticket: TicketWithDetails;
      similarity: number;
      matchedKeywords: string[];
      resolutionSummary?: string;
    }>;
    confidence: number;
    reasoning: string;
  }> {
    // First, get potential similar tickets from database
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
      WHERE s.is_final = 1
    `;

    const params: any[] = [];

    if (category) {
      query += ` AND c.name = ?`;
      params.push(category);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 100`;

    const potentialTickets = db.prepare(query).all(...params) as TicketWithDetails[];

    // Use AI to analyze similarity and provide reasoning
    const ticketsForAnalysis = potentialTickets.map(ticket => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description.substring(0, 500), // Limit description length
      category: ticket.category?.name ?? 'Unknown',
      priority: ticket.priority?.name ?? 'Unknown',
      status: ticket.status?.name ?? 'Unknown'
    }));

    const prompt = `
You are an expert IT support analyst. Find the most similar tickets to help resolve the current issue.

CURRENT TICKET:
Title: ${ticketTitle}
Description: ${ticketDescription}

HISTORICAL TICKETS:
${JSON.stringify(ticketsForAnalysis, null, 2)}

Analyze and return the ${limit} most similar tickets based on:
1. Problem similarity (same symptoms, error messages, affected systems)
2. Technical context (similar technologies, environments)
3. Resolution applicability (solutions that would work for current issue)
4. Keyword matching (technical terms, error codes, system names)

For each similar ticket, provide:
- Similarity score (0.0 to 1.0)
- Matched keywords/phrases
- Brief explanation of why it's similar
- Whether the resolution approach would apply

Respond in JSON format:
{
  "similarTickets": [
    {
      "ticketId": number,
      "similarity": number,
      "matchedKeywords": ["keyword1", "keyword2"],
      "similarityReasoning": "explanation",
      "resolutionApplicable": boolean,
      "keyLessonsLearned": ["lesson1", "lesson2"]
    }
  ],
  "confidence": number,
  "overallReasoning": "explanation of analysis approach",
  "recommendedFocusAreas": ["area1", "area2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert IT support analyst specializing in ticket similarity analysis and solution recommendation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0]?.message.content || '{}');

      // Map the analysis back to full ticket objects
      const similarTickets = analysis.similarTickets
        .filter((item: any) => item.similarity >= 0.3) // Only include reasonably similar tickets
        .map((item: any) => {
          const ticket = potentialTickets.find(t => t.id === item.ticketId);
          return ticket ? {
            ticket,
            similarity: item.similarity,
            matchedKeywords: item.matchedKeywords,
            resolutionSummary: item.keyLessonsLearned?.join('; ')
          } : null;
        })
        .filter(Boolean)
        .slice(0, limit);

      return {
        similarTickets,
        confidence: analysis.confidence,
        reasoning: analysis.overallReasoning
      };

    } catch (error) {
      logger.error('Similar Tickets Analysis Error', error);
      // Fallback to simple keyword matching
      return this.findSimilarTicketsBasic(ticketTitle, ticketDescription, potentialTickets, limit);
    }
  }

  /**
   * Generate solution suggestions based on ticket content and knowledge base
   */
  async generateSolutionSuggestions(ticketTitle: string, ticketDescription: string, category: string, priority: string): Promise<{
    suggestions: Array<{
      type: 'immediate_action' | 'troubleshooting_step' | 'escalation' | 'knowledge_article';
      title: string;
      description: string;
      confidence: number;
      estimatedTimeMinutes: number;
      requiredSkills: string[];
      riskLevel: 'low' | 'medium' | 'high';
      successProbability: number;
      sourceType: 'ai_analysis' | 'knowledge_base' | 'similar_tickets' | 'best_practices';
      sourceReference?: string;
    }>;
    recommendedApproach: string;
    estimatedResolutionTime: number;
    confidence: number;
  }> {
    // Get relevant knowledge base articles
    const kbArticles = this.getRelevantKBArticles(ticketTitle, ticketDescription);

    // Get similar resolved tickets
    const { similarTickets } = await this.findSimilarTickets(ticketTitle, ticketDescription, category, 3);

    const prompt = `
You are an expert IT support specialist. Generate practical solution suggestions for this ticket.

TICKET INFORMATION:
Title: ${ticketTitle}
Description: ${ticketDescription}
Category: ${category}
Priority: ${priority}

AVAILABLE CONTEXT:
Knowledge Base Articles: ${kbArticles.length} articles found
Similar Resolved Tickets: ${similarTickets.length} tickets found

SIMILAR TICKETS RESOLUTIONS:
${similarTickets.map(st => `
Ticket: ${st.ticket.title}
Resolution: ${st.resolutionSummary || 'Check comments for resolution details'}
`).join('\n')}

Generate 3-6 solution suggestions ordered by recommended execution sequence:

1. IMMEDIATE ACTIONS (quick wins, low risk)
2. TROUBLESHOOTING STEPS (systematic diagnosis)
3. ESCALATION OPTIONS (when needed)
4. KNOWLEDGE BASE REFERENCES (relevant articles)

For each suggestion, consider:
- Technical feasibility
- Risk assessment
- Required skills/permissions
- Estimated time
- Success probability
- Customer impact

Respond in JSON format:
{
  "suggestions": [
    {
      "type": "immediate_action|troubleshooting_step|escalation|knowledge_article",
      "title": "Clear, actionable title",
      "description": "Detailed step-by-step instructions",
      "confidence": number,
      "estimatedTimeMinutes": number,
      "requiredSkills": ["skill1", "skill2"],
      "riskLevel": "low|medium|high",
      "successProbability": number,
      "sourceType": "ai_analysis|knowledge_base|similar_tickets|best_practices",
      "sourceReference": "optional reference",
      "prerequisites": ["prerequisite1"],
      "expectedOutcome": "what should happen if successful"
    }
  ],
  "recommendedApproach": "Overall strategy and sequence",
  "estimatedResolutionTime": number,
  "confidence": number,
  "riskAssessment": "Overall risk analysis",
  "customerCommunicationTips": ["tip1", "tip2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert IT support specialist with extensive experience in troubleshooting and customer service. Provide practical, actionable solutions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message.content || '{}');

    } catch (error) {
      logger.error('Solution Generation Error', error);
      throw new Error(`Solution generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Suggest response templates for agents based on ticket content
   */
  async generateResponseSuggestions(ticketTitle: string, ticketDescription: string, ticketSentiment: string, customerType: 'internal' | 'external' | 'vip'): Promise<{
    responses: Array<{
      type: 'initial_response' | 'update' | 'resolution' | 'escalation_notice';
      tone: 'professional' | 'friendly' | 'technical' | 'apologetic';
      content: string;
      useCase: string;
      personalizable: boolean;
      estimatedCustomerSatisfaction: number;
    }>;
    communicationStrategy: string;
    confidence: number;
  }> {
    const prompt = `
Generate professional response templates for this support ticket.

TICKET INFORMATION:
Title: ${ticketTitle}
Description: ${ticketDescription}
Customer Sentiment: ${ticketSentiment}
Customer Type: ${customerType}

Generate 2-4 response templates for different scenarios:
1. Initial response (acknowledging ticket)
2. Status update (keeping customer informed)
3. Resolution response (when issue is fixed)
4. Escalation notice (if needed)

Adapt tone and content based on:
- Customer sentiment (more apologetic if frustrated)
- Customer type (more formal for VIP)
- Technical complexity (adjust language level)
- Urgency level

Each response should:
- Be professional yet empathetic
- Set appropriate expectations
- Include next steps
- Use customer-friendly language
- Be personalizable with customer name

Respond in JSON format:
{
  "responses": [
    {
      "type": "initial_response|update|resolution|escalation_notice",
      "tone": "professional|friendly|technical|apologetic",
      "content": "Full response template with [CUSTOMER_NAME] placeholders",
      "useCase": "When to use this response",
      "personalizable": boolean,
      "estimatedCustomerSatisfaction": number,
      "keyMessages": ["message1", "message2"],
      "followUpActions": ["action1", "action2"]
    }
  ],
  "communicationStrategy": "Overall approach for this customer/ticket",
  "confidence": number,
  "toneRecommendations": ["recommendation1", "recommendation2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert customer service communications specialist. Generate professional, empathetic responses that improve customer satisfaction.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message.content || '{}');

    } catch (error) {
      logger.error('Response Generation Error', error);
      throw new Error(`Response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fallback method for basic similarity matching
   */
  private findSimilarTicketsBasic(ticketTitle: string, ticketDescription: string, tickets: TicketWithDetails[], limit: number) {
    const keywords = this.extractKeywords(ticketTitle + ' ' + ticketDescription);

    const scoredTickets = tickets.map(ticket => {
      const ticketText = ticket.title + ' ' + ticket.description;
      const ticketKeywords = this.extractKeywords(ticketText);

      const matchedKeywords = keywords.filter(k => ticketKeywords.includes(k));
      const similarity = matchedKeywords.length / Math.max(keywords.length, ticketKeywords.length);

      return {
        ticket,
        similarity,
        matchedKeywords,
        resolutionSummary: 'Basic keyword matching - review ticket details'
      };
    });

    return {
      similarTickets: scoredTickets
        .filter(st => st.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit),
      confidence: 0.6,
      reasoning: 'Basic keyword-based similarity matching'
    };
  }

  /**
   * Extract keywords from text for basic matching
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will'].includes(word));
  }

  /**
   * Get relevant knowledge base articles (simplified implementation)
   */
  private getRelevantKBArticles(title: string, description: string): KnowledgeArticle[] {
    const keywords = this.extractKeywords(title + ' ' + description).slice(0, 5);

    if (keywords.length === 0) return [];

    const searchQuery = keywords.map(() => 'content LIKE ?').join(' OR ');
    const searchParams = keywords.map(k => `%${k}%`);

    const query = `
      SELECT * FROM kb_articles
      WHERE is_published = 1 AND (${searchQuery})
      ORDER BY helpful_votes DESC
      LIMIT 5
    `;

    try {
      return db.prepare(query).all(...searchParams) as KnowledgeArticle[];
    } catch (error) {
      logger.error('KB Articles Search Error', error);
      return [];
    }
  }
}

export const solutionEngine = new SolutionEngine();