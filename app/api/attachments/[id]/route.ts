import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import {
  getTenantContextFromRequest,
  getUserContextFromRequest,
  validateTenantAccess,
} from '@/lib/tenant/context';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

type AttachmentRow = {
  id: number;
  ticket_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  tenant_id?: number;
  ticket_owner_id: number;
};

const TICKET_ELEVATED_ROLES = ['super_admin', 'tenant_admin', 'team_manager', 'admin', 'agent', 'manager'];
const ATTACHMENT_DELETE_ROLES = ['super_admin', 'tenant_admin', 'team_manager', 'admin'];

function isPositiveInteger(value: string): boolean {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0;
}

async function getAttachmentByIdScoped(attachmentId: number, tenantId: number): Promise<AttachmentRow | undefined> {
  try {
    return await executeQueryOne<AttachmentRow | undefined>(`
      SELECT
        a.id,
        a.ticket_id,
        a.filename,
        a.original_name,
        a.mime_type,
        a.size,
        a.uploaded_by,
        a.tenant_id,
        t.user_id as ticket_owner_id
      FROM attachments a
      INNER JOIN tickets t ON t.id = a.ticket_id
      WHERE a.id = ? AND a.tenant_id = ? AND t.tenant_id = ?
      LIMIT 1
    `, [attachmentId, tenantId, tenantId]);
  } catch {
    return await executeQueryOne<AttachmentRow | undefined>(`
      SELECT
        a.id,
        a.ticket_id,
        a.filename,
        a.original_name,
        a.mime_type,
        a.size,
        a.uploaded_by,
        a.tenant_id,
        t.user_id as ticket_owner_id
      FROM attachments a
      INNER JOIN tickets t ON t.id = a.ticket_id
      WHERE a.id = ? AND t.organization_id = ?
      LIMIT 1
    `, [attachmentId, tenantId]);
  }
}

async function deleteAttachmentScoped(attachmentId: number, tenantId: number): Promise<boolean> {
  try {
    const result = await executeRun(`
      DELETE FROM attachments
      WHERE id = ? AND tenant_id = ?
    `, [attachmentId, tenantId]);
    return result.changes > 0;
  } catch {
    const result = await executeRun(`
      DELETE FROM attachments
      WHERE id = ?
        AND ticket_id IN (
          SELECT id FROM tickets WHERE organization_id = ?
        )
    `, [attachmentId, tenantId]);
    return result.changes > 0;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    if (!validateTenantAccess(userContext, tenantContext)) {
      return NextResponse.json({ error: 'Acesso negado - mismatch de tenant' }, { status: 403 });
    }

    const { id } = await params;
    if (!isPositiveInteger(id)) {
      return NextResponse.json({ error: 'ID do anexo inválido' }, { status: 400 });
    }
    const attachmentId = Number.parseInt(id, 10);

    const attachment = await getAttachmentByIdScoped(attachmentId, tenantContext.id);
    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    const canAccessTicket =
      TICKET_ELEVATED_ROLES.includes(userContext.role) ||
      attachment.ticket_owner_id === userContext.id;
    if (!canAccessTicket) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const safeFilename = basename(attachment.filename);
    if (safeFilename !== attachment.filename) {
      logger.warn('Attachment filename rejected due to unsafe path characters', {
        attachmentId,
        tenantId: tenantContext.id,
      });
      return NextResponse.json({ error: 'Anexo inválido' }, { status: 400 });
    }

    // Ler arquivo do disco
    const filepath = join(process.cwd(), 'uploads', 'attachments', safeFilename);

    try {
      const fileBuffer = await readFile(filepath);

      return new NextResponse(fileBuffer as any, {
        headers: {
          'Content-Type': attachment.mime_type,
          'Content-Disposition': `attachment; filename="${attachment.original_name}"`,
          'Content-Length': attachment.size.toString(),
        },
      });
    } catch (fileError) {
      logger.error('Erro ao ler arquivo', fileError);
      return NextResponse.json({ error: 'Arquivo não encontrado no servidor' }, { status: 404 });
    }
  } catch (error) {
    logger.error('Erro ao baixar anexo', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    if (!validateTenantAccess(userContext, tenantContext)) {
      return NextResponse.json({ error: 'Acesso negado - mismatch de tenant' }, { status: 403 });
    }

    const { id } = await params;
    if (!isPositiveInteger(id)) {
      return NextResponse.json({ error: 'ID do anexo inválido' }, { status: 400 });
    }
    const attachmentId = Number.parseInt(id, 10);

    const attachment = await getAttachmentByIdScoped(attachmentId, tenantContext.id);
    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    const canDelete =
      attachment.uploaded_by === userContext.id ||
      ATTACHMENT_DELETE_ROLES.includes(userContext.role);
    if (!canDelete) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const success = await deleteAttachmentScoped(attachmentId, tenantContext.id);
    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar anexo' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Anexo deletado com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar anexo', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
