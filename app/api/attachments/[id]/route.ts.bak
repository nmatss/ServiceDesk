import { NextRequest, NextResponse } from 'next/server';
import { attachmentQueries, ticketQueries } from '@/lib/db/queries';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '@/lib/monitoring/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const attachmentId = parseInt(id);

    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: 'ID do anexo inválido' }, { status: 400 });
    }

    const attachment = attachmentQueries.getById(attachmentId, user.organization_id);
    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    const ticket = ticketQueries.getById(attachment.ticket_id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    if (user.role === 'user' && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Ler arquivo do disco
    const filepath = join(process.cwd(), 'uploads', 'attachments', attachment.filename);
    
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
    const attachmentId = parseInt(id);

    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: 'ID do anexo inválido' }, { status: 400 });
    }

    const attachment = attachmentQueries.getById(attachmentId, user.organization_id);
    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    // Verificar permissões - apenas quem fez upload ou admin pode deletar
    if (user.role !== 'admin' && attachment.uploaded_by !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const success = attachmentQueries.delete(attachmentId, user.organization_id);
    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar anexo' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Anexo deletado com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar anexo', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
