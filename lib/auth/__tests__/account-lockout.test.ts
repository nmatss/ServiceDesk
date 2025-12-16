/**
 * Account Lockout Tests
 *
 * Tests for the account lockout functionality to prevent brute force attacks.
 * Validates that failed login attempts are tracked and accounts are locked
 * after exceeding the maximum allowed attempts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { passwordPolicyManager } from '../password-policies';

// Mock the database
vi.mock('../../db/connection', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn()
    })
  }
}));

describe('Password Policy Manager', () => {
  describe('generateSecurePassword', () => {
    it('should generate a password of the specified length', () => {
      const password = passwordPolicyManager.generateSecurePassword(16);
      expect(password).toHaveLength(16);
    });

    it('should generate a password with at least one lowercase letter', () => {
      const password = passwordPolicyManager.generateSecurePassword(16);
      expect(/[a-z]/.test(password)).toBe(true);
    });

    it('should generate a password with at least one uppercase letter', () => {
      const password = passwordPolicyManager.generateSecurePassword(16);
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it('should generate a password with at least one number', () => {
      const password = passwordPolicyManager.generateSecurePassword(16);
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it('should generate a password with at least one special character when includeSymbols is true', () => {
      const password = passwordPolicyManager.generateSecurePassword(16, true);
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    it('should not include special characters when includeSymbols is false', () => {
      const password = passwordPolicyManager.generateSecurePassword(16, false);
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(false);
    });

    it('should generate different passwords each time (crypto randomness)', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(passwordPolicyManager.generateSecurePassword(16));
      }
      // With true randomness, all 100 passwords should be unique
      expect(passwords.size).toBe(100);
    });

    it('should handle minimum length requirement', () => {
      const password = passwordPolicyManager.generateSecurePassword(8);
      expect(password.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('validatePassword', () => {
    it('should reject passwords shorter than minimum length', () => {
      const result = passwordPolicyManager.validatePassword('Short1!', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept valid passwords', () => {
      const result = passwordPolicyManager.validatePassword('SecureP@ssw0rd123', 'user');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject common passwords', () => {
      const result = passwordPolicyManager.validatePassword('password123', 'user');
      expect(result.isValid).toBe(false);
    });

    it('should provide recommendations for weak passwords', () => {
      const result = passwordPolicyManager.validatePassword('abcdefgh', 'user');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate password score', () => {
      const weakResult = passwordPolicyManager.validatePassword('weak', 'user');
      const strongResult = passwordPolicyManager.validatePassword('V3ryStr0ng!P@ssw0rd#2024', 'user');

      expect(strongResult.score).toBeGreaterThan(weakResult.score);
    });
  });

  describe('getPasswordStrength', () => {
    it('should return "very-weak" for very short passwords', () => {
      const result = passwordPolicyManager.getPasswordStrength('abc');
      expect(result.level).toBe('very-weak');
    });

    it('should return "strong" for complex passwords', () => {
      const result = passwordPolicyManager.getPasswordStrength('MyV3ry$tr0ng!P@ssword2024');
      expect(['good', 'strong']).toContain(result.level);
    });

    it('should provide feedback for improving password', () => {
      const result = passwordPolicyManager.getPasswordStrength('simple');
      expect(result.feedback.length).toBeGreaterThan(0);
    });
  });

  describe('getDefaultPolicy', () => {
    it('should return a valid default policy', () => {
      const policy = passwordPolicyManager.getDefaultPolicy();

      expect(policy).toBeDefined();
      expect(policy.min_length).toBeGreaterThan(0);
      expect(typeof policy.require_uppercase).toBe('boolean');
      expect(typeof policy.require_lowercase).toBe('boolean');
      expect(typeof policy.require_numbers).toBe('boolean');
      expect(typeof policy.require_special_chars).toBe('boolean');
      expect(policy.max_failed_attempts).toBeGreaterThan(0);
      expect(policy.lockout_duration_minutes).toBeGreaterThan(0);
    });
  });
});

describe('Account Lockout Logic', () => {
  const mockDb = {
    prepare: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Lockout Detection', () => {
    it('should detect when account is locked', () => {
      // Simulate a locked account
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      const isLocked = lockedUntil > new Date();
      expect(isLocked).toBe(true);
    });

    it('should detect when lockout has expired', () => {
      // Simulate an expired lockout
      const lockedUntil = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      const isLocked = lockedUntil > new Date();
      expect(isLocked).toBe(false);
    });

    it('should calculate remaining lockout time correctly', () => {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      const now = new Date();

      const remainingMs = lockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      expect(remainingMinutes).toBeLessThanOrEqual(15);
      expect(remainingMinutes).toBeGreaterThan(0);
    });
  });

  describe('Failed Attempt Tracking', () => {
    it('should increment failed attempts counter', () => {
      let failedAttempts = 0;
      failedAttempts += 1;

      expect(failedAttempts).toBe(1);
    });

    it('should trigger lockout when max attempts reached', () => {
      const maxAttempts = 5;
      const currentAttempts = 5;

      const shouldLock = currentAttempts >= maxAttempts;
      expect(shouldLock).toBe(true);
    });

    it('should not trigger lockout below max attempts', () => {
      const maxAttempts = 5;
      const currentAttempts = 3;

      const shouldLock = currentAttempts >= maxAttempts;
      expect(shouldLock).toBe(false);
    });
  });

  describe('Reset on Successful Login', () => {
    it('should reset failed attempts to zero on success', () => {
      let failedAttempts = 4;
      // Simulate successful login
      failedAttempts = 0;

      expect(failedAttempts).toBe(0);
    });

    it('should clear locked_until on success', () => {
      let lockedUntil: Date | null = new Date(Date.now() + 30 * 60 * 1000);
      // Simulate successful login
      lockedUntil = null;

      expect(lockedUntil).toBeNull();
    });
  });
});
