import { NextRequest, NextResponse } from 'next/server';
import { attachmentQueries, ticketQueries } from '@/lib/db/queries';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_ATTACHMENT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = ticketQueries.getById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    if (user.role === 'user' && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const attachments = attachmentQueries.getByTicketId(ticketId, user.organization_id);
    return NextResponse.json({ attachments });
  } catch (error) {
    logger.error('Erro ao buscar anexos', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_ATTACHMENT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = ticketQueries.getById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    if (user.role === 'user' && ticket.user_id !== user.id) {
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

    // Salvar informações no banco
    const attachment = attachmentQueries.create({
      ticket_id: ticketId,
      filename,
      original_name: file.name,
      mime_type: file.type,
      size: file.size,
      uploaded_by: user.id
    }, user.organization_id);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    logger.error('Erro ao fazer upload do anexo', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
