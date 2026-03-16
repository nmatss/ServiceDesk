/**
 * Action Executor for Autonomous AI Agent
 *
 * Executes resolved actions on tickets: posts comments, updates status,
 * and creates audit trail entries. Each intent type has a specific handler.
 */

import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne, executeRun, sqlNow, type SqlParam } from '@/lib/db/adapter';
import type { Intent, IntentType } from './intent-resolver';
import type { KBMatch } from './confidence-gate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType = 'auto_resolved' | 'suggestion_posted' | 'escalated';

export interface ActionResult {
  success: boolean;
  actionType: ActionType;
  commentId?: number;
  response?: string;
  escalatedTo?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Default response templates (Portuguese)
// ---------------------------------------------------------------------------

const DEFAULT_RESPONSES: Partial<Record<IntentType, string>> = {
  password_reset: [
    '**Redefinição de Senha — Instruções Automáticas**\n\n',
    'Para redefinir sua senha, siga os passos abaixo:\n\n',
    '1. Acesse a página de login do sistema\n',
    '2. Clique em **"Esqueci minha senha"**\n',
    '3. Informe seu e-mail corporativo\n',
    '4. Verifique sua caixa de entrada (e a pasta de spam) para o link de redefinição\n',
    '5. Crie uma nova senha seguindo a política de segurança (mínimo 8 caracteres, incluindo maiúscula, minúscula e número)\n\n',
    'Se o problema persistir, este ticket será encaminhado para um analista.',
  ].join(''),
  account_unlock: [
    '**Desbloqueio de Conta — Instruções Automáticas**\n\n',
    'Sua conta pode ter sido bloqueada por excesso de tentativas de login.\n\n',
    '1. Aguarde **15 minutos** e tente novamente\n',
    '2. Certifique-se de que o **Caps Lock** está desligado\n',
    '3. Se ainda estiver bloqueado, utilize a opção **"Esqueci minha senha"** para redefinir\n\n',
    'Caso o problema persista após esses passos, um analista será notificado.',
  ].join(''),
  access_request: [
    '**Solicitação de Acesso — Resposta Automática**\n\n',
    'Sua solicitação de acesso foi registrada e está sendo processada.\n\n',
    'Para agilizar, certifique-se de que:\n',
    '- Seu gestor direto aprovou a solicitação\n',
    '- O sistema/recurso solicitado está especificado no ticket\n',
    '- Sua justificativa de negócio está descrita\n\n',
    'Prazo estimado: **até 2 dias úteis** após aprovação do gestor.',
  ].join(''),
  software_install: [
    '**Instalação de Software — Resposta Automática**\n\n',
    'Sua solicitação de instalação foi recebida.\n\n',
    'Próximos passos:\n',
    '1. Verificaremos se o software está na lista de softwares homologados\n',
    '2. A licença será validada/adquirida se necessário\n',
    '3. A instalação será agendada em até **3 dias úteis**\n\n',
    'Se o software já estiver disponível no Portal de Self-Service, você pode instalá-lo diretamente.',
  ].join(''),
  information_query: [
    '**Consulta — Resposta Automática**\n\n',
    'Obrigado pela sua pergunta. Localizamos informações relevantes na nossa base de conhecimento.\n\n',
  ].join(''),
  troubleshooting: [
    '**Troubleshooting — Resposta Automática**\n\n',
    'Identificamos o tipo de problema reportado. Tente os seguintes passos:\n\n',
    '1. Reinicie o aplicativo/serviço afetado\n',
    '2. Limpe o cache do navegador (Ctrl+Shift+Delete)\n',
    '3. Verifique sua conexão de rede\n',
    '4. Tente acessar de outro navegador ou modo anônimo\n\n',
    'Se o problema persistir após esses passos, um analista será acionado.',
  ].join(''),
  status_inquiry: [
    '**Consulta de Status — Resposta Automática**\n\n',
    'Verificamos o status dos seus chamados recentes.\n\n',
  ].join(''),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the "resolved" status ID for the org */
async function getResolvedStatusId(orgId: number): Promise<number | null> {
  const row = await executeQueryOne<{ id: number }>(
    `SELECT id FROM statuses
     WHERE LOWER(name) IN ('resolved', 'resolvido')
       AND organization_id = ?
     LIMIT 1`,
    [orgId] as SqlParam[]
  );
  return row?.id ?? null;
}

/** Get the system/bot user ID for the org (or use ID 1 as fallback) */
async function getBotUserId(orgId: number): Promise<number> {
  const row = await executeQueryOne<{ id: number }>(
    `SELECT id FROM users
     WHERE (LOWER(email) LIKE '%bot%' OR LOWER(email) LIKE '%system%' OR LOWER(name) LIKE '%bot%')
       AND organization_id = ?
     LIMIT 1`,
    [orgId] as SqlParam[]
  );
  return row?.id ?? 1;
}

/** Insert a comment on the ticket */
async function postComment(
  ticketId: number,
  userId: number,
  content: string,
  isInternal: boolean,
  orgId: number,
): Promise<number | undefined> {
  const result = await executeRun(
    `INSERT INTO comments (ticket_id, user_id, content, is_internal, organization_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()})`,
    [ticketId, userId, content, isInternal ? 1 : 0, orgId] as SqlParam[]
  );
  return result.lastInsertRowid as number | undefined;
}

/** Log an activity on the ticket */
async function logActivity(
  ticketId: number,
  orgId: number,
  activityType: string,
  description: string,
  userId: number,
): Promise<void> {
  await executeRun(
    `INSERT INTO ticket_activities (ticket_id, organization_id, activity_type, description, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ${sqlNow()})`,
    [ticketId, orgId, activityType, description, userId] as SqlParam[]
  );
}

// ---------------------------------------------------------------------------
// ActionExecutor
// ---------------------------------------------------------------------------

export class ActionExecutor {
  /**
   * Execute the resolved action on a ticket.
   */
  async execute(
    orgId: number,
    ticketId: number,
    intent: Intent,
    action: 'auto_resolve' | 'suggest' | 'escalate',
    kbSolution?: KBMatch | null,
  ): Promise<ActionResult> {
    const botUserId = await getBotUserId(orgId);

    try {
      if (action === 'auto_resolve') {
        return await this.autoResolve(orgId, ticketId, intent, botUserId, kbSolution);
      } else if (action === 'suggest') {
        return await this.postSuggestion(orgId, ticketId, intent, botUserId, kbSolution);
      } else {
        return await this.escalate(orgId, ticketId, intent, botUserId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`ActionExecutor failed for ticket #${ticketId}: ${message}`, {
        type: 'ai_agent',
        ticketId,
        orgId,
        error: message,
      });
      return { success: false, actionType: 'escalated', error: message };
    }
  }

  // -------------------------------------------------------------------------
  // Auto-resolve
  // -------------------------------------------------------------------------

  private async autoResolve(
    orgId: number,
    ticketId: number,
    intent: Intent,
    botUserId: number,
    kbSolution?: KBMatch | null,
  ): Promise<ActionResult> {
    // Build response text
    let response = DEFAULT_RESPONSES[intent.type] || '';

    if (kbSolution) {
      response += `\n\n---\n📚 **Artigo relacionado:** ${kbSolution.title}\n\n${kbSolution.content.substring(0, 1500)}`;
      if (kbSolution.content.length > 1500) {
        response += '\n\n*(Conteúdo resumido — consulte o artigo completo na Base de Conhecimento)*';
      }
    }

    response += '\n\n---\n🤖 *Resolvido automaticamente pelo Agente AI. Se esta resposta não resolveu seu problema, reabra o ticket.*';

    // Post the comment
    const commentId = await postComment(ticketId, botUserId, response, false, orgId);

    // Update ticket status to resolved
    const resolvedStatusId = await getResolvedStatusId(orgId);
    if (resolvedStatusId) {
      await executeRun(
        `UPDATE tickets SET status_id = ?, updated_at = ${sqlNow()} WHERE id = ? AND organization_id = ?`,
        [resolvedStatusId, ticketId, orgId] as SqlParam[]
      );
    }

    // Audit trail
    await logActivity(
      ticketId, orgId, 'ai_auto_resolved',
      `Agente AI resolveu automaticamente. Intenção: ${intent.type} (confiança: ${intent.confidence}%)`,
      botUserId,
    );

    logger.info(`Ticket #${ticketId} auto-resolved by AI agent`, {
      type: 'ai_agent',
      ticketId,
      intent: intent.type,
    });

    return {
      success: true,
      actionType: 'auto_resolved',
      commentId,
      response,
    };
  }

  // -------------------------------------------------------------------------
  // Suggest
  // -------------------------------------------------------------------------

  private async postSuggestion(
    orgId: number,
    ticketId: number,
    intent: Intent,
    botUserId: number,
    kbSolution?: KBMatch | null,
  ): Promise<ActionResult> {
    let response = '**💡 Sugestão do Agente AI**\n\n';
    response += DEFAULT_RESPONSES[intent.type] || 'Identificamos seu problema mas não temos certeza suficiente para resolver automaticamente.\n\n';

    if (kbSolution) {
      response += `\n📚 **Artigo sugerido:** ${kbSolution.title}\n\n${kbSolution.content.substring(0, 1000)}`;
    }

    response += '\n\n---\n🤖 *Sugestão automática do Agente AI. Um analista revisará este ticket em breve.*';

    const commentId = await postComment(ticketId, botUserId, response, true, orgId);

    await logActivity(
      ticketId, orgId, 'ai_suggestion_posted',
      `Agente AI postou sugestão. Intenção: ${intent.type} (confiança: ${intent.confidence}%)`,
      botUserId,
    );

    return {
      success: true,
      actionType: 'suggestion_posted',
      commentId,
      response,
    };
  }

  // -------------------------------------------------------------------------
  // Escalate
  // -------------------------------------------------------------------------

  private async escalate(
    orgId: number,
    ticketId: number,
    intent: Intent,
    botUserId: number,
  ): Promise<ActionResult> {
    // Find an available agent to escalate to
    const agent = await executeQueryOne<{ id: number }>(
      `SELECT id FROM users
       WHERE organization_id = ?
         AND role IN ('agent', 'team_manager', 'admin', 'tenant_admin')
         AND is_active = 1
       ORDER BY id
       LIMIT 1`,
      [orgId] as SqlParam[]
    );

    const escalatedTo = agent?.id ?? null;

    // Assign ticket if we found an agent
    if (escalatedTo) {
      await executeRun(
        `UPDATE tickets SET assigned_to = ?, updated_at = ${sqlNow()} WHERE id = ? AND organization_id = ?`,
        [escalatedTo, ticketId, orgId] as SqlParam[]
      );
    }

    const note = [
      '**🔀 Escalação pelo Agente AI**\n\n',
      `O Agente AI analisou este ticket mas a confiança foi insuficiente para resolução automática.\n\n`,
      `**Intenção detectada:** ${intent.type}\n`,
      `**Confiança:** ${intent.confidence}%\n`,
      `**Entidades extraídas:** ${JSON.stringify(intent.entities)}\n\n`,
      'Este ticket requer análise humana.',
    ].join('');

    const commentId = await postComment(ticketId, botUserId, note, true, orgId);

    await logActivity(
      ticketId, orgId, 'ai_escalated',
      `Agente AI escalou ticket. Intenção: ${intent.type} (confiança: ${intent.confidence}%). Escalado para: ${escalatedTo ?? 'fila'}`,
      botUserId,
    );

    logger.info(`Ticket #${ticketId} escalated by AI agent`, {
      type: 'ai_agent',
      ticketId,
      escalatedTo,
    });

    return {
      success: true,
      actionType: 'escalated',
      commentId,
      escalatedTo: escalatedTo ?? undefined,
    };
  }
}

export const actionExecutor = new ActionExecutor();
