import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { getMessagesByContact, getMessagesByTicket } from '@/lib/integrations/whatsapp/storage';
import { createAuditLog } from '@/lib/audit/logger';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

/**
 * GET - Buscar mensagens WhatsApp
 * Busca mensagens por contato ou ticket
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('contactId');
    const ticketId = searchParams.get('ticketId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!contactId && !ticketId) {
      return NextResponse.json(
        { error: 'Either contactId or ticketId is required' },
        { status: 400 }
      );
    }

    let messages;
    if (contactId) {
      messages = await getMessagesByContact(parseInt(contactId), limit, offset);
    } else if (ticketId) {
      messages = await getMessagesByTicket(parseInt(ticketId));
    }

    // Log da consulta
    await createAuditLog({
      user_id: authResult.user?.id,
      action: 'whatsapp_messages_viewed',
      resource_type: 'whatsapp_message',
      new_values: JSON.stringify({
        contactId,
        ticketId,
        messageCount: messages?.length || 0
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      messages: messages || [],
      total: messages?.length || 0,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp messages', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}