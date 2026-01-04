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

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'agent' | 'user' | 'manager' | 'read_only' | 'api_client' | 'tenant_admin';
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

    // TODO: Send email verification
    // TODO: Create audit log entry
    // TODO: Send welcome email

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
      // TODO: Send new verification email
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

    // TODO: Create audit log entry
    // TODO: Send notification if role changed
    // TODO: Invalidate sessions if role changed or user deactivated

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

      // TODO: Create audit log entry for failed login
      throw new Error('Invalid credentials');
    }

    // Successful login - reset failed attempts
    await this.userRepo.resetFailedLoginAttempts(user.id);
    await this.userRepo.updateLastLogin(user.id);

    // Remove password hash before returning
    delete (user as any).password_hash;

    // TODO: Create audit log entry for successful login
    // TODO: Create user session
    // TODO: Send login notification if enabled

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(data: ChangePasswordDTO): Promise<void> {
    const user = await this.userRepo.findByEmailWithPassword('');
    const userWithPassword = await this.userRepo.findById(data.user_id);

    if (!userWithPassword) {
      throw new Error('User not found');
    }

    // Get user with password for verification
    const fullUser = await this.userRepo.findByEmailWithPassword(userWithPassword.email);
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

    // Update password
    await this.userRepo.updatePassword(data.user_id, newPasswordHash);

    // TODO: Add to password history
    // TODO: Invalidate all sessions except current
    // TODO: Send password change notification email
    // TODO: Create audit log entry
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

    // TODO: Invalidate all user sessions
    // TODO: Send password reset notification
    // TODO: Create audit log entry
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

    // TODO: Invalidate all user sessions
    // TODO: Reassign open tickets
    // TODO: Send deactivation notification
    // TODO: Create audit log entry
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

    // TODO: Send activation notification
    // TODO: Create audit log entry
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
