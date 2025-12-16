import OpenAI from 'openai';
import db from '../db/connection';
import { aiClassifier } from './classifier';
import logger from '../monitoring/structured-logger';

export class AISuggestions {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
  }

  /**
   * Sugere soluções para um ticket
   */
  async suggestSolutions(
    ticketId: number,
    organizationId: number
  ): Promise<any[]> {
    // Buscar ticket
    const ticket = db.prepare(`
      SELECT * FROM tickets WHERE id = ? AND organization_id = ?
    `).get(ticketId, organizationId) as any;

    if (!ticket) return [];

    // 1. Buscar tickets similares resolvidos
    const similarTickets = await this.findSimilarResolvedTickets(
      ticket.title,
      ticket.description,
      organizationId
    );

    // 2. Buscar artigos da KB relevantes
    const relevantArticles = await this.findRelevantKBArticles(
      ticket.title + ' ' + ticket.description,
      organizationId
    );

    // 3. Gerar sugestões com GPT
    const aiSuggestions = await this.generateAISuggestions(
      ticket,
      similarTickets,
      relevantArticles,
      organizationId
    );

    // 4. Salvar e retornar
    const allSuggestions = [];

    for (const suggestion of aiSuggestions) {
      const savedId = await this.saveSuggestion(
        ticketId,
        suggestion.type,
        suggestion.content,
        suggestion.confidence,
        suggestion.reasoning,
        suggestion.sources,
        organizationId
      );

      allSuggestions.push({
        id: savedId,
        ...suggestion
      });
    }

    return allSuggestions;
  }

  /**
   * Busca tickets similares já resolvidos
   */
  private async findSimilarResolvedTickets(
    title: string,
    description: string,
    organizationId: number
  ): Promise<any[]> {
    const queryText = title + ' ' + description;

    const similar = await aiClassifier.findSimilar(
      queryText,
      'ticket',
      organizationId,
      5
    );

    const ticketIds = similar.map(s => s.entity_id);

    if (ticketIds.length === 0) return [];

    // Buscar detalhes dos tickets
    const placeholders = ticketIds.map(() => '?').join(',');
    const tickets = db.prepare(`
      SELECT t.*, c.content as last_comment
      FROM tickets t
      LEFT JOIN (
        SELECT ticket_id, content
        FROM comments
        WHERE id IN (
          SELECT MAX(id) FROM comments GROUP BY ticket_id
        )
      ) c ON t.id = c.ticket_id
      WHERE t.id IN (${placeholders})
        AND t.organization_id = ?
        AND t.status_id IN (SELECT id FROM statuses WHERE is_final = 1)
      LIMIT 3
    `).all(...ticketIds, organizationId);

    return tickets;
  }

  /**
   * Busca artigos da KB relevantes
   */
  private async findRelevantKBArticles(
    queryText: string,
    organizationId: number
  ): Promise<any[]> {
    const similar = await aiClassifier.findSimilar(
      queryText,
      'kb_article',
      organizationId,
      3
    );

    const articleIds = similar.map(s => s.entity_id);

    if (articleIds.length === 0) return [];

    const placeholders = articleIds.map(() => '?').join(',');
    const articles = db.prepare(`
      SELECT * FROM kb_articles
      WHERE id IN (${placeholders})
        AND organization_id = ?
        AND status = 'published'
    `).all(...articleIds, organizationId);

    return articles;
  }

  /**
   * Gera sugestões usando GPT
   */
  private async generateAISuggestions(
    ticket: any,
    similarTickets: any[],
    kbArticles: any[],
    _organizationId: number
  ): Promise<any[]> {
    const prompt = `
Você é um assistente técnico especializado em suporte.

TICKET ATUAL:
Título: ${ticket.title}
Descrição: ${ticket.description}

TICKETS SIMILARES RESOLVIDOS:
${similarTickets.map((t, i) => `
${i + 1}. #${t.id} - ${t.title}
   Solução: ${t.last_comment || 'N/A'}
`).join('\n')}

ARTIGOS DA BASE DE CONHECIMENTO:
${kbArticles.map((a, i) => `
${i + 1}. ${a.title}
   Resumo: ${a.summary || a.content?.substring(0, 200)}
`).join('\n')}

Com base nas informações acima, forneça 3 sugestões de solução para o ticket atual.

Retorne um JSON array:
[
  {
    "type": "solution",
    "content": "descrição detalhada da solução sugerida",
    "confidence": 0.XX (0-1),
    "reasoning": "por que esta solução é relevante",
    "sources": ["ticket #123", "artigo X"]
  }
]
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em suporte técnico.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5
      });

      const result = JSON.parse(completion.choices[0]?.message.content || '{"suggestions": []}');
      return result.suggestions || [];

    } catch (error) {
      logger.error('AI suggestions error', error);
      return [];
    }
  }

  /**
   * Gera resposta automática
   */
  async generateAutoResponse(
    ticketId: number,
    organizationId: number
  ): Promise<string> {
    const ticket = db.prepare(`
      SELECT * FROM tickets WHERE id = ? AND organization_id = ?
    `).get(ticketId, organizationId) as any;

    if (!ticket) return '';

    // Buscar contexto
    const comments = db.prepare(`
      SELECT * FROM comments
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).all(ticketId) as any[];

    const prompt = `
Você é um agente de suporte prestativo.

TICKET:
${ticket.title}
${ticket.description}

HISTÓRICO:
${comments.map(c => `- ${c.content}`).join('\n')}

Gere uma resposta profissional e útil para o usuário.
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um agente de suporte profissional e prestativo.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0]?.message.content || '';

    } catch (error) {
      logger.error('Auto-response error', error);
      return '';
    }
  }

  /**
   * Salva sugestão
   */
  private async saveSuggestion(
    ticketId: number,
    type: string,
    content: string,
    confidence: number,
    reasoning: string,
    sources: string[],
    organizationId: number
  ): Promise<number> {
    const result = db.prepare(`
      INSERT INTO ai_suggestions (
        ticket_id, suggestion_type, content,
        confidence_score, reasoning, source_references,
        model_name, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'gpt-4o', ?)
    `).run(
      ticketId,
      type,
      content,
      confidence,
      reasoning,
      JSON.stringify(sources),
      organizationId
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Fornece feedback sobre sugestão
   */
  async provideFeedback(
    suggestionId: number,
    wasHelpful: boolean,
    comment?: string,
    userId?: number
  ): Promise<void> {
    db.prepare(`
      UPDATE ai_suggestions
      SET was_helpful = ?,
          feedback_comment = ?,
          feedback_by = ?,
          feedback_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      wasHelpful ? 1 : 0,
      comment || null,
      userId || null,
      suggestionId
    );
  }
}

export const aiSuggestions = new AISuggestions();
