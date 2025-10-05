import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import db from '../db/connection';
import { validateJWTSecret } from '@/lib/config/env';
import {
  User,
  RefreshToken,
  LoginAttempt,
  AuthAuditLog,
  VerificationCode,
  PasswordHistory,
  PasswordPolicy,
  WebAuthnCredential,
  RateLimit,
  JWTPayload,
  AuthSession,
  UserWithRoles,
  AuthEventType,
  CreateRefreshToken,
  CreateLoginAttempt,
  CreateAuthAuditLog,
  CreateVerificationCode,
  CreatePasswordHistory,
  CreateRateLimit
} from '../types/database';

// ========================================
// CONFIGURAÇÕES E CONSTANTES
// ========================================

const JWT_SECRET = validateJWTSecret();
const JWT_ACCESS_EXPIRY = '15m'; // Access token expira em 15 minutos
const JWT_REFRESH_EXPIRY = '7d'; // Refresh token expira em 7 dias
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutos em ms

// ========================================
// INTERFACES E TIPOS
// ========================================

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
  rememberDevice?: boolean;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    browser: string;
  };
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
  timezone?: string;
  language?: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserWithRoles;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
  requiresTwoFactor?: boolean;
  isLocked?: boolean;
  error?: string;
  remainingAttempts?: number;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  ip: string;
}

// ========================================
// FUNÇÕES DE HASH E CRIPTOGRAFIA
// ========================================

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ========================================
// FUNÇÕES DE JWT
// ========================================

export async function generateAccessToken(user: UserWithRoles, jti?: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const tokenId = jti || crypto.randomUUID();

  const payload: JWTPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    roles: user.roles?.map(r => r.name) || [],
    permissions: user.permissions?.map(p => `${p.resource}:${p.action}`) || [],
    jti: tokenId,
    aud: 'servicedesk-api',
    iss: 'servicedesk-auth'
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRY)
    .sign(secret);
}

export async function generateRefreshToken(
  userId: number,
  deviceInfo?: DeviceInfo
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const token = generateSecureToken(64);
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

  const refreshTokenData: CreateRefreshToken = {
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
    ip_address: deviceInfo?.ip,
    user_agent: deviceInfo?.userAgent,
    is_active: true
  };

  try {
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info, ip_address, user_agent, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      refreshTokenData.user_id,
      refreshTokenData.token_hash,
      refreshTokenData.expires_at,
      refreshTokenData.device_info,
      refreshTokenData.ip_address,
      refreshTokenData.user_agent,
      refreshTokenData.is_active ? 1 : 0
    );

    return { token, tokenHash, expiresAt };
  } catch (error) {
    console.error('Error creating refresh token:', error);
    throw new Error('Failed to create refresh token');
  }
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      audience: 'servicedesk-api',
      issuer: 'servicedesk-auth'
    });

    return payload as JWTPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  try {
    const tokenHash = hashToken(refreshToken);

    const refreshTokenData = db.prepare(`
      SELECT rt.*, u.* FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = ? AND rt.is_active = 1 AND rt.expires_at > datetime('now')
    `).get(tokenHash) as any;

    if (!refreshTokenData) {
      return { success: false, error: 'Invalid or expired refresh token' };
    }

    const user = await getUserWithRoles(refreshTokenData.user_id);
    if (!user || !user.is_active) {
      return { success: false, error: 'User not found or inactive' };
    }

    // Gerar novo access token
    const accessToken = await generateAccessToken(user);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutos

    return {
      success: true,
      user,
      tokens: {
        accessToken,
        refreshToken, // Mantém o mesmo refresh token
        expiresAt: expiresAt.toISOString()
      }
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return { success: false, error: 'Failed to refresh token' };
  }
}

// ========================================
// FUNÇÕES DE RATE LIMITING
// ========================================

export async function checkRateLimit(
  identifier: string,
  identifierType: 'ip' | 'user' | 'email',
  endpoint: string,
  maxAttempts: number = 10,
  windowMinutes: number = 15
): Promise<{ allowed: boolean; remainingAttempts: number; resetTime?: Date }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (windowMinutes * 60 * 1000));

    // Buscar tentativas existentes na janela de tempo
    const existing = db.prepare(`
      SELECT * FROM rate_limits
      WHERE identifier = ? AND identifier_type = ? AND endpoint = ?
    `).get(identifier, identifierType, endpoint) as RateLimit | undefined;

    if (!existing) {
      // Primeira tentativa - criar registro
      const rateLimitData: CreateRateLimit = {
        identifier,
        identifier_type: identifierType,
        endpoint,
        attempts: 1
      };

      db.prepare(`
        INSERT INTO rate_limits (identifier, identifier_type, endpoint, attempts, first_attempt_at, last_attempt_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(identifier, identifierType, endpoint, 1);

      return { allowed: true, remainingAttempts: maxAttempts - 1 };
    }

    // Verificar se está bloqueado
    if (existing.blocked_until && new Date(existing.blocked_until) > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(existing.blocked_until)
      };
    }

    // Verificar se a janela de tempo expirou
    const firstAttempt = new Date(existing.first_attempt_at);
    if (firstAttempt < windowStart) {
      // Reset do contador
      db.prepare(`
        UPDATE rate_limits
        SET attempts = 1, first_attempt_at = datetime('now'), last_attempt_at = datetime('now'), blocked_until = NULL
        WHERE identifier = ? AND identifier_type = ? AND endpoint = ?
      `).run(identifier, identifierType, endpoint);

      return { allowed: true, remainingAttempts: maxAttempts - 1 };
    }

    // Incrementar tentativas
    const newAttempts = existing.attempts + 1;
    let blockedUntil = null;

    if (newAttempts >= maxAttempts) {
      // Bloquear por tempo determinado
      const blockTime = new Date(now.getTime() + (windowMinutes * 60 * 1000));
      blockedUntil = blockTime.toISOString();
    }

    db.prepare(`
      UPDATE rate_limits
      SET attempts = ?, last_attempt_at = datetime('now'), blocked_until = ?
      WHERE identifier = ? AND identifier_type = ? AND endpoint = ?
    `).run(newAttempts, blockedUntil, identifier, identifierType, endpoint);

    return {
      allowed: newAttempts < maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - newAttempts),
      resetTime: blockedUntil ? new Date(blockedUntil) : undefined
    };

  } catch (error) {
    console.error('Rate limiting error:', error);
    // Em caso de erro, permitir a requisição para não bloquear o sistema
    return { allowed: true, remainingAttempts: maxAttempts };
  }
}

// ========================================
// FUNÇÕES DE DOIS FATORES (TOTP)
// ========================================

export async function setupTwoFactor(userId: number): Promise<TwoFactorSetup> {
  try {
    const user = getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Gerar secret para TOTP
    const secret = speakeasy.generateSecret({
      name: `ServiceDesk (${user.email})`,
      issuer: 'ServiceDesk',
      length: 32
    });

    // Gerar códigos de backup
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Gerar QR Code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);

    // Salvar secret temporariamente (será confirmado quando o usuário verificar)
    db.prepare(`
      UPDATE users
      SET two_factor_secret = ?, two_factor_backup_codes = ?
      WHERE id = ?
    `).run(secret.base32, JSON.stringify(backupCodes), userId);

    return {
      secret: secret.base32!,
      qrCode,
      backupCodes
    };
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw new Error('Failed to setup two-factor authentication');
  }
}

export async function enableTwoFactor(userId: number, token: string): Promise<boolean> {
  try {
    const user = getUserById(userId);
    if (!user || !user.two_factor_secret) {
      return false;
    }

    // Verificar token TOTP
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2 // Permitir tokens de até 1 minuto antes/depois
    });

    if (verified) {
      // Ativar 2FA
      db.prepare(`
        UPDATE users
        SET two_factor_enabled = 1
        WHERE id = ?
      `).run(userId);

      // Log de auditoria
      await logAuthEvent(userId, AuthEventType.TWO_FACTOR_ENABLED, {
        ip_address: 'system',
        details: JSON.stringify({ method: 'totp' })
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return false;
  }
}

export async function verifyTwoFactor(userId: number, token: string): Promise<boolean> {
  try {
    const user = getUserById(userId);
    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      return false;
    }

    // Verificar se é um código de backup
    if (user.two_factor_backup_codes) {
      const backupCodes = JSON.parse(user.two_factor_backup_codes);
      const codeIndex = backupCodes.indexOf(token.toUpperCase());

      if (codeIndex !== -1) {
        // Remover código usado
        backupCodes.splice(codeIndex, 1);
        db.prepare(`
          UPDATE users
          SET two_factor_backup_codes = ?
          WHERE id = ?
        `).run(JSON.stringify(backupCodes), userId);

        return true;
      }
    }

    // Verificar token TOTP
    return speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE USUÁRIO E ROLES
// ========================================

export function getUserById(id: number): User | null {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
    return user || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

export function getUserByEmail(email: string): User | null {
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User;
    return user || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

export async function getUserWithRoles(userId: number): Promise<UserWithRoles | null> {
  try {
    const user = getUserById(userId);
    if (!user) return null;

    // Buscar roles do usuário
    const roles = db.prepare(`
      SELECT r.* FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
    `).all(userId) as any[];

    // Buscar permissões das roles
    const permissions = db.prepare(`
      SELECT DISTINCT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
    `).all(userId) as any[];

    return {
      ...user,
      roles,
      permissions
    };
  } catch (error) {
    console.error('Error getting user with roles:', error);
    return null;
  }
}

// ========================================
// FUNÇÕES DE LOGIN E AUTENTICAÇÃO
// ========================================

export async function authenticateUser(
  credentials: LoginCredentials,
  deviceInfo?: DeviceInfo
): Promise<AuthResult> {
  try {
    const { email, password, twoFactorCode, rememberDevice } = credentials;

    // Rate limiting por email
    const emailRateLimit = await checkRateLimit(email, 'email', '/auth/login', 5, 15);
    if (!emailRateLimit.allowed) {
      return {
        success: false,
        error: 'Too many login attempts. Please try again later.',
        remainingAttempts: emailRateLimit.remainingAttempts
      };
    }

    // Rate limiting por IP (se fornecido)
    if (deviceInfo?.ip) {
      const ipRateLimit = await checkRateLimit(deviceInfo.ip, 'ip', '/auth/login', 20, 15);
      if (!ipRateLimit.allowed) {
        return {
          success: false,
          error: 'Too many login attempts from this IP. Please try again later.'
        };
      }
    }

    const user = getUserByEmail(email);

    // Log da tentativa de login
    const loginAttemptData: CreateLoginAttempt = {
      user_id: user?.id,
      email,
      ip_address: deviceInfo?.ip || 'unknown',
      user_agent: deviceInfo?.userAgent,
      success: false,
      failure_reason: '',
      two_factor_required: false,
      two_factor_success: false
    };

    if (!user) {
      loginAttemptData.failure_reason = 'user_not_found';
      await logLoginAttempt(loginAttemptData);
      return { success: false, error: 'Invalid credentials' };
    }

    // Verificar se usuário está ativo
    if (!user.is_active) {
      loginAttemptData.failure_reason = 'account_inactive';
      await logLoginAttempt(loginAttemptData);
      return { success: false, error: 'Account is inactive' };
    }

    // Verificar se conta está bloqueada
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      loginAttemptData.failure_reason = 'account_locked';
      await logLoginAttempt(loginAttemptData);
      return {
        success: false,
        error: 'Account is temporarily locked',
        isLocked: true
      };
    }

    // Verificar senha
    if (!user.password_hash || !await verifyPassword(password, user.password_hash)) {
      // Incrementar tentativas falhadas
      const newFailedAttempts = user.failed_login_attempts + 1;
      let lockedUntil = null;

      if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_DURATION).toISOString();
      }

      db.prepare(`
        UPDATE users
        SET failed_login_attempts = ?, locked_until = ?
        WHERE id = ?
      `).run(newFailedAttempts, lockedUntil, user.id);

      loginAttemptData.failure_reason = 'invalid_password';
      await logLoginAttempt(loginAttemptData);

      return {
        success: false,
        error: 'Invalid credentials',
        remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - newFailedAttempts)
      };
    }

    // Verificar 2FA se habilitado
    if (user.two_factor_enabled) {
      loginAttemptData.two_factor_required = true;

      if (!twoFactorCode) {
        await logLoginAttempt(loginAttemptData);
        return {
          success: false,
          requiresTwoFactor: true,
          error: 'Two-factor authentication required'
        };
      }

      const twoFactorValid = await verifyTwoFactor(user.id, twoFactorCode);
      if (!twoFactorValid) {
        loginAttemptData.failure_reason = 'invalid_2fa';
        await logLoginAttempt(loginAttemptData);
        return {
          success: false,
          error: 'Invalid two-factor authentication code'
        };
      }

      loginAttemptData.two_factor_success = true;
    }

    // Login bem-sucedido
    const userWithRoles = await getUserWithRoles(user.id);
    if (!userWithRoles) {
      return { success: false, error: 'Failed to load user data' };
    }

    // Gerar tokens
    const accessToken = await generateAccessToken(userWithRoles);
    const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id, deviceInfo);

    // Atualizar dados do usuário
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL, last_login_at = datetime('now')
      WHERE id = ?
    `).run(user.id);

    // Log de sucesso
    loginAttemptData.success = true;
    loginAttemptData.failure_reason = null;
    await logLoginAttempt(loginAttemptData);

    // Log de auditoria
    await logAuthEvent(user.id, AuthEventType.LOGIN, {
      ip_address: deviceInfo?.ip || 'unknown',
      user_agent: deviceInfo?.userAgent,
      details: JSON.stringify({
        two_factor_used: user.two_factor_enabled,
        remember_device: rememberDevice
      })
    });

    return {
      success: true,
      user: userWithRoles,
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString()
      }
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// ========================================
// FUNÇÕES DE REGISTRO
// ========================================

export async function registerUser(userData: RegisterData): Promise<AuthResult> {
  try {
    const { name, email, password, role = 'user', timezone = 'America/Sao_Paulo', language = 'pt-BR' } = userData;

    // Verificar se email já existe
    if (getUserByEmail(email)) {
      return { success: false, error: 'Email already exists' };
    }

    // Validar política de senha
    const passwordValidation = await validatePassword(password, role);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.message };
    }

    // Hash da senha
    const passwordHash = await hashPassword(password);

    // Criar usuário
    const insertUser = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, role, timezone, language,
        is_active, is_email_verified, password_changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'))
    `);

    const result = insertUser.run(name, email, passwordHash, role, timezone, language);
    const userId = result.lastInsertRowid as number;

    // Salvar histórico de senha
    await addPasswordHistory(userId, passwordHash);

    // Gerar código de verificação de email
    await generateVerificationCode(userId, email, 'email_verification');

    // Log de auditoria
    await logAuthEvent(userId, 'user_registered', {
      ip_address: 'system',
      details: JSON.stringify({ role, email })
    });

    const user = await getUserWithRoles(userId);
    if (!user) {
      return { success: false, error: 'Failed to create user' };
    }

    return { success: true, user };

  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

// ========================================
// FUNÇÕES DE SENHA E POLÍTICAS
// ========================================

export async function validatePassword(password: string, userRole?: string): Promise<{ valid: boolean; message?: string }> {
  try {
    // Buscar política ativa
    const policy = db.prepare(`
      SELECT * FROM password_policies
      WHERE is_active = 1
      AND (applies_to_roles IS NULL OR json_extract(applies_to_roles, '$') LIKE '%' || ? || '%')
      ORDER BY id DESC LIMIT 1
    `).get(userRole || '') as PasswordPolicy | undefined;

    if (!policy) {
      // Política básica se não houver configurada
      if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
      }
      return { valid: true };
    }

    if (password.length < policy.min_length) {
      return { valid: false, message: `Password must be at least ${policy.min_length} characters long` };
    }

    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (policy.require_numbers && !/\d/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }

    if (policy.require_special_chars) {
      const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
      const specialCount = (password.match(specialChars) || []).length;
      if (specialCount < policy.min_special_chars) {
        return { valid: false, message: `Password must contain at least ${policy.min_special_chars} special character(s)` };
      }
    }

    return { valid: true };

  } catch (error) {
    console.error('Password validation error:', error);
    return { valid: true }; // Em caso de erro, permitir para não bloquear o sistema
  }
}

export async function addPasswordHistory(userId: number, passwordHash: string): Promise<void> {
  try {
    db.prepare(`
      INSERT INTO password_history (user_id, password_hash)
      VALUES (?, ?)
    `).run(userId, passwordHash);

    // Limpar histórico antigo (manter apenas os últimos 10)
    db.prepare(`
      DELETE FROM password_history
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM password_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      )
    `).run(userId, userId);
  } catch (error) {
    console.error('Error adding password history:', error);
  }
}

export async function checkPasswordReuse(userId: number, newPassword: string): Promise<boolean> {
  try {
    const history = db.prepare(`
      SELECT password_hash FROM password_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId) as PasswordHistory[];

    for (const entry of history) {
      if (await verifyPassword(newPassword, entry.password_hash)) {
        return true; // Senha já foi usada
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking password reuse:', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE CÓDIGOS DE VERIFICAÇÃO
// ========================================

export async function generateVerificationCode(
  userId: number,
  email: string,
  type: 'email_verification' | 'password_reset' | 'two_factor_backup' | 'login_verification'
): Promise<string> {
  try {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 caracteres
    const codeHash = hashToken(code);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutos

    const verificationData: CreateVerificationCode = {
      user_id: userId,
      email,
      code,
      code_hash: codeHash,
      type,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      max_attempts: 3
    };

    db.prepare(`
      INSERT INTO verification_codes (user_id, email, code, code_hash, type, expires_at, attempts, max_attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      verificationData.user_id,
      verificationData.email,
      verificationData.code,
      verificationData.code_hash,
      verificationData.type,
      verificationData.expires_at,
      verificationData.attempts,
      verificationData.max_attempts
    );

    return code;
  } catch (error) {
    console.error('Error generating verification code:', error);
    throw new Error('Failed to generate verification code');
  }
}

export async function verifyCode(
  email: string,
  code: string,
  type: string
): Promise<{ valid: boolean; userId?: number; error?: string }> {
  try {
    const verification = db.prepare(`
      SELECT * FROM verification_codes
      WHERE email = ? AND code = ? AND type = ? AND used_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(email, code, type) as VerificationCode | undefined;

    if (!verification) {
      return { valid: false, error: 'Invalid verification code' };
    }

    if (new Date(verification.expires_at) < new Date()) {
      return { valid: false, error: 'Verification code has expired' };
    }

    if (verification.attempts >= verification.max_attempts) {
      return { valid: false, error: 'Too many attempts' };
    }

    // Marcar como usado
    db.prepare(`
      UPDATE verification_codes
      SET used_at = datetime('now'), attempts = attempts + 1
      WHERE id = ?
    `).run(verification.id);

    return { valid: true, userId: verification.user_id || undefined };

  } catch (error) {
    console.error('Error verifying code:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

// ========================================
// FUNÇÕES DE AUDITORIA
// ========================================

export async function logAuthEvent(
  userId: number,
  eventType: string,
  details: {
    ip_address?: string;
    user_agent?: string;
    details?: string;
    consent_given?: boolean;
  }
): Promise<void> {
  try {
    const retentionDays = 365; // 1 ano para logs de autenticação
    const retentionExpiry = new Date();
    retentionExpiry.setDate(retentionExpiry.getDate() + retentionDays);

    const auditData: CreateAuthAuditLog = {
      user_id: userId,
      event_type: eventType,
      ip_address: details.ip_address,
      user_agent: details.user_agent,
      details: details.details,
      consent_given: details.consent_given,
      data_retention_expires_at: retentionExpiry.toISOString()
    };

    db.prepare(`
      INSERT INTO auth_audit_logs (
        user_id, event_type, ip_address, user_agent, details,
        consent_given, data_retention_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditData.user_id,
      auditData.event_type,
      auditData.ip_address,
      auditData.user_agent,
      auditData.details,
      auditData.consent_given ? 1 : 0,
      auditData.data_retention_expires_at
    );
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
}

export async function logLoginAttempt(attemptData: CreateLoginAttempt): Promise<void> {
  try {
    db.prepare(`
      INSERT INTO login_attempts (
        user_id, email, ip_address, user_agent, success, failure_reason,
        two_factor_required, two_factor_success, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptData.user_id,
      attemptData.email,
      attemptData.ip_address,
      attemptData.user_agent,
      attemptData.success ? 1 : 0,
      attemptData.failure_reason,
      attemptData.two_factor_required ? 1 : 0,
      attemptData.two_factor_success ? 1 : 0,
      attemptData.session_id
    );
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
}

// ========================================
// FUNÇÕES DE LOGOUT E LIMPEZA
// ========================================

export async function logout(refreshToken: string, userId?: number): Promise<boolean> {
  try {
    const tokenHash = hashToken(refreshToken);

    // Revogar refresh token
    const result = db.prepare(`
      UPDATE refresh_tokens
      SET is_active = 0, revoked_at = datetime('now')
      WHERE token_hash = ?
    `).run(tokenHash);

    if (userId) {
      await logAuthEvent(userId, AuthEventType.LOGOUT, {
        ip_address: 'unknown',
        details: JSON.stringify({ method: 'manual' })
      });
    }

    return result.changes > 0;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

export async function revokeAllTokens(userId: number): Promise<boolean> {
  try {
    const result = db.prepare(`
      UPDATE refresh_tokens
      SET is_active = 0, revoked_at = datetime('now')
      WHERE user_id = ? AND is_active = 1
    `).run(userId);

    await logAuthEvent(userId, 'tokens_revoked', {
      ip_address: 'system',
      details: JSON.stringify({ count: result.changes })
    });

    return true;
  } catch (error) {
    console.error('Error revoking tokens:', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE LIMPEZA DE DADOS EXPIRADOS
// ========================================

export async function cleanupExpiredData(): Promise<void> {
  try {
    // Limpar refresh tokens expirados
    db.prepare(`
      DELETE FROM refresh_tokens
      WHERE expires_at < datetime('now') OR
      (revoked_at IS NOT NULL AND revoked_at < datetime('now', '-7 days'))
    `).run();

    // Limpar códigos de verificação expirados
    db.prepare(`
      DELETE FROM verification_codes
      WHERE expires_at < datetime('now', '-1 day')
    `).run();

    // Limpar rate limits antigos
    db.prepare(`
      DELETE FROM rate_limits
      WHERE last_attempt_at < datetime('now', '-1 day') AND
      (blocked_until IS NULL OR blocked_until < datetime('now'))
    `).run();

    // Limpar logs de auditoria expirados (LGPD)
    db.prepare(`
      DELETE FROM auth_audit_logs
      WHERE data_retention_expires_at < datetime('now')
    `).run();

    // Limpar tentativas de login antigas (manter apenas 30 dias)
    db.prepare(`
      DELETE FROM login_attempts
      WHERE created_at < datetime('now', '-30 days')
    `).run();

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// ========================================
// EXPORT DAS INTERFACES PRINCIPAIS
// ========================================

export type {
  LoginCredentials,
  RegisterData,
  AuthResult,
  TwoFactorSetup,
  DeviceInfo
};