/**
 * User Service Layer
 *
 * Business logic for user operations.
 * Handles authentication, authorization, and user management with security rules.
 *
 * @module lib/services/user-service
 */

import bcrypt from 'bcryptjs';
import type { IUserRepository } from '@/lib/interfaces/repositories';
import type { User } from '@/lib/types/database';
import { createAuditLog } from '@/lib/audit/logger';
import { createNotification } from '@/lib/notifications';
import { executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/structured-logger';

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user';
  organization_id: number;
  timezone?: string;
  language?: string;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  avatar_url?: string;
  timezone?: string;
  language?: string;
}

export interface ChangePasswordDTO {
  user_id: number;
  current_password: string;
  new_password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class UserService {
  private userRepo: IUserRepository;
  private readonly SALT_ROUNDS = 12;
  private readonly MIN_PASSWORD_LENGTH = 8;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  /**
   * Create a new user with password hashing and validation
   */
  async createUser(data: CreateUserDTO): Promise<User> {
    // Business Rule 1: Validate email uniqueness
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Business Rule 2: Validate password strength
    this.validatePassword(data.password);

    // Business Rule 3: Email format validation
    if (!this.isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Business Rule 4: Name validation
    if (!data.name || data.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.userRepo.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password_hash: passwordHash,
      role: data.role,
      organization_id: data.organization_id,
      is_active: true,
      is_email_verified: false,
      timezone: data.timezone || 'America/Sao_Paulo',
      language: data.language || 'pt-BR',
      two_factor_enabled: false,
      failed_login_attempts: 0,
    });

    // Email verification is handled at the API route level (register route manages the verification flow)

    try {
      await createAuditLog({
        user_id: user.id,
        organization_id: data.organization_id,
        action: 'user_created',
        resource_type: 'user',
        resource_id: user.id,
        new_values: JSON.stringify({ name: user.name, email: user.email, role: user.role }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for user creation', { error: err, userId: user.id });
    }

    try {
      await createNotification({
        user_id: user.id,
        type: 'welcome',
        title: 'Bem-vindo ao ServiceDesk',
        message: `Sua conta foi criada com sucesso. Bem-vindo, ${user.name}!`,
        is_read: false,
        sent_via_email: true,
      });
    } catch (err) {
      logger.error('Failed to send welcome notification', { error: err, userId: user.id });
    }

    return user;
  }

  /**
   * Update user information
   */
  async updateUser(userId: number, data: UpdateUserDTO, updatedBy: number): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Business Rule: Email uniqueness if changing email
    if (data.email && data.email !== user.email) {
      const existingUser = await this.userRepo.findByEmail(data.email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Email changed, mark as unverified
      data.email = data.email.toLowerCase().trim();
      // Email verification is handled at the API route level
    }

    // Business Rule: Name validation
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 2) {
        throw new Error('Name must be at least 2 characters long');
      }
      data.name = data.name.trim();
    }

    // Business Rule: Cannot change role to higher privilege without admin
    // This should be enforced at the API level, but we can add a check here too

    const updated = await this.userRepo.update(userId, data as Partial<User>);

    try {
      await createAuditLog({
        user_id: updatedBy,
        organization_id: user.organization_id,
        action: 'user_updated',
        resource_type: 'user',
        resource_id: userId,
        old_values: JSON.stringify({ name: user.name, email: user.email, role: user.role, is_active: user.is_active }),
        new_values: JSON.stringify(data),
      });
    } catch (err) {
      logger.error('Failed to create audit log for user update', { error: err, userId });
    }

    if (data.role && data.role !== user.role) {
      try {
        await createNotification({
          user_id: userId,
          type: 'role_change',
          title: 'Função alterada',
          message: `Sua função foi alterada de ${user.role} para ${data.role}.`,
          is_read: false,
          sent_via_email: true,
        });
      } catch (err) {
        logger.error('Failed to send role change notification', { error: err, userId });
      }

      try {
        await executeRun('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
      } catch (err) {
        logger.error('Failed to invalidate sessions after role change', { error: err, userId });
      }
    }

    if (data.is_active === false) {
      try {
        await executeRun('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
      } catch (err) {
        logger.error('Failed to invalidate sessions after deactivation', { error: err, userId });
      }
    }

    return updated;
  }

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginDTO): Promise<User> {
    const user = await this.userRepo.findByEmailWithPassword(credentials.email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.locked_until) {
      const lockUntil = new Date(user.locked_until);
      if (lockUntil > new Date()) {
        const minutesRemaining = Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60));
        throw new Error(`Account is locked. Try again in ${minutesRemaining} minutes.`);
      } else {
        // Lock expired, unlock the account
        await this.userRepo.unlockAccount(user.id);
      }
    }

    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is inactive. Please contact support.');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash || '');

    if (!passwordMatch) {
      // Increment failed login attempts
      await this.userRepo.incrementFailedLoginAttempts(user.id);

      try {
        await createAuditLog({
          user_id: user.id,
          organization_id: user.organization_id,
          action: 'user_login_failed',
          resource_type: 'user',
          resource_id: user.id,
        });
      } catch (err) {
        logger.error('Failed to create audit log for failed login', { error: err, userId: user.id });
      }
      throw new Error('Invalid credentials');
    }

    // Successful login - reset failed attempts
    await this.userRepo.resetFailedLoginAttempts(user.id);
    await this.userRepo.updateLastLogin(user.id);

    // Remove password hash before returning
    delete (user as unknown as Record<string, unknown>).password_hash;

    try {
      await createAuditLog({
        user_id: user.id,
        organization_id: user.organization_id,
        action: 'user_login_success',
        resource_type: 'user',
        resource_id: user.id,
      });
    } catch (err) {
      logger.error('Failed to create audit log for successful login', { error: err, userId: user.id });
    }

    // User session creation is handled at the API route level

    try {
      await createNotification({
        user_id: user.id,
        type: 'login',
        title: 'Novo login detectado',
        message: 'Um novo login foi realizado na sua conta.',
        is_read: false,
        sent_via_email: false,
      });
    } catch (err) {
      logger.error('Failed to send login notification', { error: err, userId: user.id });
    }

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(data: ChangePasswordDTO): Promise<void> {
    const userBasic = await this.userRepo.findById(data.user_id);

    if (!userBasic) {
      throw new Error('User not found');
    }

    // Get user with password for verification
    const fullUser = await this.userRepo.findByEmailWithPassword(userBasic.email);
    if (!fullUser) {
      throw new Error('User not found');
    }

    // Verify current password
    const currentPasswordMatch = await bcrypt.compare(data.current_password, fullUser.password_hash || '');

    if (!currentPasswordMatch) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(data.new_password);

    // Business Rule: New password must be different from current
    const samePassword = await bcrypt.compare(data.new_password, fullUser.password_hash || '');
    if (samePassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(data.new_password, this.SALT_ROUNDS);

    // Save old password hash to history before updating
    try {
      await executeRun('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)', [data.user_id, fullUser.password_hash || '']);
    } catch (err) {
      logger.error('Failed to save password history', { error: err, userId: data.user_id });
    }

    // Update password
    await this.userRepo.updatePassword(data.user_id, newPasswordHash);

    try {
      await executeRun('DELETE FROM user_sessions WHERE user_id = ?', [data.user_id]);
    } catch (err) {
      logger.error('Failed to invalidate sessions after password change', { error: err, userId: data.user_id });
    }

    try {
      await createNotification({
        user_id: data.user_id,
        type: 'password_changed',
        title: 'Senha alterada',
        message: 'Sua senha foi alterada com sucesso. Se você não fez essa alteração, entre em contato com o suporte.',
        is_read: false,
        sent_via_email: true,
      });
    } catch (err) {
      logger.error('Failed to send password change notification', { error: err, userId: data.user_id });
    }

    try {
      await createAuditLog({
        user_id: data.user_id,
        organization_id: userBasic.organization_id,
        action: 'user_password_changed',
        resource_type: 'user',
        resource_id: data.user_id,
      });
    } catch (err) {
      logger.error('Failed to create audit log for password change', { error: err, userId: data.user_id });
    }
  }

  /**
   * Reset password (admin function)
   */
  async resetPassword(userId: number, newPassword: string, resetBy: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password
    await this.userRepo.updatePassword(userId, passwordHash);

    try {
      await executeRun('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    } catch (err) {
      logger.error('Failed to invalidate sessions after password reset', { error: err, userId });
    }

    try {
      await createNotification({
        user_id: userId,
        type: 'password_reset',
        title: 'Senha redefinida',
        message: 'Sua senha foi redefinida por um administrador. Caso não tenha solicitado, entre em contato com o suporte.',
        is_read: false,
        sent_via_email: true,
      });
    } catch (err) {
      logger.error('Failed to send password reset notification', { error: err, userId });
    }

    try {
      await createAuditLog({
        user_id: resetBy,
        organization_id: user.organization_id,
        action: 'user_password_reset',
        resource_type: 'user',
        resource_id: userId,
      });
    } catch (err) {
      logger.error('Failed to create audit log for password reset', { error: err, userId });
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: number, deactivatedBy: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('User is already inactive');
    }

    await this.userRepo.update(userId, { is_active: false });

    try {
      await executeRun('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    } catch (err) {
      logger.error('Failed to invalidate sessions after deactivation', { error: err, userId });
    }

    try {
      await executeRun("UPDATE tickets SET assigned_to = NULL WHERE assigned_to = ? AND organization_id = ? AND status_id NOT IN (3, 4)", [userId, user.organization_id]);
    } catch (err) {
      logger.error('Failed to reassign tickets after deactivation', { error: err, userId });
    }

    try {
      await createNotification({
        user_id: userId,
        type: 'account_deactivated',
        title: 'Conta desativada',
        message: 'Sua conta foi desativada. Entre em contato com o administrador para mais informações.',
        is_read: false,
        sent_via_email: true,
      });
    } catch (err) {
      logger.error('Failed to send deactivation notification', { error: err, userId });
    }

    try {
      await createAuditLog({
        user_id: deactivatedBy,
        organization_id: user.organization_id,
        action: 'user_deactivated',
        resource_type: 'user',
        resource_id: userId,
      });
    } catch (err) {
      logger.error('Failed to create audit log for user deactivation', { error: err, userId });
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId: number, activatedBy: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.is_active) {
      throw new Error('User is already active');
    }

    await this.userRepo.update(userId, { is_active: true });

    try {
      await createNotification({
        user_id: userId,
        type: 'account_activated',
        title: 'Conta reativada',
        message: 'Sua conta foi reativada. Você já pode acessar o sistema normalmente.',
        is_read: false,
        sent_via_email: true,
      });
    } catch (err) {
      logger.error('Failed to send activation notification', { error: err, userId });
    }

    try {
      await createAuditLog({
        user_id: activatedBy,
        organization_id: user.organization_id,
        action: 'user_activated',
        resource_type: 'user',
        resource_id: userId,
      });
    } catch (err) {
      logger.error('Failed to create audit log for user activation', { error: err, userId });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<User | null> {
    return this.userRepo.findById(userId);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findByEmail(email);
  }

  /**
   * Get all users in organization
   */
  async getUsersByOrganization(organizationId: number): Promise<User[]> {
    return this.userRepo.findByOrganization(organizationId);
  }

  /**
   * Get agents in organization
   */
  async getAgents(organizationId: number): Promise<User[]> {
    return this.userRepo.findAgents(organizationId);
  }

  /**
   * Get admins in organization
   */
  async getAdmins(organizationId: number): Promise<User[]> {
    return this.userRepo.findAdmins(organizationId);
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (!password || password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`);
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
