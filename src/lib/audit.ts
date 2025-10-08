import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/monitoring/logger';

// Interface para logs de auditoria
export interface AuditLog {
  id?: string;
  user_id: string;
  action: string;
  path?: string;
  data?: any;
  ip_address?: string;
  timestamp?: string;
}

// Função para registrar log de auditoria
export async function logAuditEvent(logData: AuditLog): Promise<void> {
  try {
    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL não configurado, log de auditoria não será salvo');
      return;
    }

    const sql = neon(process.env.DATABASE_URL);
    
    await sql`
      INSERT INTO audit_logs (user_id, action, path, data, ip_address, timestamp)
      VALUES (${logData.user_id}, ${logData.action}, ${logData.path || null}, 
              ${logData.data ? JSON.stringify(logData.data) : null}, 
              ${logData.ip_address || null}, NOW())
    `;
  } catch (error) {
    logger.error('Erro ao registrar log de auditoria', error);
    // Em produção, considere usar um serviço de logging externo
  }
}

// Função para registrar acesso
export async function logAccess(userId: string, path: string, ip?: string): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'access',
    path: path,
    ip_address: ip,
  });
}

// Função para registrar ação do usuário
export async function logUserAction(userId: string, action: string, data?: any, ip?: string): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: action,
    data: data,
    ip_address: ip,
  });
}

// Função para registrar tentativa de login
export async function logLoginAttempt(email: string, success: boolean, ip?: string): Promise<void> {
  await logAuditEvent({
    user_id: email, // Usar email como identificador temporário
    action: success ? 'login_success' : 'login_failed',
    data: { email, success },
    ip_address: ip,
  });
}

// Função para registrar mudanças de perfil
export async function logProfileChange(userId: string, changes: any, ip?: string): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: 'profile_update',
    data: changes,
    ip_address: ip,
  });
}

// Função para registrar ações administrativas
export async function logAdminAction(userId: string, action: string, target: string, data?: any, ip?: string): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action: `admin_${action}`,
    data: { target, ...data },
    ip_address: ip,
  });
}

