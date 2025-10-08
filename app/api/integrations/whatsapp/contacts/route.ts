import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { getContactsWithTickets, getWhatsAppStats } from '@/lib/integrations/whatsapp/storage';
import { createAuditLog } from '@/lib/audit/logger';
import { logger } from '@/lib/monitoring/logger';

/**
 * GET - Listar contatos WhatsApp
 * Retorna lista de contatos com informações de tickets
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
    const includeStats = searchParams.get('includeStats') === 'true';

    // Busca contatos
    const contacts = await getContactsWithTickets();

    let stats = null;
    if (includeStats) {
      stats = await getWhatsAppStats();
    }

    // Log da consulta
    await createAuditLog({
      user_id: authResult.user?.id,
      action: 'whatsapp_contacts_viewed',
      resource_type: 'whatsapp_contact',
      new_values: JSON.stringify({
        contactCount: contacts.length,
        includeStats
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      contacts,
      stats,
      total: contacts.length
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp contacts', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}