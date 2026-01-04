/**
 * Unit Tests for UserService
 *
 * Tests authentication, user management, and security features.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '../user-service';
import type { IUserRepository } from '@/lib/interfaces/repositories';
import type { User } from '@/lib/types/database';
import bcrypt from 'bcryptjs';

// Mock UserRepository
class MockUserRepository implements Partial<IUserRepository> {
  private users: Map<number, User> = new Map();
  private nextId = 1;

  async findById(id: number): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    // Remove password hash before returning
    const { password_hash, ...userWithoutPassword } = user as any;
    return userWithoutPassword as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = Array.from(this.users.values());
    const user = users.find((u) => u.email === email);
    if (!user) return null;

    // Remove password hash
    const { password_hash, ...userWithoutPassword } = user as any;
    return userWithoutPassword as User;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const users = Array.from(this.users.values());
    return users.find((u) => u.email === email) || null;
  }

  async create(data: Partial<User>): Promise<User> {
    const user: User = {
      id: this.nextId++,
      name: data.name!,
      email: data.email!,
      password_hash: data.password_hash,
      role: data.role || 'user',
      organization_id: data.organization_id!,
      is_active: data.is_active ?? true,
      is_email_verified: data.is_email_verified ?? false,
      timezone: data.timezone || 'America/Sao_Paulo',
      language: data.language || 'pt-BR',
      two_factor_enabled: data.two_factor_enabled ?? false,
      failed_login_attempts: data.failed_login_attempts ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as User;

    this.users.set(user.id, user);

    // Return without password hash
    const { password_hash, ...userWithoutPassword } = user as any;
    return userWithoutPassword as User;
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');

    const updated = { ...user, ...data, updated_at: new Date().toISOString() };
    this.users.set(id, updated);

    const { password_hash, ...userWithoutPassword } = updated as any;
    return userWithoutPassword as User;
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      (user as any).password_hash = passwordHash;
      user.updated_at = new Date().toISOString();
    }
  }

  async incrementFailedLoginAttempts(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.failed_login_attempts++;
      if (user.failed_login_attempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        user.locked_until = lockUntil.toISOString();
      }
    }
  }

  async resetFailedLoginAttempts(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.failed_login_attempts = 0;
      user.locked_until = undefined;
    }
  }

  async lockAccount(userId: number, until: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.locked_until = until;
    }
  }

  async unlockAccount(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.locked_until = undefined;
      user.failed_login_attempts = 0;
    }
  }

  async updateLastLogin(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.last_login_at = new Date().toISOString();
    }
  }

  reset() {
    this.users.clear();
    this.nextId = 1;
  }
}

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: MockUserRepository;

  beforeEach(() => {
    mockUserRepo = new MockUserRepository();
    userService = new UserService(mockUserRepo as any);
  });

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecureP@ssw0rd!',
        role: 'user' as const,
        organization_id: 1,
      };

      // Act
      const user = await userService.createUser(userData);

      // Assert
      expect(user).toBeDefined();
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect((user as any).password_hash).toBeUndefined(); // Should not expose password hash
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecureP@ssw0rd!',
        role: 'user' as const,
        organization_id: 1,
      };

      await userService.createUser(userData);

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Email already registered');
    });

    it('should throw error for invalid email', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'SecureP@ssw0rd!',
        role: 'user' as const,
        organization_id: 1,
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for short password', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Short1!', // Less than 8 characters
        role: 'user' as const,
        organization_id: 1,
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('at least 8 characters');
    });

    it('should throw error for password without uppercase', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123!',
        role: 'user' as const,
        organization_id: 1,
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('uppercase letter');
    });

    it('should throw error for password without number', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password!',
        role: 'user' as const,
        organization_id: 1,
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('number');
    });

    it('should throw error for password without special character', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        role: 'user' as const,
        organization_id: 1,
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('special character');
    });

    it('should throw error for short name', async () => {
      // Arrange
      const userData = {
        name: 'J', // Too short
        email: 'john@example.com',
        password: 'SecureP@ssw0rd!',
        role: 'user' as const,
        organization_id: 1,
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('at least 2 characters');
    });
  });

  describe('login', () => {
    it('should authenticate user with correct credentials', async () => {
      // Arrange
      const password = 'SecureP@ssw0rd!';
      const passwordHash = await bcrypt.hash(password, 12);

      await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: passwordHash,
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
      });

      // Act
      const user = await userService.login({
        email: 'john@example.com',
        password: password,
      });

      // Assert
      expect(user).toBeDefined();
      expect(user.email).toBe('john@example.com');
      expect((user as any).password_hash).toBeUndefined();
    });

    it('should throw error for non-existent user', async () => {
      // Act & Assert
      await expect(
        userService.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      // Arrange
      const password = 'SecureP@ssw0rd!';
      const passwordHash = await bcrypt.hash(password, 12);

      await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: passwordHash,
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      // Act & Assert
      await expect(
        userService.login({
          email: 'john@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      // Arrange
      const password = 'SecureP@ssw0rd!';
      const passwordHash = await bcrypt.hash(password, 12);

      await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: passwordHash,
        role: 'user',
        organization_id: 1,
        is_active: false, // Inactive
      });

      // Act & Assert
      await expect(
        userService.login({
          email: 'john@example.com',
          password: password,
        })
      ).rejects.toThrow('inactive');
    });

    it('should throw error for locked account', async () => {
      // Arrange
      const password = 'SecureP@ssw0rd!';
      const passwordHash = await bcrypt.hash(password, 12);

      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 30);

      await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: passwordHash,
        role: 'user',
        organization_id: 1,
        is_active: true,
        locked_until: lockUntil.toISOString(),
      });

      // Act & Assert
      await expect(
        userService.login({
          email: 'john@example.com',
          password: password,
        })
      ).rejects.toThrow('locked');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const oldPassword = 'OldP@ssw0rd!';
      const newPassword = 'NewP@ssw0rd!';
      const oldPasswordHash = await bcrypt.hash(oldPassword, 12);

      const user = await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: oldPasswordHash,
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      // Act
      await userService.changePassword({
        user_id: user.id,
        current_password: oldPassword,
        new_password: newPassword,
      });

      // Verify new password works
      const loggedInUser = await userService.login({
        email: 'john@example.com',
        password: newPassword,
      });

      // Assert
      expect(loggedInUser).toBeDefined();
    });

    it('should throw error for incorrect current password', async () => {
      // Arrange
      const password = 'CurrentP@ssw0rd!';
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: passwordHash,
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      // Act & Assert
      await expect(
        userService.changePassword({
          user_id: user.id,
          current_password: 'WrongP@ssw0rd!',
          new_password: 'NewP@ssw0rd!',
        })
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error when new password same as current', async () => {
      // Arrange
      const password = 'SameP@ssw0rd!';
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: passwordHash,
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      // Act & Assert
      await expect(
        userService.changePassword({
          user_id: user.id,
          current_password: password,
          new_password: password, // Same as current
        })
      ).rejects.toThrow('must be different from current password');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Arrange
      const user = await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      // Act
      const updated = await userService.updateUser(
        user.id,
        { name: 'John Updated' },
        1
      );

      // Assert
      expect(updated.name).toBe('John Updated');
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      await mockUserRepo.create({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      const user2 = await mockUserRepo.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
      });

      // Act & Assert - Try to change Jane's email to John's email
      await expect(
        userService.updateUser(user2.id, { email: 'john@example.com' }, 1)
      ).rejects.toThrow('Email already registered');
    });
  });
});
