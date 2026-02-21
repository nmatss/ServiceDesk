/**
 * User Repository Implementation
 *
 * Concrete implementation of IUserRepository using the database adapter.
 * Handles all user-related database operations with security features.
 *
 * @module lib/repositories/user-repository
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import type { IUserRepository, UserFilters } from '@/lib/interfaces/repositories';
import type { User } from '@/lib/types/database';

export class UserRepository implements IUserRepository {
  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | null> {
    const user = await executeQueryOne<User>(`
      SELECT * FROM users WHERE id = ?
    `, [id]);

    if (user) {
      // Never expose password hash
      delete (user as any).password_hash;
    }

    return user || null;
  }

  /**
   * Find all users with optional filters
   */
  async findAll(filters?: UserFilters): Promise<User[]> {
    const {
      role,
      organization_id,
      is_active,
      is_email_verified,
      search,
      limit = 100,
      offset = 0,
    } = filters || {};

    const where: string[] = [];
    const params: any[] = [];

    if (role !== undefined) {
      where.push('role = ?');
      params.push(role);
    }

    if (organization_id !== undefined) {
      where.push('organization_id = ?');
      params.push(organization_id);
    }

    if (is_active !== undefined) {
      where.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (is_email_verified !== undefined) {
      where.push('is_email_verified = ?');
      params.push(is_email_verified ? 1 : 0);
    }

    if (search) {
      where.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    params.push(limit, offset);

    const sql = `
      SELECT * FROM users
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY name
      LIMIT ? OFFSET ?
    `;

    const users = await executeQuery<User>(sql, params);

    // Never expose password hashes
    return users.map((user) => {
      delete (user as any).password_hash;
      return user;
    });
  }

  /**
   * Create a new user
   */
  async create(data: Partial<User>): Promise<User> {
    const result = await executeRun(`
      INSERT INTO users (
        name, email, password_hash, role, organization_id,
        is_active, is_email_verified, timezone, language,
        two_factor_enabled, failed_login_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name,
      data.email,
      data.password_hash || null,
      data.role || 'user',
      data.organization_id,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      data.is_email_verified !== undefined ? (data.is_email_verified ? 1 : 0) : 0,
      data.timezone || 'America/Sao_Paulo',
      data.language || 'pt-BR',
      data.two_factor_enabled !== undefined ? (data.two_factor_enabled ? 1 : 0) : 0,
      0
    ]);

    let userId = result.lastInsertRowid;
    if (typeof userId !== 'number') {
      const inserted = await executeQueryOne<{ id: number }>(
        'SELECT id FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1',
        [data.email]
      );
      userId = inserted?.id;
    }

    if (typeof userId !== 'number') {
      throw new Error('Failed to resolve created user id');
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Update an existing user
   */
  async update(id: number, data: Partial<User>): Promise<User> {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      sets.push('name = ?');
      values.push(data.name);
    }
    if (data.email !== undefined) {
      sets.push('email = ?');
      values.push(data.email);
    }
    if (data.role !== undefined) {
      sets.push('role = ?');
      values.push(data.role);
    }
    if (data.is_active !== undefined) {
      sets.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.is_email_verified !== undefined) {
      sets.push('is_email_verified = ?');
      values.push(data.is_email_verified ? 1 : 0);
    }
    if (data.avatar_url !== undefined) {
      sets.push('avatar_url = ?');
      values.push(data.avatar_url);
    }
    if (data.timezone !== undefined) {
      sets.push('timezone = ?');
      values.push(data.timezone);
    }
    if (data.language !== undefined) {
      sets.push('language = ?');
      values.push(data.language);
    }

    if (sets.length === 0) {
      const user = await this.findById(id);
      if (!user) throw new Error('User not found');
      return user;
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await executeRun(`
      UPDATE users
      SET ${sets.join(', ')}
      WHERE id = ?
    `, values);

    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found after update');
    }

    return user;
  }

  /**
   * Delete a user (should be avoided, use is_active instead)
   */
  async delete(id: number): Promise<void> {
    await executeRun('DELETE FROM users WHERE id = ?', [id]);
  }

  /**
   * Count users with optional filters
   */
  async count(filters?: UserFilters): Promise<number> {
    const { role, organization_id, is_active } = filters || {};

    const where: string[] = [];
    const params: any[] = [];

    if (role !== undefined) {
      where.push('role = ?');
      params.push(role);
    }

    if (organization_id !== undefined) {
      where.push('organization_id = ?');
      params.push(organization_id);
    }

    if (is_active !== undefined) {
      where.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    const sql = `
      SELECT COUNT(*) as count FROM users
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    `;

    const result = await executeQueryOne<{ count: number }>(sql, params);
    return result?.count ?? 0;
  }

  /**
   * Find user by email (without password hash)
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await executeQueryOne<User>(`
      SELECT * FROM users WHERE email = ?
    `, [email]);

    if (user) {
      delete (user as any).password_hash;
    }

    return user || null;
  }

  /**
   * Find user by email WITH password hash (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    const user = await executeQueryOne<User>(`
      SELECT * FROM users WHERE email = ?
    `, [email]);

    return user || null;
  }

  /**
   * Find users by role
   */
  async findByRole(role: string, organizationId?: number): Promise<User[]> {
    return this.findAll({ role, organization_id: organizationId });
  }

  /**
   * Find all agents in an organization
   */
  async findAgents(organizationId: number): Promise<User[]> {
    return this.findAll({
      role: 'agent',
      organization_id: organizationId,
      is_active: true,
    });
  }

  /**
   * Find all admins in an organization
   */
  async findAdmins(organizationId: number): Promise<User[]> {
    const users = await this.findAll({
      organization_id: organizationId,
      is_active: true,
    });

    return users.filter((u) => u.role === 'admin' || u.role === 'tenant_admin');
  }

  /**
   * Update user password
   */
  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await executeRun(`
      UPDATE users
      SET password_hash = ?,
          password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [passwordHash, userId]);
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedLoginAttempts(userId: number): Promise<void> {
    await executeRun(`
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId]);

    // Check if we need to lock the account (after 5 failed attempts)
    const user = await this.findById(userId);
    if (user && user.failed_login_attempts >= 4) {
      // Lock for 30 minutes
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 30);
      await this.lockAccount(userId, lockUntil.toISOString());
    }
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedLoginAttempts(userId: number): Promise<void> {
    await executeRun(`
      UPDATE users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId]);
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: number, until: string): Promise<void> {
    await executeRun(`
      UPDATE users
      SET locked_until = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [until, userId]);
  }

  /**
   * Unlock user account
   */
  async unlockAccount(userId: number): Promise<void> {
    await executeRun(`
      UPDATE users
      SET locked_until = NULL,
          failed_login_attempts = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId]);
  }

  /**
   * Enable 2FA for user
   */
  async enable2FA(userId: number, secret: string): Promise<void> {
    await executeRun(`
      UPDATE users
      SET two_factor_enabled = 1,
          two_factor_secret = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [secret, userId]);
  }

  /**
   * Disable 2FA for user
   */
  async disable2FA(userId: number): Promise<void> {
    await executeRun(`
      UPDATE users
      SET two_factor_enabled = 0,
          two_factor_secret = NULL,
          two_factor_backup_codes = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId]);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: number): Promise<void> {
    await executeRun(`
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId]);
  }

  /**
   * Find all users in an organization
   */
  async findByOrganization(organizationId: number): Promise<User[]> {
    return this.findAll({ organization_id: organizationId });
  }
}
