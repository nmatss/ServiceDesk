import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { executeQuery, executeQueryOne, executeRun } from '../db/adapter';
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
  role: 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user';
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
export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    return await executeQueryOne<User>('SELECT * FROM users WHERE email = ?', [email]);
  } catch (error) {
    captureDatabaseError(error, 'SELECT * FROM users WHERE email = ?', [email]);
    return undefined;
  }
}

/**
 * Busca organização por ID e retorna o slug
 */
export async function getOrganizationById(orgId: number): Promise<{ id: number; slug: string; name: string } | undefined> {
  try {
    return await executeQueryOne<{ id: number; slug: string; name: string }>(
      'SELECT id, slug, name FROM organizations WHERE id = ?',
      [orgId]
    );
  } catch (error) {
    captureDatabaseError(error, 'SELECT id, slug, name FROM organizations WHERE id = ?', [orgId]);
    return undefined;
  }
}

/**
 * Busca usuário por ID
 */
export async function getUserById(id: number): Promise<User | undefined> {
  try {
    return await executeQueryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
  } catch (error) {
    captureDatabaseError(error, 'SELECT * FROM users WHERE id = ?', [id]);
    return undefined;
  }
}

/**
 * Cria um novo usuário
 */
export async function createUser(userData: RegisterData): Promise<User | undefined> {
  try {
    const hashedPassword = await hashPassword(userData.password);

    const result = await executeRun(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      [userData.name, userData.email, hashedPassword, userData.role || 'user']
    );

    const newUserId = result.lastInsertRowid;
    if (typeof newUserId !== 'number') {
      // Fallback: query by email to find the newly created user
      const inserted = await executeQueryOne<{ id: number }>(
        'SELECT id FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1',
        [userData.email]
      );
      if (!inserted) return undefined;
      return await getUserById(inserted.id);
    }

    return await getUserById(newUserId);
  } catch (error) {
    captureDatabaseError(error, 'INSERT INTO users', [userData.name, userData.email, '***', userData.role]);
    return undefined;
  }
}

/**
 * Autentica usuário com email e senha
 * SECURITY: Uses constant-time comparison to prevent timing attacks
 */
export async function authenticateUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  try {
    const user = await getUserByEmail(credentials.email);

    // SECURITY FIX: Always run bcrypt.compare to prevent timing attacks
    // Use a dummy hash when user doesn't exist to ensure constant-time execution
    const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.S0FqYLmE6y9Mz.';
    const hashToCompare = user?.password_hash || dummyHash;

    const isValidPassword = await verifyPassword(credentials.password, hashToCompare);

    // Return null if user doesn't exist OR password is invalid
    if (!user || !user.password_hash || !isValidPassword) {
      return null;
    }

    // SECURITY: Reject users with no organization_id instead of falling back to 1
    if (!user.organization_id) {
      captureAuthError(new Error('User has no organization_id'), { username: user.email });
      return null;
    }

    // Buscar informações da organização
    const organization = await getOrganizationById(user.organization_id);
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
      organization_id: user.organization_id,
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

    const result = await executeRun(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hashedPassword, userId]
    );

    return result.changes > 0;
  } catch (error) {
    captureDatabaseError(error, 'UPDATE users SET password_hash = ?', [userId]);
    return false;
  }
}

/**
 * Verifica se email já existe
 */
export async function emailExists(email: string): Promise<boolean> {
  try {
    const user = await executeQueryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [email]);
    return !!user;
  } catch (error) {
    captureDatabaseError(error, 'SELECT id FROM users WHERE email = ?', [email]);
    return false;
  }
}

/**
 * Lista todos os usuários (para admin)
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    return await executeQuery<User>('SELECT * FROM users ORDER BY created_at DESC');
  } catch (error) {
    captureDatabaseError(error, 'SELECT * FROM users ORDER BY created_at DESC');
    return [];
  }
}

/**
 * Atualiza dados do usuário
 */
export async function updateUser(userId: number, updates: Partial<Pick<User, 'name' | 'email' | 'role'>>): Promise<boolean> {
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

    const result = await executeRun(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return result.changes > 0;
  } catch (error) {
    captureDatabaseError(error, `UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return false;
  }
}

/**
 * Deleta usuário
 */
export async function deleteUser(userId: number): Promise<boolean> {
  try {
    const result = await executeRun('DELETE FROM users WHERE id = ?', [userId]);
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
    tenant_slug: user.tenant_slug,
    type: 'access'
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
    const user = await getUserById(payload.id as number);
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

    // SECURITY: Reject users with no organization_id instead of falling back to 1
    if (!user.organization_id) {
      captureAuthError(new Error('User has no organization_id'), {
        username: user.email,
        method: 'jwt'
      });
      return null;
    }

    // Buscar informações da organização
    const organization = await getOrganizationById(user.organization_id);
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
      organization_id: user.organization_id,
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
