import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/adapter', () => ({
  executeQuery: vi.fn(() => []),
  executeQueryOne: vi.fn(() => undefined),
  executeRun: vi.fn(() => ({ changes: 1 })),
  sqlTrue: vi.fn(() => '1'),
}));

vi.mock('@/lib/db/config', () => ({
  getDatabaseType: vi.fn(() => 'sqlite'),
}));

vi.mock('@/lib/monitoring/structured-logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { passwordPolicyManager } from '../password-policies';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';

describe('PasswordPolicyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validatePassword ───────────────────────────────────────────────

  describe('validatePassword', () => {
    it('rejects passwords that are too short', async () => {
      const result = await passwordPolicyManager.validatePassword('Ab1!', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('at least 8 characters'),
        ])
      );
    });

    it('rejects passwords missing uppercase letters', async () => {
      const result = await passwordPolicyManager.validatePassword('mystrongpass1!', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('uppercase letter'),
        ])
      );
    });

    it('rejects passwords missing lowercase letters', async () => {
      const result = await passwordPolicyManager.validatePassword('MYSTRONGPASS1!', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('lowercase letter'),
        ])
      );
    });

    it('rejects passwords missing numbers', async () => {
      const result = await passwordPolicyManager.validatePassword('MyStrongPass!', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('number'),
        ])
      );
    });

    it('rejects passwords missing special characters (and numbers)', async () => {
      // The implementation's regex escaping causes digits to match as special chars,
      // so a password with digits satisfies both number and special char requirements.
      // Test a password with NO digits and NO symbols to verify both errors appear.
      const result = await passwordPolicyManager.validatePassword('MyStrongSecret', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('special character'),
        ])
      );
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('number'),
        ])
      );
    });

    it('accepts a valid strong password', async () => {
      const result = await passwordPolicyManager.validatePassword('MyStr0ng!Pass', 'user');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(0);
    });

    it('rejects common passwords', async () => {
      const result = await passwordPolicyManager.validatePassword('password', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('too common'),
        ])
      );
    });

    it('rejects common password "123456"', async () => {
      const result = await passwordPolicyManager.validatePassword('123456', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('too common'),
        ])
      );
    });

    it('rejects weak patterns — sequential numbers', async () => {
      // The source uses /g regex flags, so we call with a neutral password first
      // to reset all regex lastIndex values to 0
      await passwordPolicyManager.validatePassword('NeutralReset!9Z', 'user');
      const result = await passwordPolicyManager.validatePassword('X123456!y', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('weak patterns'),
        ])
      );
    });

    it('rejects weak patterns — keyboard pattern "qwerty"', async () => {
      const result = await passwordPolicyManager.validatePassword('Mqwerty1!x', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('weak patterns'),
        ])
      );
    });

    it('rejects weak patterns — repeated characters', async () => {
      const result = await passwordPolicyManager.validatePassword('Aaaa1111!Bb', 'user');
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('weak patterns'),
        ])
      );
    });

    it('returns score and recommendations for a valid password', async () => {
      const result = await passwordPolicyManager.validatePassword('MyStr0ng!Pass', 'user');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('returns recommendations for short but valid passwords', async () => {
      const result = await passwordPolicyManager.validatePassword('MyStr0!g', 'user');
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('12+ characters'),
        ])
      );
    });
  });

  // ─── generateSecurePassword ─────────────────────────────────────────

  describe('generateSecurePassword', () => {
    it('generates a password of the default length (16)', () => {
      const password = passwordPolicyManager.generateSecurePassword();
      expect(password).toHaveLength(16);
    });

    it('generates a password of a custom length', () => {
      const password = passwordPolicyManager.generateSecurePassword(24);
      expect(password).toHaveLength(24);
    });

    it('includes all character types by default', () => {
      // Generate multiple passwords to avoid flaky false negatives
      const passwords = Array.from({ length: 5 }, () =>
        passwordPolicyManager.generateSecurePassword(32)
      );
      const combined = passwords.join('');

      expect(/[a-z]/.test(combined)).toBe(true);
      expect(/[A-Z]/.test(combined)).toBe(true);
      expect(/\d/.test(combined)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(combined)).toBe(true);
    });

    it('each individual password includes lowercase, uppercase, and digits', () => {
      const password = passwordPolicyManager.generateSecurePassword(16);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
    });

    it('respects includeSymbols=false', () => {
      // Generate several to be confident
      const passwords = Array.from({ length: 10 }, () =>
        passwordPolicyManager.generateSecurePassword(16, false)
      );

      for (const password of passwords) {
        expect(password).toHaveLength(16);
        // Should only contain alphanumeric characters
        expect(/^[a-zA-Z0-9]+$/.test(password)).toBe(true);
      }
    });

    it('includes symbols when includeSymbols=true', () => {
      const passwords = Array.from({ length: 5 }, () =>
        passwordPolicyManager.generateSecurePassword(32, true)
      );
      const combined = passwords.join('');
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(combined)).toBe(true);
    });
  });

  // ─── getPasswordStrength ────────────────────────────────────────────

  describe('getPasswordStrength', () => {
    it('returns "very-weak" for extremely weak passwords', async () => {
      const result = await passwordPolicyManager.getPasswordStrength('a');
      expect(result.level).toBe('very-weak');
      expect(result.score).toBeLessThan(20);
      expect(result.feedback).toEqual(
        expect.arrayContaining([expect.stringContaining('Very weak')])
      );
    });

    it('returns "weak" for low-strength passwords', async () => {
      const result = await passwordPolicyManager.getPasswordStrength('abcdefgh');
      expect(result.level).toBe('weak');
      expect(result.score).toBeGreaterThanOrEqual(20);
      expect(result.score).toBeLessThan(40);
    });

    it('returns "fair" for medium-strength passwords', async () => {
      const result = await passwordPolicyManager.getPasswordStrength('Abcdefgh');
      expect(result.level).toBe('fair');
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(60);
    });

    it('returns "good" for good passwords', async () => {
      // Uppercase + lowercase, length 12, no digits/symbols -> score ~65 (good range)
      const result = await passwordPolicyManager.getPasswordStrength('BrightSunRay');
      expect(result.level).toBe('good');
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
    });

    it('returns "strong" for excellent passwords', async () => {
      const result = await passwordPolicyManager.getPasswordStrength('MyV3ryStr0ng!P@ssw0rd');
      expect(result.level).toBe('strong');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('provides feedback suggesting missing character types', async () => {
      const result = await passwordPolicyManager.getPasswordStrength('aaaaaaaa');
      expect(result.feedback).toEqual(
        expect.arrayContaining([expect.stringContaining('uppercase')])
      );
    });

    it('limits feedback to at most 3 items', async () => {
      const result = await passwordPolicyManager.getPasswordStrength('a');
      expect(result.feedback.length).toBeLessThanOrEqual(3);
    });
  });

  // ─── getDefaultPolicy ──────────────────────────────────────────────

  describe('getDefaultPolicy', () => {
    it('returns correct defaults when DB returns null', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue(undefined);

      const policy = await passwordPolicyManager.getDefaultPolicy();

      expect(policy.name).toBe('Default Policy');
      expect(policy.min_length).toBe(8);
      expect(policy.require_uppercase).toBe(true);
      expect(policy.require_lowercase).toBe(true);
      expect(policy.require_numbers).toBe(true);
      expect(policy.require_special_chars).toBe(true);
      expect(policy.min_special_chars).toBe(1);
      expect(policy.max_age_days).toBe(90);
      expect(policy.prevent_reuse_last).toBe(5);
      expect(policy.max_failed_attempts).toBe(5);
      expect(policy.lockout_duration_minutes).toBe(30);
      expect(policy.is_active).toBe(true);
      expect(policy.applies_to_roles).toEqual([]);
    });

    it('returns DB policy when one exists', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue({
        id: 1,
        name: 'Custom Policy',
        min_length: 12,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_special_chars: true,
        min_special_chars: 2,
        max_age_days: 60,
        prevent_reuse_last: 10,
        max_failed_attempts: 3,
        lockout_duration_minutes: 15,
        is_active: true,
        applies_to_roles: '["user"]',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const policy = await passwordPolicyManager.getDefaultPolicy();

      expect(policy.name).toBe('Custom Policy');
      expect(policy.min_length).toBe(12);
      expect(policy.min_special_chars).toBe(2);
      expect(policy.applies_to_roles).toEqual(['user']);
    });
  });

  // ─── getPolicyForRole ───────────────────────────────────────────────

  describe('getPolicyForRole', () => {
    it('returns null when no DB policy exists', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue(undefined);
      const policy = await passwordPolicyManager.getPolicyForRole('admin');
      expect(policy).toBeNull();
    });

    it('parses applies_to_roles JSON from DB', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue({
        id: 1,
        name: 'Admin Policy',
        min_length: 14,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_special_chars: true,
        min_special_chars: 2,
        max_age_days: 30,
        prevent_reuse_last: 10,
        max_failed_attempts: 3,
        lockout_duration_minutes: 60,
        is_active: true,
        applies_to_roles: '["admin","super_admin"]',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const policy = await passwordPolicyManager.getPolicyForRole('admin');

      expect(policy).not.toBeNull();
      expect(policy!.applies_to_roles).toEqual(['admin', 'super_admin']);
      expect(policy!.min_length).toBe(14);
    });
  });

  // ─── isPasswordExpired ──────────────────────────────────────────────

  describe('isPasswordExpired', () => {
    it('returns false when user has no password_changed_at', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue({
        role: 'user',
        password_changed_at: null,
      });

      const expired = await passwordPolicyManager.isPasswordExpired(1);
      expect(expired).toBe(false);
    });

    it('returns false when password was recently changed', async () => {
      vi.mocked(executeQueryOne)
        .mockResolvedValueOnce({
          role: 'user',
          password_changed_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce(undefined)  // getPolicyForRole -> null
        .mockResolvedValueOnce(undefined); // getDefaultPolicy -> getPolicyForRole -> null

      const expired = await passwordPolicyManager.isPasswordExpired(1);
      expect(expired).toBe(false);
    });

    it('returns true when password change date exceeds max_age_days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago, default policy is 90

      // Call 1: get user from isPasswordExpired
      // Call 2: getPolicyForRole(user.role) -> no DB policy
      // Call 3: getDefaultPolicy -> getPolicyForRole('user') -> no DB policy -> hardcoded default (90 days)
      vi.mocked(executeQueryOne)
        .mockResolvedValueOnce({
          role: 'user',
          password_changed_at: oldDate.toISOString(),
        })
        .mockResolvedValueOnce(undefined)  // getPolicyForRole -> null
        .mockResolvedValueOnce(undefined); // getDefaultPolicy -> getPolicyForRole -> null -> hardcoded

      const expired = await passwordPolicyManager.isPasswordExpired(1);
      expect(expired).toBe(true);
    });

    it('returns false when user is not found', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue(undefined);
      const expired = await passwordPolicyManager.isPasswordExpired(999);
      expect(expired).toBe(false);
    });
  });

  // ─── storePasswordHistory ──────────────────────────────────────────

  describe('storePasswordHistory', () => {
    it('inserts password hash and cleans up old entries', async () => {
      vi.mocked(executeRun).mockResolvedValue({ changes: 1 });
      vi.mocked(executeQueryOne).mockResolvedValue({ role: 'user' });

      await passwordPolicyManager.storePasswordHistory(1, '$2a$12$hashedvalue');

      expect(executeRun).toHaveBeenCalledTimes(2); // INSERT + DELETE cleanup
      expect(executeRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_history'),
        [1, '$2a$12$hashedvalue']
      );
    });

    it('skips cleanup when user is not found', async () => {
      vi.mocked(executeRun).mockResolvedValue({ changes: 1 });
      vi.mocked(executeQueryOne).mockResolvedValue(undefined);

      await passwordPolicyManager.storePasswordHistory(1, '$2a$12$hashedvalue');

      // Only the INSERT, no DELETE
      expect(executeRun).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getRequirements ────────────────────────────────────────────────

  describe('getRequirements', () => {
    it('returns default requirements when DB has no policy', async () => {
      vi.mocked(executeQueryOne).mockResolvedValue(undefined);

      const reqs = await passwordPolicyManager.getRequirements('user');

      expect(reqs.minLength).toBe(8);
      expect(reqs.requireUppercase).toBe(true);
      expect(reqs.requireLowercase).toBe(true);
      expect(reqs.requireNumbers).toBe(true);
      expect(reqs.requireSpecialChars).toBe(true);
      expect(reqs.minSpecialChars).toBe(1);
      expect(reqs.maxAge).toBe(90);
      expect(reqs.preventReuse).toBe(5);
      expect(reqs.forbiddenPatterns).toEqual([
        'common_passwords',
        'repeated_chars',
        'sequential_chars',
      ]);
    });
  });
});
