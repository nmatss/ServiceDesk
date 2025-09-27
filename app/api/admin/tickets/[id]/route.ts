import { NextRequest, NextResponse } from 'next/server';
import { ticketQueries } from '@/lib/db/queries';
import { verifyToken } from '@/lib/auth/sqlite-auth';

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

    // Apenas admins e agentes podem acessar
    if (user.role !== 'admin' && user.role !== 'agent') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
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

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Erro ao buscar ticket:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
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

    // Apenas admins e agentes podem editar tickets
    if (user.role !== 'admin' && user.role !== 'agent') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
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

    const body = await request.json();
    const { title, description, category_id, priority_id, status_id, assigned_to } = body;

    // Validar dados
    if (title && title.trim().length === 0) {
      return NextResponse.json({ error: 'Título não pode estar vazio' }, { status: 400 });
    }

    if (description && description.trim().length === 0) {
      return NextResponse.json({ error: 'Descrição não pode estar vazia' }, { status: 400 });
    }

    const updatedTicket = ticketQueries.update({
      id: ticketId,
      title: title?.trim(),
      description: description?.trim(),
      category_id,
      priority_id,
      status_id,
      assigned_to
    });

    return NextResponse.json({ ticket: updatedTicket });
  } catch (error) {
    console.error('Erro ao atualizar ticket:', error);
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

    // Apenas admins podem deletar tickets
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
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

    const success = ticketQueries.delete(ticketId);
    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar ticket' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Ticket deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar ticket:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
