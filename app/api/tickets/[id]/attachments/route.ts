import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_ATTACHMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let attachments: Array<Record<string, unknown>> = []
    try {
      attachments = await executeQuery<Record<string, unknown>>(`
        SELECT
          a.id,
          a.ticket_id,
          a.filename,
          a.original_name,
          a.mime_type,
          a.file_size,
          a.file_path,
          a.uploaded_by,
          a.created_at
        FROM attachments a
        LEFT JOIN users uploader ON a.uploaded_by = uploader.id AND uploader.tenant_id = ?
        WHERE a.ticket_id = ?
          AND a.tenant_id = ?
          AND (a.uploaded_by IS NULL OR uploader.id IS NOT NULL)
        ORDER BY a.created_at ASC
      `, [tenantContext.id, ticketId, tenantContext.id])
    } catch {
      try {
        attachments = await executeQuery<Record<string, unknown>>(`
          SELECT
            a.id,
            a.ticket_id,
            a.filename,
            a.original_name,
            a.mime_type,
            a.size as file_size,
            NULL as file_path,
            a.uploaded_by,
            a.created_at
          FROM attachments a
          LEFT JOIN users uploader ON a.uploaded_by = uploader.id AND uploader.tenant_id = ?
          WHERE a.ticket_id = ?
            AND a.organization_id = ?
            AND (a.uploaded_by IS NULL OR uploader.id IS NOT NULL)
          ORDER BY a.created_at ASC
        `, [tenantContext.id, ticketId, tenantContext.id])
      } catch {
        attachments = await executeQuery<Record<string, unknown>>(`
          SELECT
            a.id,
            a.ticket_id,
            a.filename,
            a.original_filename as original_name,
            a.mime_type,
            a.file_size,
            a.storage_path as file_path,
            a.uploaded_by,
            a.created_at
          FROM attachments a
          LEFT JOIN users uploader ON a.uploaded_by = uploader.id AND uploader.tenant_id = ?
          WHERE a.ticket_id = ?
            AND (a.uploaded_by IS NULL OR uploader.id IS NOT NULL)
          ORDER BY a.created_at ASC
        `, [tenantContext.id, ticketId])
      }
    }

    return NextResponse.json({ attachments });
  } catch (error) {
    logger.error('Erro ao buscar anexos', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_ATTACHMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    // Validar tamanho do arquivo (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB' }, { status: 400 });
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 });
    }

    // Criar diretório de uploads se não existir
    const uploadsDir = join(process.cwd(), 'uploads', 'attachments');
    await mkdir(uploadsDir, { recursive: true });

    // Gerar nome único para o arquivo
    const fileExtension = file.name.split('.').pop();
    const filename = `${randomUUID()}.${fileExtension}`;
    const filepath = join(uploadsDir, filename);

    // Salvar arquivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Salvar informações no banco (schema-compatible fallback)
    let attachmentId: number | undefined
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO attachments (
          tenant_id, ticket_id, filename, original_name,
          mime_type, file_size, file_path, uploaded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `, [
        tenantContext.id,
        ticketId,
        filename,
        file.name,
        file.type,
        file.size,
        filepath,
        userContext.id,
      ])
      attachmentId = inserted?.id
    } catch {
      try {
        const result = await executeRun(`
          INSERT INTO attachments (ticket_id, filename, original_name, mime_type, size, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [ticketId, filename, file.name, file.type, file.size, userContext.id])
        if (typeof result.lastInsertRowid === 'number') {
          attachmentId = result.lastInsertRowid
        }
      } catch {
        const result = await executeRun(`
          INSERT INTO attachments (
            tenant_id, ticket_id, filename, original_filename,
            file_size, mime_type, storage_path, uploaded_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantContext.id,
          ticketId,
          filename,
          file.name,
          file.size,
          file.type,
          filepath,
          userContext.id,
        ])
        if (typeof result.lastInsertRowid === 'number') {
          attachmentId = result.lastInsertRowid
        }
      }
    }

    let attachment: Record<string, unknown> | null = null
    if (attachmentId) {
      attachment = await executeQueryOne<Record<string, unknown>>(
        'SELECT * FROM attachments WHERE id = ? AND tenant_id = ?',
        [attachmentId, tenantContext.id]
      ) ?? null

      if (!attachment) {
        attachment = await executeQueryOne<Record<string, unknown>>(
          'SELECT * FROM attachments WHERE id = ? AND organization_id = ?',
          [attachmentId, tenantContext.id]
        ) ?? null
      }

      if (!attachment) {
        attachment = await executeQueryOne<Record<string, unknown>>(
          'SELECT * FROM attachments WHERE id = ?',
          [attachmentId]
        ) ?? null
      }
    }

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    logger.error('Erro ao fazer upload do anexo', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
