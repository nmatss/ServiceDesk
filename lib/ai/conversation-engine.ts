/**
 * Conversation Engine for Omnichannel Portal
 * Manages multi-turn conversation state for conversational ticket creation
 */

import { executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import type { SqlParam } from '@/lib/db/adapter';
import { entityExtractor, type ExtractedEntities } from './entity-extractor';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConversationState =
  | 'greeting'
  | 'gathering_info'
  | 'searching_solution'
  | 'confirming_ticket'
  | 'resolved'
  | 'ticket_created';

export type ResponseType =
  | 'text'
  | 'solution_card'
  | 'ticket_confirmation'
  | 'resolved';

export interface ConversationMessage {
  role: 'user' | 'bot';
  text: string;
  type: ResponseType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface ConversationSession {
  sessionId: string;
  organizationId: number;
  userId: number;
  state: ConversationState;
  entities: ExtractedEntities;
  messages: ConversationMessage[];
  kbArticleShown?: number;
  createdTicketId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationResponse {
  type: ResponseType;
  text: string;
  data?: Record<string, unknown>;
  quickReplies?: string[];
}

export interface KBMatch {
  id: number;
  title: string;
  summary: string;
  content: string;
  confidence: number;
}

// ─── Session Store ──────────────────────────────────────────────────────────

const sessions = new Map<string, ConversationSession>();

// Cleanup sessions older than 2 hours
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
let lastSessionCleanup = Date.now();

function cleanupSessions(): void {
  const now = Date.now();
  if (now - lastSessionCleanup < 60_000) return; // At most every minute
  lastSessionCleanup = now;

  for (const [id, session] of sessions) {
    if (now - session.updatedAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// ─── Conversation Engine ────────────────────────────────────────────────────

export class ConversationEngine {
  /**
   * Process a user message within a conversation session.
   * Creates or retrieves the session, extracts entities, searches KB,
   * and advances the state machine.
   */
  async processMessage(
    orgId: number,
    userId: number,
    sessionId: string,
    message: string
  ): Promise<{ response: ConversationResponse; state: ConversationState; entities: ExtractedEntities }> {
    cleanupSessions();

    let session = sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        organizationId: orgId,
        userId,
        state: 'greeting',
        entities: {},
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.set(sessionId, session);
    }

    // Record user message
    session.messages.push({
      role: 'user',
      text: message,
      type: 'text',
      timestamp: new Date(),
    });
    session.updatedAt = new Date();

    // Extract entities from this message and merge
    const newEntities = entityExtractor.extract(message);
    session.entities = { ...session.entities, ...newEntities };

    // State machine
    const response = await this.advanceState(session, message);

    // Record bot response
    session.messages.push({
      role: 'bot',
      text: response.text,
      type: response.type,
      timestamp: new Date(),
      data: response.data,
    });

    return {
      response,
      state: session.state,
      entities: session.entities,
    };
  }

  /**
   * Get the full conversation history for a session
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return sessions.get(sessionId);
  }

  /**
   * End and remove a conversation session
   */
  endSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
  }

  /**
   * Get statistics across all active sessions (scoped to org if provided)
   */
  getActiveSessions(orgId?: number): ConversationSession[] {
    const all = Array.from(sessions.values());
    if (orgId !== undefined) {
      return all.filter(s => s.organizationId === orgId);
    }
    return all;
  }

  // ─── State Machine ─────────────────────────────────────────────────────────

  private async advanceState(session: ConversationSession, message: string): Promise<ConversationResponse> {
    const normalizedMsg = message.toLowerCase().trim();

    switch (session.state) {
      case 'greeting':
        return this.handleGreeting(session);

      case 'gathering_info':
        return this.handleGatheringInfo(session, normalizedMsg);

      case 'searching_solution':
        return this.handleSearchingSolution(session, normalizedMsg);

      case 'confirming_ticket':
        return this.handleConfirmingTicket(session, normalizedMsg);

      case 'resolved':
      case 'ticket_created':
        // Session is done, start a new flow
        session.state = 'greeting';
        session.entities = {};
        session.kbArticleShown = undefined;
        session.createdTicketId = undefined;
        return this.handleGreeting(session);

      default:
        return {
          type: 'text',
          text: 'Desculpe, algo deu errado. Poderia descrever novamente o seu problema?',
        };
    }
  }

  private async handleGreeting(session: ConversationSession): Promise<ConversationResponse> {
    const entities = session.entities;

    // If we already have enough info from the first message, search KB
    if (entities.category || entities.raw_intent) {
      return this.searchAndRespond(session);
    }

    session.state = 'gathering_info';
    return {
      type: 'text',
      text: 'Entendi! Poderia descrever com mais detalhes o que está acontecendo? Por exemplo: qual sistema ou equipamento está com problema e desde quando isso ocorre?',
      quickReplies: [
        'Problema com email',
        'Computador lento',
        'Preciso de acesso',
        'Impressora não funciona',
      ],
    };
  }

  private async handleGatheringInfo(session: ConversationSession, _normalizedMsg: string): Promise<ConversationResponse> {
    return this.searchAndRespond(session);
  }

  private async handleSearchingSolution(session: ConversationSession, normalizedMsg: string): Promise<ConversationResponse> {
    // User responded to solution suggestion
    const positiveResponses = ['sim', 'resolveu', 'obrigado', 'funcionou', 'valeu', 'isso', 'perfeito', 'deu certo', 'ok', 'ótimo'];
    const negativeResponses = ['não', 'nao', 'não resolveu', 'não funcionou', 'continua', 'ainda', 'preciso de ajuda', 'abrir ticket'];

    const isPositive = positiveResponses.some(r => normalizedMsg.includes(r));
    const isNegative = negativeResponses.some(r => normalizedMsg.includes(r));

    if (isPositive) {
      session.state = 'resolved';

      // Track deflection
      await this.trackDeflection(session);

      return {
        type: 'resolved',
        text: 'Fico feliz que tenha resolvido! Se precisar de mais alguma coisa, é só me chamar. 😊',
        quickReplies: ['Tenho outro problema', 'Obrigado, só isso'],
      };
    }

    if (isNegative) {
      session.state = 'confirming_ticket';
      return this.buildTicketConfirmation(session);
    }

    // Ambiguous — extract more info and ask again
    return {
      type: 'text',
      text: 'A solução sugerida resolveu o seu problema?',
      quickReplies: ['Sim, resolveu!', 'Não, preciso de ajuda'],
    };
  }

  private async handleConfirmingTicket(session: ConversationSession, normalizedMsg: string): Promise<ConversationResponse> {
    const confirmResponses = ['confirmar', 'sim', 'criar', 'abrir', 'ok', 'pode criar', 'confirmo'];
    const cancelResponses = ['cancelar', 'não', 'voltar', 'nao'];

    const isConfirm = confirmResponses.some(r => normalizedMsg.includes(r));
    const isCancel = cancelResponses.some(r => normalizedMsg.includes(r));

    if (isConfirm) {
      return this.createTicket(session);
    }

    if (isCancel) {
      session.state = 'gathering_info';
      return {
        type: 'text',
        text: 'Ok, voltamos ao chat. Como posso ajudar?',
        quickReplies: ['Descrever problema novamente', 'Encerrar conversa'],
      };
    }

    // Treat as additional info for the ticket
    return {
      type: 'text',
      text: 'Deseja confirmar a criação do ticket com as informações apresentadas?',
      quickReplies: ['Confirmar e criar ticket', 'Voltar ao chat'],
    };
  }

  // ─── KB Search ──────────────────────────────────────────────────────────────

  private async searchAndRespond(session: ConversationSession): Promise<ConversationResponse> {
    const entities = session.entities;
    const lastUserMsg = session.messages
      .filter(m => m.role === 'user')
      .pop()?.text || '';

    // Search knowledge base
    const kbMatch = await this.searchKnowledgeBase(session.organizationId, lastUserMsg, entities);

    if (kbMatch) {
      session.state = 'searching_solution';
      session.kbArticleShown = kbMatch.id;

      return {
        type: 'solution_card',
        text: 'Encontrei um artigo que pode ajudar com o seu problema:',
        data: {
          article: {
            id: kbMatch.id,
            title: kbMatch.title,
            summary: kbMatch.summary.substring(0, 200),
            content: kbMatch.content,
            confidence: kbMatch.confidence,
          },
        },
        quickReplies: ['Sim, resolveu!', 'Não, preciso de ajuda'],
      };
    }

    // No KB match — go straight to ticket confirmation
    session.state = 'confirming_ticket';
    return this.buildTicketConfirmation(session);
  }

  private async searchKnowledgeBase(
    orgId: number,
    queryText: string,
    entities: ExtractedEntities
  ): Promise<KBMatch | null> {
    try {
      const searchTerms: string[] = [];
      if (entities.category) searchTerms.push(entities.category);
      if (entities.service) searchTerms.push(entities.service);

      // Build search keywords from query
      const words = queryText
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5);
      searchTerms.push(...words);

      if (searchTerms.length === 0) return null;

      // Search with LIKE across title and content
      const likeClauses: string[] = [];
      const params: SqlParam[] = [orgId];

      for (const term of searchTerms.slice(0, 4)) {
        const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
        likeClauses.push("(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')");
        params.push(`%${escaped}%`, `%${escaped}%`);
      }

      if (likeClauses.length === 0) return null;

      const sql = `
        SELECT id, title,
          COALESCE(summary, '') as summary,
          COALESCE(content, '') as content
        FROM kb_articles
        WHERE organization_id = ?
          AND status = 'published'
          AND (${likeClauses.join(' OR ')})
        LIMIT 1
      `;

      const article = await executeQueryOne<{
        id: number;
        title: string;
        summary: string;
        content: string;
      }>(sql, params);

      if (article) {
        return {
          ...article,
          confidence: 0.7 + (searchTerms.length > 2 ? 0.15 : 0),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  // ─── Ticket Creation ────────────────────────────────────────────────────────

  private buildTicketConfirmation(session: ConversationSession): ConversationResponse {
    const entities = session.entities;
    const conversationSummary = session.messages
      .filter(m => m.role === 'user')
      .map(m => m.text)
      .join('\n');

    const title = this.generateTicketTitle(entities, conversationSummary);
    const category = entities.category || 'Geral';
    const urgency = this.mapUrgencyToLabel(entities.urgency);

    return {
      type: 'ticket_confirmation',
      text: 'Com base na nossa conversa, preparei o seguinte ticket. Confira as informações e confirme:',
      data: {
        ticket: {
          title,
          category,
          urgency,
          description: conversationSummary,
          service: entities.service,
          error_message: entities.error_message,
          affected_users: entities.affected_users,
          since_when: entities.since_when,
        },
      },
      quickReplies: ['Confirmar e criar ticket', 'Voltar ao chat'],
    };
  }

  private async createTicket(session: ConversationSession): Promise<ConversationResponse> {
    try {
      const entities = session.entities;
      const conversationSummary = session.messages
        .filter(m => m.role === 'user')
        .map(m => `[${m.timestamp.toLocaleTimeString('pt-BR')}] ${m.text}`)
        .join('\n');

      const title = this.generateTicketTitle(entities, conversationSummary);
      const description = this.buildTicketDescription(session, conversationSummary);

      // Resolve category ID
      const categoryId = await this.resolveCategoryId(session.organizationId, entities.category);
      // Resolve priority ID
      const priorityId = await this.resolvePriorityId(session.organizationId, entities.urgency);

      const result = await executeRun(
        `INSERT INTO tickets (
          title, description, category_id, priority_id,
          status_id, user_id, organization_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ${sqlNow()}, ${sqlNow()})`,
        [
          title,
          description,
          categoryId,
          priorityId,
          session.userId,
          session.organizationId,
        ]
      );

      const ticketId = result.lastInsertRowid || 0;
      session.createdTicketId = ticketId as number;
      session.state = 'ticket_created';

      // Add conversation as first comment
      await executeRun(
        `INSERT INTO comments (
          ticket_id, user_id, content, is_internal,
          created_at, updated_at
        ) VALUES (?, ?, ?, 1, ${sqlNow()}, ${sqlNow()})`,
        [
          ticketId,
          session.userId,
          `[Conversa via Assistente Virtual]\n\n${conversationSummary}`,
          1,
        ]
      );

      return {
        type: 'text',
        text: `Ticket #${ticketId} criado com sucesso! Você pode acompanhar o andamento pela sua área de tickets. Nossa equipe já foi notificada e entrará em contato em breve.`,
        data: {
          ticketId,
          ticketUrl: `/portal/tickets/${ticketId}`,
        },
        quickReplies: ['Tenho outro problema', 'Obrigado, só isso'],
      };
    } catch {
      return {
        type: 'text',
        text: 'Desculpe, ocorreu um erro ao criar o ticket. Por favor, tente novamente ou acesse a página de criação de tickets manualmente.',
        quickReplies: ['Tentar novamente', 'Criar ticket manualmente'],
      };
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateTicketTitle(entities: ExtractedEntities, conversationText: string): string {
    const parts: string[] = [];

    if (entities.raw_intent) {
      const intentLabels: Record<string, string> = {
        problema_funcionamento: 'Problema de funcionamento',
        solicitar_acesso: 'Solicitação de acesso',
        instalacao: 'Solicitação de instalação',
        substituicao: 'Substituição de equipamento',
        duvida: 'Dúvida',
        reset_senha: 'Reset de senha',
      };
      parts.push(intentLabels[entities.raw_intent] || 'Solicitação');
    }

    if (entities.service) {
      parts.push(`- ${entities.service}`);
    } else if (entities.category) {
      parts.push(`- ${entities.category}`);
    }

    if (parts.length > 0) {
      return parts.join(' ').substring(0, 150);
    }

    // Fallback: first user message truncated
    const firstMsg = conversationText.split('\n')[0] || 'Solicitação via assistente virtual';
    return firstMsg.substring(0, 150);
  }

  private buildTicketDescription(session: ConversationSession, conversationSummary: string): string {
    const entities = session.entities;
    const lines: string[] = ['**Ticket criado via Assistente Virtual**\n'];

    if (entities.category) lines.push(`**Categoria detectada:** ${entities.category}`);
    if (entities.service) lines.push(`**Serviço:** ${entities.service}`);
    if (entities.error_message) lines.push(`**Mensagem de erro:** ${entities.error_message}`);
    if (entities.affected_users) lines.push(`**Usuários afetados:** ${entities.affected_users}`);
    if (entities.since_when) lines.push(`**Desde quando:** ${entities.since_when}`);

    lines.push('\n---\n**Descrição do problema:**');
    lines.push(conversationSummary);

    if (session.kbArticleShown) {
      lines.push(`\n---\n*Artigo KB #${session.kbArticleShown} foi sugerido mas não resolveu.*`);
    }

    return lines.join('\n');
  }

  private async resolveCategoryId(orgId: number, categoryName?: string): Promise<number> {
    if (!categoryName) return 1; // Default category

    try {
      const escaped = categoryName.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const cat = await executeQueryOne<{ id: number }>(
        "SELECT id FROM categories WHERE organization_id = ? AND name LIKE ? ESCAPE '\\' LIMIT 1",
        [orgId, `%${escaped}%`]
      );
      return cat?.id || 1;
    } catch {
      return 1;
    }
  }

  private async resolvePriorityId(orgId: number, urgency?: string): Promise<number> {
    if (!urgency) return 2; // Default medium

    const priorityMap: Record<string, string> = {
      high: 'Alta',
      low: 'Baixa',
      medium: 'Média',
    };

    const label = priorityMap[urgency] || 'Média';

    try {
      const escaped = label.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const prio = await executeQueryOne<{ id: number }>(
        "SELECT id FROM priorities WHERE organization_id = ? AND name LIKE ? ESCAPE '\\' LIMIT 1",
        [orgId, `%${escaped}%`]
      );
      return prio?.id || 2;
    } catch {
      return 2;
    }
  }

  private mapUrgencyToLabel(urgency?: string): string {
    switch (urgency) {
      case 'high': return 'Alta';
      case 'low': return 'Baixa';
      default: return 'Média';
    }
  }

  private async trackDeflection(session: ConversationSession): Promise<void> {
    try {
      // Log the deflection as an analytics event
      await executeRun(
        `INSERT INTO analytics_events (
          event_type, event_data, user_id, organization_id, created_at
        ) VALUES ('conversation_deflection', ?, ?, ?, ${sqlNow()})`,
        [
          JSON.stringify({
            session_id: session.sessionId,
            category: session.entities.category,
            kb_article_id: session.kbArticleShown,
            message_count: session.messages.length,
          }),
          session.userId,
          session.organizationId,
        ]
      );
    } catch {
      // Non-critical — don't fail the conversation
    }
  }
}

export const conversationEngine = new ConversationEngine();
