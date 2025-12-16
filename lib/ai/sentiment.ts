import OpenAI from 'openai';
import db from '../db/connection';
import logger from '../monitoring/structured-logger';

export interface SentimentResult {
  score: number; // -1 (negativo) a +1 (positivo)
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
  emotions: {
    anger: number;
    frustration: number;
    satisfaction: number;
    urgency: number;
  };
}

export class SentimentAnalyzer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
  }

  /**
   * Analisa sentimento de texto
   */
  async analyze(text: string): Promise<SentimentResult> {
    const prompt = `
Analise o sentimento do seguinte texto de um ticket de suporte:

"${text}"

Retorne um JSON com:
{
  "score": -1 a +1 (negativo a positivo),
  "label": "positive" | "neutral" | "negative",
  "confidence": 0-1,
  "emotions": {
    "anger": 0-1,
    "frustration": 0-1,
    "satisfaction": 0-1,
    "urgency": 0-1
  }
}
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de sentimento.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      return JSON.parse(completion.choices[0]?.message.content || '{}');

    } catch (error) {
      logger.error('Sentiment analysis error', error);
      return {
        score: 0,
        label: 'neutral',
        confidence: 0,
        emotions: { anger: 0, frustration: 0, satisfaction: 0, urgency: 0 }
      };
    }
  }

  /**
   * Analisa ticket e ajusta prioridade baseado em sentimento
   */
  async analyzeTicketAndAdjustPriority(
    ticketId: number,
    organizationId: number
  ): Promise<void> {
    const ticket = db.prepare(`
      SELECT * FROM tickets WHERE id = ? AND organization_id = ?
    `).get(ticketId, organizationId) as any;

    if (!ticket) return;

    const sentiment = await this.analyze(ticket.description);

    // Se sentimento muito negativo + alta urgência, aumentar prioridade
    if (sentiment.score < -0.5 && sentiment.emotions.urgency > 0.7) {
      // Buscar prioridade mais alta
      const highPriority = db.prepare(`
        SELECT id FROM priorities
        WHERE organization_id = ?
        ORDER BY level DESC
        LIMIT 1
      `).get(organizationId) as any;

      if (highPriority && ticket.priority_id !== highPriority.id) {
        db.prepare(`
          UPDATE tickets
          SET priority_id = ?
          WHERE id = ?
        `).run(highPriority.id, ticketId);

        // Criar notificação para managers
        db.prepare(`
          INSERT INTO notifications (
            user_id, ticket_id, type, title, message, organization_id
          )
          SELECT
            id, ?, 'sla_warning',
            'Ticket com sentimento negativo detectado',
            'Ticket #' || ? || ' foi escalado automaticamente devido a análise de sentimento negativo',
            ?
          FROM users
          WHERE role = 'manager' AND organization_id = ?
        `).run(ticketId, ticketId, organizationId, organizationId);
      }
    }
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
