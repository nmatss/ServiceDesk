import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import db from '../db/connection';
import { User } from '../types/database';
import { validateJWTSecret } from '@/lib/config/env';
import { captureDatabaseError, captureAuthError } from '@/lib/monitoring/sentry-helpers';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'agent' | 'user';
}

export interface AuthUser {
  id: number;
  /** @deprecated Use `id` instead. Alias for backward compatibility */
  userId?: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user' | 'manager' | 'read_only' | 'api_client' | 'tenant_admin';
  organization_id: number;
  tenant_slug: string;
  created_at: string;
  updated_at: string;
}

/**
 * Hash de senha usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se a senha está correta
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Busca usuário por email
 */
export function getUserByEmail(email: string): User | null {
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User;
    return user || null;
  } catch (error) {
    captureDatabaseError(error, 'SELECT * FROM users WHERE email = ?', [email]);
    return null;
  }
}

/**
 * Busca organização por ID e retorna o slug
 */
export function getOrganizationById(orgId: number): { id: number; slug: string; name: string } | null {
  try {
    const org = db.prepare('SELECT id, slug, name FROM organizations WHERE id = ?').get(orgId) as { id: number; slug: string; name: string };
    return org || null;
  } catch (error) {
    captureDatabaseError(error, 'SELECT id, slug, name FROM organizations WHERE id = ?', [orgId]);
    return null;
  }
}

/**
 * Busca usuário por ID
 */
export function getUserById(id: number): User | null {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
    return user || null;
  } catch (error) {
    captureDatabaseError(error, 'SELECT * FROM users WHERE id = ?', [id]);
    return null;
  }
}

/**
 * Cria um novo usuário
 */
export async function createUser(userData: RegisterData): Promise<User | null> {
  try {
    const hashedPassword = await hashPassword(userData.password);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);

    const result = insertUser.run(
      userData.name,
      userData.email,
      hashedPassword,
      userData.role || 'user'
    );

    const newUser = getUserById(result.lastInsertRowid as number);
    return newUser;
  } catch (error) {
    captureDatabaseError(error, 'INSERT INTO users', [userData.name, userData.email, '***', userData.role]);
    return null;
  }
}

/**
 * Autentica usuário com email e senha
 * SECURITY: Uses constant-time comparison to prevent timing attacks
 */
export async function authenticateUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  try {
    const user = getUserByEmail(credentials.email);

    // SECURITY FIX: Always run bcrypt.compare to prevent timing attacks
    // Use a dummy hash when user doesn't exist to ensure constant-time execution
    const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.S0FqYLmE6y9Mz.';
    const hashToCompare = user?.password_hash || dummyHash;

    const isValidPassword = await verifyPassword(credentials.password, hashToCompare);

    // Return null if user doesn't exist OR password is invalid
    if (!user || !user.password_hash || !isValidPassword) {
      return null;
    }

    // Buscar informações da organização
    const organization = getOrganizationById(user.organization_id || 1);
    if (!organization) {
      captureAuthError(new Error('Organization not found for user'), { username: user.email });
      return null;
    }

    // Retornar dados do usuário sem a senha
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id || 1,
      tenant_slug: organization.slug,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    captureAuthError(error, { username: credentials.email, method: 'password' });
    return null;
  }
}

/**
 * Atualiza senha do usuário
 */
export async function updateUserPassword(userId: number, newPassword: string): Promise<boolean> {
  try {
    const hashedPassword = await hashPassword(newPassword);
    
    const updatePassword = db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = updatePassword.run(hashedPassword, userId);
    return result.changes > 0;
  } catch (error) {
    captureDatabaseError(error, 'UPDATE users SET password_hash = ?', [userId]);
    return false;
  }
}

/**
 * Verifica se email já existe
 */
export function emailExists(email: string): boolean {
  try {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    return !!user;
  } catch (error) {
    captureDatabaseError(error, 'SELECT id FROM users WHERE email = ?', [email]);
    return false;
  }
}

/**
 * Lista todos os usuários (para admin)
 */
export function getAllUsers(): User[] {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
    return users;
  } catch (error) {
    captureDatabaseError(error, 'SELECT * FROM users ORDER BY created_at DESC');
    return [];
  }
}

/**
 * Atualiza dados do usuário
 */
export function updateUser(userId: number, updates: Partial<Pick<User, 'name' | 'email' | 'role'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  try {
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }

    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }

    if (fields.length === 0) {
      return false;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateUser = db.prepare(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = updateUser.run(...values);
    return result.changes > 0;
  } catch (error) {
    captureDatabaseError(error, `UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return false;
  }
}

/**
 * Deleta usuário
 */
export function deleteUser(userId: number): boolean {
  try {
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    const result = deleteUser.run(userId);
    return result.changes > 0;
  } catch (error) {
    captureDatabaseError(error, 'DELETE FROM users WHERE id = ?', [userId]);
    return false;
  }
}

/**
 * Gera token JWT (DEPRECATED - Use token-manager.ts instead)
 * @deprecated Use generateAccessToken from token-manager.ts for new implementations
 */
export async function generateToken(user: AuthUser): Promise<string> {
  const secret = new TextEncoder().encode(validateJWTSecret());

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    tenant_slug: user.tenant_slug
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('servicedesk')
    .setAudience('servicedesk-users')
    .setIssuedAt()
    .setExpirationTime('24h')
    .setSubject(user.id.toString())
    .sign(secret);

  return token;
}

/**
 * Verifica token JWT
 */
export async function verifyToken(token: string, expectedTenantId?: number): Promise<AuthUser | null> {
  try {
    const secret = new TextEncoder().encode(validateJWTSecret());

    const { payload } = await jwtVerify(token, secret);

    if (!payload.id || !payload.email || !payload.role) {
      return null;
    }

    // Validar tenant se fornecido
    if (expectedTenantId && payload.organization_id !== expectedTenantId) {
      captureAuthError(new Error('Tenant mismatch in JWT'), {
        username: payload.email as string,
        method: 'jwt'
      });
      return null;
    }

    // Buscar usuário no banco para garantir que ainda existe
    const user = getUserById(payload.id as number);
    if (!user) {
      return null;
    }

    // Validar que o organization_id do usuário corresponde ao do token
    if (user.organization_id !== payload.organization_id) {
      captureAuthError(new Error('User organization_id does not match token organization_id'), {
        username: user.email,
        method: 'jwt'
      });
      return null;
    }

    // Buscar informações da organização
    const organization = getOrganizationById(user.organization_id || 1);
    if (!organization) {
      captureAuthError(new Error('Organization not found for user'), {
        username: user.email,
        method: 'jwt'
      });
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id || 1,
      tenant_slug: payload.tenant_slug as string,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    captureAuthError(error, { method: 'jwt' });
    return null;
  }
}

/**
 * Verify authentication from NextRequest
 * Used in API routes for authentication
 */
export async function verifyAuth(request: any): Promise<{ authenticated: boolean; user?: AuthUser }> {
  try {
    // Get JWT token from cookie or Authorization header
    const tokenFromCookie = request.cookies?.get?.('auth_token')?.value;
    const authHeader = request.headers?.get?.('authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      return { authenticated: false };
    }

    // Verify token
    const user = await verifyToken(token);

    if (!user) {
      return { authenticated: false };
    }

    return { authenticated: true, user };
  } catch (error) {
    captureAuthError(error, { method: 'jwt' });
    return { authenticated: false };
  }
}

/**
 * Verify authentication token (alias for backward compatibility)
 */
export async function verifyAuthToken(request: any): Promise<{ authenticated: boolean; user?: AuthUser }> {
  return verifyAuth(request);
}

/**
 * Verify token from cookies (RECOMMENDED for API routes)
 * This is the preferred authentication method for cookie-based auth
 * @param request - NextRequest object
 * @returns AuthUser if valid, null otherwise
 */
export async function verifyTokenFromCookies(request: any): Promise<AuthUser | null> {
  try {
    // Priority: Cookie first (more secure with httpOnly flag)
    const tokenFromCookie = request.cookies?.get?.('auth_token')?.value;

    if (!tokenFromCookie) {
      return null;
    }

    // Verify the token
    const user = await verifyToken(tokenFromCookie);
    return user;
  } catch (error) {
    captureAuthError(error, { method: 'cookie-auth' });
    return null;
  }
}

