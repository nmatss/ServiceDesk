import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/db/adapter', () => ({
  executeQuery: vi.fn(() => []),
  executeQueryOne: vi.fn(() => undefined),
  executeRun: vi.fn(() => ({ changes: 1 })),
}));

vi.mock('@/lib/monitoring/structured-logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('otplib', () => ({
  authenticator: {
    generateSecret: vi.fn(() => 'JBSWY3DPEHPK3PXP'),
    keyuri: vi.fn(() => 'otpauth://totp/ServiceDesk:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=ServiceDesk'),
    verify: vi.fn(({ token }: { token: string }) => token === '123456'),
  },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')) },
}));

import { mfaManager } from '../mfa-manager';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';

const mockExecuteQueryOne = vi.mocked(executeQueryOne);
const mockExecuteRun = vi.mocked(executeRun);

describe('MFAManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MFA_SECRET = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8'; // 32 chars, no weak patterns
  });

  // ─── generateTOTPSetup ───────────────────────────────────────────────

  describe('generateTOTPSetup', () => {
    it('returns setup data when user exists', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce({
        id: 1,
        email: 'user@test.com',
        name: 'Test User',
      } as any);

      const result = await mfaManager.generateTOTPSetup(1);

      expect(result).not.toBeNull();
      expect(result!.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result!.qrCodeUrl).toBe('data:image/png;base64,mock');
      expect(result!.backupCodes).toHaveLength(10);
      expect(result!.manualEntryKey).toBeTruthy();
    });

    it('returns null when user not found', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce(undefined);

      const result = await mfaManager.generateTOTPSetup(999);

      expect(result).toBeNull();
    });
  });

  // ─── enableTOTP ─────────────────────────────────────────────────────

  describe('enableTOTP', () => {
    it('succeeds with valid token', async () => {
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // UPDATE users
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // INSERT audit log

      const result = await mfaManager.enableTOTP(1, 'JBSWY3DPEHPK3PXP', '123456', ['code1', 'code2']);

      expect(result).toBe(true);
      expect(mockExecuteRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['JBSWY3DPEHPK3PXP'])
      );
    });

    it('fails with invalid token', async () => {
      const result = await mfaManager.enableTOTP(1, 'JBSWY3DPEHPK3PXP', '000000', ['code1']);

      expect(result).toBe(false);
      // Should not have attempted to update the database
      expect(mockExecuteRun).not.toHaveBeenCalled();
    });
  });

  // ─── verifyTOTP ─────────────────────────────────────────────────────

  describe('verifyTOTP', () => {
    it('returns valid when token matches', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce({
        two_factor_enabled: 1,
        two_factor_secret: 'JBSWY3DPEHPK3PXP',
      } as any);

      const result = await mfaManager.verifyTOTP(1, '123456');

      expect(result.isValid).toBe(true);
      expect(result.method).toBe('totp');
    });

    it('returns invalid when MFA not enabled', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce({
        two_factor_enabled: 0,
        two_factor_secret: null,
      } as any);

      const result = await mfaManager.verifyTOTP(1, '123456');

      expect(result.isValid).toBe(false);
      expect(result.method).toBe('totp');
    });
  });

  // ─── verifyBackupCode ───────────────────────────────────────────────

  describe('verifyBackupCode', () => {
    it('returns invalid when MFA not enabled', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce({
        two_factor_enabled: 0,
        two_factor_backup_codes: null,
      } as any);

      const result = await mfaManager.verifyBackupCode(1, 'abcd-efgh');

      expect(result.isValid).toBe(false);
      expect(result.method).toBe('backup_code');
    });
  });

  // ─── generateSMSCode ───────────────────────────────────────────────

  describe('generateSMSCode', () => {
    it('stores code in verification_codes table', async () => {
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // INSERT verification_codes
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // INSERT audit log

      const result = await mfaManager.generateSMSCode(1, '+5511999999999');

      expect(result).toBe(true);
      expect(mockExecuteRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO verification_codes'),
        expect.arrayContaining([1])
      );
    });
  });

  // ─── generateEmailCode ─────────────────────────────────────────────

  describe('generateEmailCode', () => {
    it('returns false when user not found', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce(undefined);

      const result = await mfaManager.generateEmailCode(999);

      expect(result).toBe(false);
    });
  });

  // ─── disableMFA ─────────────────────────────────────────────────────

  describe('disableMFA', () => {
    it('clears user MFA fields', async () => {
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // UPDATE users
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // INSERT audit log

      const result = await mfaManager.disableMFA(1);

      expect(result).toBe(true);
      expect(mockExecuteRun).toHaveBeenCalledWith(
        expect.stringContaining('two_factor_enabled = 0'),
        expect.arrayContaining([1])
      );
      expect(mockExecuteRun).toHaveBeenCalledWith(
        expect.stringContaining('two_factor_secret = NULL'),
        expect.arrayContaining([1])
      );
    });

    it('returns false when user not found (changes=0)', async () => {
      mockExecuteRun.mockResolvedValueOnce({ changes: 0 });

      const result = await mfaManager.disableMFA(999);

      expect(result).toBe(false);
    });
  });

  // ─── getMFAStatus ───────────────────────────────────────────────────

  describe('getMFAStatus', () => {
    it('returns disabled when user not found', async () => {
      mockExecuteQueryOne.mockResolvedValueOnce(undefined);

      const result = await mfaManager.getMFAStatus(999);

      expect(result).toEqual({
        enabled: false,
        methods: [],
        backup_codes_remaining: 0,
      });
    });

    it('returns enabled with methods when MFA active', async () => {
      const hashedCodes = ['aabbccdd', 'eeff0011', '22334455'];
      mockExecuteQueryOne.mockResolvedValueOnce({
        two_factor_enabled: 1,
        two_factor_secret: 'JBSWY3DPEHPK3PXP',
        two_factor_backup_codes: JSON.stringify(hashedCodes),
      } as any);

      const result = await mfaManager.getMFAStatus(1);

      expect(result.enabled).toBe(true);
      expect(result.methods).toContain('totp');
      expect(result.methods).toContain('backup_codes');
      expect(result.backup_codes_remaining).toBe(3);
    });
  });

  // ─── generateNewBackupCodes ─────────────────────────────────────────

  describe('generateNewBackupCodes', () => {
    it('returns codes when MFA enabled', async () => {
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // UPDATE users
      mockExecuteRun.mockResolvedValueOnce({ changes: 1 }); // INSERT audit log

      const result = await mfaManager.generateNewBackupCodes(1);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(10);
      // Each backup code should be in XXXX-XXXX format
      result!.forEach((code) => {
        expect(code).toMatch(/^[a-f0-9]{4}-[a-f0-9]{4}$/);
      });
    });
  });

  // ─── verifyMFA ──────────────────────────────────────────────────────

  describe('verifyMFA', () => {
    it('tries TOTP first then backup code when no method specified', async () => {
      // First call: verifyTOTP queries the user — TOTP fails (not enabled)
      mockExecuteQueryOne.mockResolvedValueOnce({
        two_factor_enabled: 0,
        two_factor_secret: null,
      } as any);

      // Second call: verifyBackupCode queries the user — also not enabled
      mockExecuteQueryOne.mockResolvedValueOnce({
        two_factor_enabled: 0,
        two_factor_backup_codes: null,
      } as any);

      const result = await mfaManager.verifyMFA(1, 'somecode');

      expect(result.isValid).toBe(false);
      // Should have queried twice: once for TOTP, once for backup code
      expect(mockExecuteQueryOne).toHaveBeenCalledTimes(2);
    });
  });

  // ─── MFA_SECRET validation ──────────────────────────────────────────

  describe('MFA_SECRET validation', () => {
    it('throws on missing secret', async () => {
      delete process.env.MFA_SECRET;

      // enableTOTP calls getMFASecret() internally when hashing backup codes
      // authenticator.verify returns true for '123456'
      await expect(
        mfaManager.enableTOTP(1, 'JBSWY3DPEHPK3PXP', '123456', ['code1'])
      ).resolves.toBe(false);

      // The error is caught internally and logged; method returns false
      // Let's also verify generateNewBackupCodes which also calls getMFASecret
      const codes = await mfaManager.generateNewBackupCodes(1);
      expect(codes).toBeNull();
    });

    it('throws on short secret', async () => {
      process.env.MFA_SECRET = 'tooshort';

      // enableTOTP with valid token triggers getMFASecret for hashing backup codes
      const result = await mfaManager.enableTOTP(1, 'JBSWY3DPEHPK3PXP', '123456', ['code1']);
      expect(result).toBe(false);

      // generateNewBackupCodes also calls getMFASecret
      const codes = await mfaManager.generateNewBackupCodes(1);
      expect(codes).toBeNull();
    });
  });
});
