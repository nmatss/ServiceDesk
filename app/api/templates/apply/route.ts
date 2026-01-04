import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// POST - Aplicar template
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, variables = {}, ticket_id } = body;

    // Validar dados obrigatórios
    if (!template_id) {
      return NextResponse.json({
        error: 'ID do template é obrigatório'
      }, { status: 400 });
    }

    // Buscar template
    const template = db.prepare(`
      SELECT * FROM templates
      WHERE id = ? AND is_active = 1
    `).get(template_id);

    if (!template) {
      return NextResponse.json({
        error: 'Template não encontrado ou inativo'
      }, { status: 404 });
    }

    // Processar variáveis do template
    const templateVariables = (template as any).variables ? JSON.parse((template as any).variables) : {};
    let processedTitle = (template as any).title_template || '';
    let processedContent = (template as any).content_template || '';

    // Buscar dados do ticket se fornecido
    let ticketData: any = null;
    if (ticket_id) {
      ticketData = db.prepare(`
        SELECT
          t.*,
          u.name as user_name,
          u.email as user_email,
          c.name as category_name,
          p.name as priority_name,
          s.name as status_name,
          a.name as assigned_to_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = ?
      `).get(ticket_id);

      if (!ticketData) {
        return NextResponse.json({
          error: 'Ticket não encontrado'
        }, { status: 404 });
      }
    }

    // Variáveis disponíveis para substituição
    const availableVariables = {
      // Variáveis do usuário atual
      current_user_name: user.name,
      current_user_email: user.email,
      current_date: new Date().toLocaleDateString('pt-BR'),
      current_time: new Date().toLocaleTimeString('pt-BR'),
      current_datetime: new Date().toLocaleString('pt-BR'),

      // Variáveis do ticket (se fornecido)
      ...(ticketData && {
        ticket_id: ticketData.id,
        ticket_title: ticketData.title,
        ticket_description: ticketData.description,
        ticket_user_name: ticketData.user_name,
        ticket_user_email: ticketData.user_email,
        ticket_category: ticketData.category_name,
        ticket_priority: ticketData.priority_name,
        ticket_status: ticketData.status_name,
        ticket_assigned_to: ticketData.assigned_to_name,
        ticket_created_at: new Date(ticketData.created_at).toLocaleString('pt-BR'),
        ticket_updated_at: new Date(ticketData.updated_at).toLocaleString('pt-BR')
      }),

      // Variáveis customizadas fornecidas
      ...variables
    };

    // Função para substituir variáveis
    const replaceVariables = (text: string) => {
      return text.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const trimmedName = variableName.trim();
        return availableVariables[trimmedName] || match;
      });
    };

    // Processar título e conteúdo
    if (processedTitle) {
      processedTitle = replaceVariables(processedTitle);
    }

    if (processedContent) {
      processedContent = replaceVariables(processedContent);
    }

    // Registrar uso do template
    db.prepare(`
      INSERT INTO template_usage (template_id, used_by, ticket_id, used_at)
      VALUES (?, ?, ?, ?)
    `).run(
      template_id,
      user.id,
      ticket_id || null,
      new Date().toISOString()
    );

    // Incrementar contador de uso
    db.prepare(`
      UPDATE templates
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(template_id);

    return NextResponse.json({
      success: true,
      template: {
        id: (template as any).id,
        name: (template as any).name,
        type: (template as any).type,
        processed_title: processedTitle,
        processed_content: processedContent,
        original_title: (template as any).title_template,
        original_content: (template as any).content_template,
        variables_used: Object.keys(availableVariables)
      }
    });

  } catch (error) {
    logger.error('Erro ao aplicar template', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// GET - Visualizar template processado
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');
    const ticketId = searchParams.get('ticket_id');

    if (!templateId) {
      return NextResponse.json({
        error: 'ID do template é obrigatório'
      }, { status: 400 });
    }

    // Buscar template
    const template = db.prepare(`
      SELECT * FROM templates
      WHERE id = ? AND is_active = 1
    `).get(parseInt(templateId));

    if (!template) {
      return NextResponse.json({
        error: 'Template não encontrado ou inativo'
      }, { status: 404 });
    }

    // Buscar variáveis disponíveis
    const templateVariables = (template as any).variables ? JSON.parse((template as any).variables) : {};

    // Variáveis básicas
    const availableVariables = {
      current_user_name: user.name,
      current_user_email: user.email,
      current_date: new Date().toLocaleDateString('pt-BR'),
      current_time: new Date().toLocaleTimeString('pt-BR'),
      current_datetime: new Date().toLocaleString('pt-BR')
    };

    // Se ticket foi fornecido, buscar dados
    if (ticketId) {
      const ticketData = db.prepare(`
        SELECT
          t.*,
          u.name as user_name,
          u.email as user_email,
          c.name as category_name,
          p.name as priority_name,
          s.name as status_name,
          a.name as assigned_to_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = ?
      `).get(parseInt(ticketId));

      if (ticketData) {
        Object.assign(availableVariables, {
          ticket_id: (ticketData as any).id,
          ticket_title: (ticketData as any).title,
          ticket_description: (ticketData as any).description,
          ticket_user_name: (ticketData as any).user_name,
          ticket_user_email: (ticketData as any).user_email,
          ticket_category: (ticketData as any).category_name,
          ticket_priority: (ticketData as any).priority_name,
          ticket_status: (ticketData as any).status_name,
          ticket_assigned_to: (ticketData as any).assigned_to_name,
          ticket_created_at: new Date((ticketData as any).created_at).toLocaleString('pt-BR'),
          ticket_updated_at: new Date((ticketData as any).updated_at).toLocaleString('pt-BR')
        });
      }
    }

    return NextResponse.json({
      success: true,
      template: {
        id: (template as any).id,
        name: (template as any).name,
        description: (template as any).description,
        type: (template as any).type,
        title_template: (template as any).title_template,
        content_template: (template as any).content_template,
        variables: templateVariables,
        available_variables: availableVariables,
        usage_count: (template as any).usage_count || 0,
        last_used_at: (template as any).last_used_at
      }
    });

  } catch (error) {
    logger.error('Erro ao visualizar template', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}