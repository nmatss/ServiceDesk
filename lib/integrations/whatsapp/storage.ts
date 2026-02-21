/**
 * WhatsApp Data Storage Layer
 * Camada de persistência para dados do WhatsApp
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { sqlDateSub, getDbType } from '@/lib/db/adapter';
import type {
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppSession,
  CreateWhatsAppContact,
  CreateWhatsAppMessage,
  CreateWhatsAppSession
} from '@/lib/types/database';

/**
 * Database row interfaces
 */
interface DbContact {
  id: number;
  user_id: number | null;
  phone_number: string;
  display_name: string | null;
  profile_picture_url: string | null;
  is_business: number;
  is_verified: number;
  last_seen: string | null;
  status_message: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMessage {
  id: number;
  contact_id: number;
  ticket_id: number | null;
  message_id: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_caption: string | null;
  status: string;
  timestamp: string;
  created_at: string;
}

interface DbSession {
  id: number;
  phone_number: string;
  session_data: string | null;
  last_activity: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * WhatsApp Contacts
 */
export async function createWhatsAppContact(data: CreateWhatsAppContact): Promise<WhatsAppContact> {
  const result = await executeRun(`
    INSERT INTO whatsapp_contacts (
      user_id, phone_number, display_name, profile_picture_url,
      is_business, is_verified, last_seen, status_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.user_id || null,
    data.phone_number,
    data.display_name || null,
    data.profile_picture_url || null,
    data.is_business ? 1 : 0,
    data.is_verified ? 1 : 0,
    data.last_seen || null,
    data.status_message || null
  ]);

  const contact = await getWhatsAppContactById(result.lastInsertRowid as number);
  if (!contact) {
    throw new Error('Failed to create WhatsApp contact');
  }
  return contact;
}

export async function getWhatsAppContact(phoneNumber: string): Promise<WhatsAppContact | null> {
  const contact = await executeQueryOne<DbContact>(`
    SELECT * FROM whatsapp_contacts
    WHERE phone_number = ?
  `, [phoneNumber]);

  return contact ? convertDbContactToContact(contact) : null;
}

export async function getWhatsAppContactById(id: number): Promise<WhatsAppContact | null> {
  const contact = await executeQueryOne<DbContact>(`
    SELECT * FROM whatsapp_contacts
    WHERE id = ?
  `, [id]);

  return contact ? convertDbContactToContact(contact) : null;
}

export async function updateWhatsAppContact(contact: WhatsAppContact): Promise<void> {
  await executeRun(`
    UPDATE whatsapp_contacts
    SET user_id = ?, display_name = ?, profile_picture_url = ?,
        is_business = ?, is_verified = ?, last_seen = ?,
        status_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    contact.user_id || null,
    contact.display_name || null,
    contact.profile_picture_url || null,
    contact.is_business ? 1 : 0,
    contact.is_verified ? 1 : 0,
    contact.last_seen || null,
    contact.status_message || null,
    contact.id
  ]);
}

export async function getUserByPhone(phoneNumber: string): Promise<{ id: number } | null> {
  // Busca usuário pelo telefone no campo metadata ou phone
  const user = await executeQueryOne<{ id: number }>(`
    SELECT id FROM users
    WHERE JSON_EXTRACT(metadata, '$.phone') = ?
       OR JSON_EXTRACT(metadata, '$.whatsapp') = ?
    LIMIT 1
  `, [phoneNumber, phoneNumber]);

  return user || null;
}

/**
 * WhatsApp Messages
 */
export async function createWhatsAppMessage(data: CreateWhatsAppMessage): Promise<WhatsAppMessage> {
  const result = await executeRun(`
    INSERT INTO whatsapp_messages (
      contact_id, ticket_id, message_id, direction, message_type,
      content, media_url, media_mime_type, media_caption, status, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.contact_id,
    data.ticket_id || null,
    data.message_id,
    data.direction,
    data.message_type,
    data.content || null,
    data.media_url || null,
    data.media_mime_type || null,
    data.media_caption || null,
    data.status,
    data.timestamp
  ]);

  const message = await getWhatsAppMessageById(result.lastInsertRowid as number);
  if (!message) {
    throw new Error('Failed to create WhatsApp message');
  }
  return message;
}

export async function getWhatsAppMessageById(id: number): Promise<WhatsAppMessage | null> {
  const message = await executeQueryOne<DbMessage>(`
    SELECT * FROM whatsapp_messages
    WHERE id = ?
  `, [id]);

  return message ? convertDbMessageToMessage(message) : null;
}

export async function getWhatsAppMessageByMessageId(messageId: string): Promise<WhatsAppMessage | null> {
  const message = await executeQueryOne<DbMessage>(`
    SELECT * FROM whatsapp_messages
    WHERE message_id = ?
  `, [messageId]);

  return message ? convertDbMessageToMessage(message) : null;
}

export async function updateWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  await executeRun(`
    UPDATE whatsapp_messages
    SET contact_id = ?, ticket_id = ?, direction = ?, message_type = ?,
        content = ?, media_url = ?, media_mime_type = ?,
        media_caption = ?, status = ?, timestamp = ?
    WHERE id = ?
  `, [
    message.contact_id,
    message.ticket_id || null,
    message.direction,
    message.message_type,
    message.content || null,
    message.media_url || null,
    message.media_mime_type || null,
    message.media_caption || null,
    message.status,
    message.timestamp,
    message.id
  ]);
}

export async function getMessagesByContact(
  contactId: number,
  limit = 50,
  offset = 0
): Promise<WhatsAppMessage[]> {
  const messages = await executeQuery<DbMessage>(`
    SELECT * FROM whatsapp_messages
    WHERE contact_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `, [contactId, limit, offset]);

  return messages.map(convertDbMessageToMessage);
}

export async function getMessagesByTicket(ticketId: number): Promise<WhatsAppMessage[]> {
  const messages = await executeQuery<DbMessage>(`
    SELECT * FROM whatsapp_messages
    WHERE ticket_id = ?
    ORDER BY timestamp ASC
  `, [ticketId]);

  return messages.map(convertDbMessageToMessage);
}

/**
 * WhatsApp Sessions
 */
export async function createWhatsAppSession(data: CreateWhatsAppSession): Promise<WhatsAppSession> {
  const result = await executeRun(`
    INSERT INTO whatsapp_sessions (
      phone_number, session_data, last_activity, is_active
    ) VALUES (?, ?, ?, ?)
  `, [
    data.phone_number,
    data.session_data || null,
    data.last_activity,
    data.is_active ? 1 : 0
  ]);

  const session = await getWhatsAppSessionById(result.lastInsertRowid as number);
  if (!session) {
    throw new Error('Failed to create WhatsApp session');
  }
  return session;
}

export async function getWhatsAppSessionById(id: number): Promise<WhatsAppSession | null> {
  const session = await executeQueryOne<DbSession>(`
    SELECT * FROM whatsapp_sessions
    WHERE id = ?
  `, [id]);

  return session ? convertDbSessionToSession(session) : null;
}

export async function getActiveSessionByPhone(phoneNumber: string): Promise<WhatsAppSession | null> {
  const session = await executeQueryOne<DbSession>(`
    SELECT * FROM whatsapp_sessions
    WHERE phone_number = ? AND is_active = 1
    ORDER BY last_activity DESC
    LIMIT 1
  `, [phoneNumber]);

  return session ? convertDbSessionToSession(session) : null;
}

export async function updateWhatsAppSession(session: WhatsAppSession): Promise<void> {
  await executeRun(`
    UPDATE whatsapp_sessions
    SET phone_number = ?, session_data = ?, last_activity = ?,
        is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    session.phone_number,
    session.session_data || null,
    session.last_activity,
    session.is_active ? 1 : 0,
    session.id
  ]);
}

export async function deactivateExpiredSessions(timeoutHours = 24): Promise<number> {
  const cutoff = getDbType() === 'postgresql'
    ? `CURRENT_TIMESTAMP - INTERVAL '${timeoutHours} hours'`
    : `datetime('now', '-${timeoutHours} hours')`;

  const result = await executeRun(`
    UPDATE whatsapp_sessions
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE is_active = 1
      AND last_activity < ${cutoff}
  `, []);

  return result.changes;
}

/**
 * Analytics and Reports
 */
export async function getWhatsAppStats(days = 30): Promise<{
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  uniqueContacts: number;
  ticketsCreated: number;
  avgResponseTime: number;
}> {
  interface StatsResult {
    total_messages: number;
    inbound_messages: number;
    outbound_messages: number;
    unique_contacts: number;
    tickets_created: number;
  }

  const stats = await executeQueryOne<StatsResult>(`
    SELECT
      COUNT(*) as total_messages,
      SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_messages,
      SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_messages,
      COUNT(DISTINCT contact_id) as unique_contacts,
      COUNT(DISTINCT ticket_id) as tickets_created
    FROM whatsapp_messages
    WHERE timestamp >= ${sqlDateSub(days)}
  `, []);

  return {
    totalMessages: stats?.total_messages || 0,
    inboundMessages: stats?.inbound_messages || 0,
    outboundMessages: stats?.outbound_messages || 0,
    uniqueContacts: stats?.unique_contacts || 0,
    ticketsCreated: stats?.tickets_created || 0,
    avgResponseTime: 0 // TODO: Calcular tempo médio de resposta
  };
}

export async function getContactsWithTickets(): Promise<Array<{
  contact: WhatsAppContact;
  ticketCount: number;
  lastMessageAt: string;
}>> {
  interface ContactWithTicketData {
    id: number;
    user_id: number | null;
    phone_number: string;
    display_name: string | null;
    profile_picture_url: string | null;
    is_business: number;
    is_verified: number;
    last_seen: string | null;
    status_message: string | null;
    created_at: string;
    updated_at: string;
    ticket_count: number;
    last_message_at: string;
  }

  const results = await executeQuery<ContactWithTicketData>(`
    SELECT
      c.*,
      COUNT(DISTINCT t.id) as ticket_count,
      MAX(m.timestamp) as last_message_at
    FROM whatsapp_contacts c
    LEFT JOIN whatsapp_messages m ON c.id = m.contact_id
    LEFT JOIN tickets t ON m.ticket_id = t.id
    GROUP BY c.id
    ORDER BY last_message_at DESC
  `, []);

  return results.map((row: ContactWithTicketData) => ({
    contact: convertDbContactToContact(row),
    ticketCount: row.ticket_count || 0,
    lastMessageAt: row.last_message_at || ''
  }));
}

/**
 * Utility Functions
 */
function convertDbContactToContact(dbContact: DbContact): WhatsAppContact {
  return {
    id: dbContact.id,
    user_id: dbContact.user_id || undefined,
    phone_number: dbContact.phone_number,
    display_name: dbContact.display_name || undefined,
    profile_picture_url: dbContact.profile_picture_url || undefined,
    is_business: Boolean(dbContact.is_business),
    is_verified: Boolean(dbContact.is_verified),
    last_seen: dbContact.last_seen || undefined,
    status_message: dbContact.status_message || undefined,
    created_at: dbContact.created_at,
    updated_at: dbContact.updated_at
  };
}

function convertDbMessageToMessage(dbMessage: DbMessage): WhatsAppMessage {
  return {
    id: dbMessage.id,
    contact_id: dbMessage.contact_id,
    ticket_id: dbMessage.ticket_id || undefined,
    message_id: dbMessage.message_id,
    direction: dbMessage.direction as 'inbound' | 'outbound',
    message_type: dbMessage.message_type,
    content: dbMessage.content || undefined,
    media_url: dbMessage.media_url || undefined,
    media_mime_type: dbMessage.media_mime_type || undefined,
    media_caption: dbMessage.media_caption || undefined,
    status: dbMessage.status,
    timestamp: dbMessage.timestamp,
    created_at: dbMessage.created_at
  };
}

function convertDbSessionToSession(dbSession: DbSession): WhatsAppSession {
  return {
    id: dbSession.id,
    phone_number: dbSession.phone_number,
    session_data: dbSession.session_data || undefined,
    last_activity: dbSession.last_activity,
    is_active: Boolean(dbSession.is_active),
    created_at: dbSession.created_at,
    updated_at: dbSession.updated_at
  };
}
