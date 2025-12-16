import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import db from '../db/connection';
import { User } from '../types/database';
import logger from '../monitoring/structured-logger';

export interface MFASetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MFAVerification {
  isValid: boolean;
  method: 'totp' | 'backup_code' | 'sms' | 'email';
  remaining_backup_codes?: number;
}

export interface MFADevice {
  id: string;
  name: string;
  type: 'app' | 'sms' | 'email' | 'hardware_token';
  enabled: boolean;
  created_at: string;
  last_used_at?: string;
}

class MFAManager {
  private readonly BACKUP_CODE_COUNT = 10;
  private readonly SMS_CODE_LENGTH = 6;
  private readonly EMAIL_CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_MINUTES = 10;

  /**
   * Generate MFA setup for TOTP (Time-based One-Time Password)
   */
  async generateTOTPSetup(userId: number, issuer: string = 'ServiceDesk'): Promise<MFASetup | null> {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
      if (!user) return null;

      // Generate secret
      const secret = authenticator.generateSecret();

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Generate QR code URL
      const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

      // Format manual entry key (groups of 4 characters)
      const manualEntryKey = secret.replace(/(.{4})/g, '$1 ').trim();

      return {
        secret,
        qrCodeUrl,
        backupCodes,
        manualEntryKey
      };
    } catch (error) {
      logger.error('Error generating TOTP setup', error);
      return null;
    }
  }

  /**
   * Enable TOTP for user
   */
  async enableTOTP(userId: number, secret: string, token: string, backupCodes: string[]): Promise<boolean> {
    try {
      // Verify the token first
      const isValid = authenticator.verify({ token, secret });
      if (!isValid) return false;

      // Hash backup codes
      const hashedBackupCodes = backupCodes.map(code =>
        createHmac('sha256', process.env.MFA_SECRET || 'default-mfa-secret')
          .update(code)
          .digest('hex')
      );

      // Update user record
      const stmt = db.prepare(`
        UPDATE users
        SET two_factor_enabled = 1,
            two_factor_secret = ?,
            two_factor_backup_codes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(secret, JSON.stringify(hashedBackupCodes), userId);

      if (result.changes > 0) {
        // Log the MFA enablement
        this.logMFAEvent(userId, 'mfa_enabled', 'totp');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error enabling TOTP', error);
      return false;
    }
  }

  /**
   * Verify TOTP token
   */
  verifyTOTP(userId: number, token: string): MFAVerification {
    try {
      const user = db.prepare(`
        SELECT two_factor_enabled, two_factor_secret
        FROM users WHERE id = ?
      `).get(userId) as any;

      if (!user?.two_factor_enabled || !user.two_factor_secret) {
        return { isValid: false, method: 'totp' };
      }

      const isValid = authenticator.verify({
        token,
        secret: user.two_factor_secret
      });

      if (isValid) {
        this.logMFAEvent(userId, 'mfa_verified', 'totp');
      }

      return { isValid, method: 'totp' };
    } catch (error) {
      logger.error('Error verifying TOTP', error);
      return { isValid: false, method: 'totp' };
    }
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(userId: number, code: string): MFAVerification {
    try {
      const user = db.prepare(`
        SELECT two_factor_enabled, two_factor_backup_codes
        FROM users WHERE id = ?
      `).get(userId) as any;

      if (!user?.two_factor_enabled || !user.two_factor_backup_codes) {
        return { isValid: false, method: 'backup_code' };
      }

      const backupCodes: string[] = JSON.parse(user.two_factor_backup_codes);
      const codeHash = createHmac('sha256', process.env.MFA_SECRET || 'default-mfa-secret')
        .update(code.toLowerCase().replace(/\s/g, ''))
        .digest('hex');

      const codeIndex = backupCodes.findIndex(storedHash =>
        timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(codeHash, 'hex'))
      );

      if (codeIndex === -1) {
        return { isValid: false, method: 'backup_code' };
      }

      // Remove used backup code
      backupCodes.splice(codeIndex, 1);

      // Update user record
      db.prepare(`
        UPDATE users
        SET two_factor_backup_codes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(backupCodes), userId);

      this.logMFAEvent(userId, 'mfa_verified', 'backup_code');

      return {
        isValid: true,
        method: 'backup_code',
        remaining_backup_codes: backupCodes.length
      };
    } catch (error) {
      logger.error('Error verifying backup code', error);
      return { isValid: false, method: 'backup_code' };
    }
  }

  /**
   * Generate and send SMS code
   */
  async generateSMSCode(userId: number, _phoneNumber: string): Promise<boolean> {
    try {
      const code = this.generateNumericCode(this.SMS_CODE_LENGTH);
      const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);
      const hashedCode = this.hashVerificationCode(code);

      // Store verification code
      db.prepare(`
        INSERT INTO verification_codes
        (user_id, code, code_hash, type, expires_at, max_attempts)
        VALUES (?, ?, ?, 'two_factor_sms', ?, 3)
      `).run(userId, code, hashedCode, expiresAt.toISOString());

      // TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
      // SECURITY FIX: Never log MFA codes in production
      if (process.env.NODE_ENV === 'development') {
        logger.debug('SMS MFA code generated for user', { userId, codeLength: code.length });
      }

      this.logMFAEvent(userId, 'sms_code_sent');
      return true;
    } catch (error) {
      logger.error('Error generating SMS code', error);
      return false;
    }
  }

  /**
   * Verify SMS code
   */
  verifySMSCode(userId: number, code: string): MFAVerification {
    try {
      const verificationRecord = db.prepare(`
        SELECT * FROM verification_codes
        WHERE user_id = ? AND type = 'two_factor_sms'
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
          AND attempts < max_attempts
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId) as any;

      if (!verificationRecord) {
        return { isValid: false, method: 'sms' };
      }

      // Increment attempts
      db.prepare(`
        UPDATE verification_codes
        SET attempts = attempts + 1
        WHERE id = ?
      `).run(verificationRecord.id);

      const hashedCode = this.hashVerificationCode(code);
      const isValid = timingSafeEqual(
        Buffer.from(verificationRecord.code_hash, 'hex'),
        Buffer.from(hashedCode, 'hex')
      );

      if (isValid) {
        // Mark code as used
        db.prepare(`
          UPDATE verification_codes
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(verificationRecord.id);

        this.logMFAEvent(userId, 'mfa_verified', 'sms');
      }

      return { isValid, method: 'sms' };
    } catch (error) {
      logger.error('Error verifying SMS code', error);
      return { isValid: false, method: 'sms' };
    }
  }

  /**
   * Generate and send email code
   */
  async generateEmailCode(userId: number): Promise<boolean> {
    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as any;
      if (!user) return false;

      const code = this.generateNumericCode(this.EMAIL_CODE_LENGTH);
      const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);
      const hashedCode = this.hashVerificationCode(code);

      // Store verification code
      db.prepare(`
        INSERT INTO verification_codes
        (user_id, email, code, code_hash, type, expires_at, max_attempts)
        VALUES (?, ?, ?, ?, 'two_factor_email', ?, 3)
      `).run(userId, user.email, code, hashedCode, expiresAt.toISOString());

      // TODO: Send email with code using email service
      // SECURITY FIX: Never log MFA codes in production
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Email MFA code generated for user', { userId, email: user.email, codeLength: code.length });
      }

      this.logMFAEvent(userId, 'email_code_sent');
      return true;
    } catch (error) {
      logger.error('Error generating email code', error);
      return false;
    }
  }

  /**
   * Verify email code
   */
  verifyEmailCode(userId: number, code: string): MFAVerification {
    try {
      const verificationRecord = db.prepare(`
        SELECT * FROM verification_codes
        WHERE user_id = ? AND type = 'two_factor_email'
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
          AND attempts < max_attempts
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId) as any;

      if (!verificationRecord) {
        return { isValid: false, method: 'email' };
      }

      // Increment attempts
      db.prepare(`
        UPDATE verification_codes
        SET attempts = attempts + 1
        WHERE id = ?
      `).run(verificationRecord.id);

      const hashedCode = this.hashVerificationCode(code);
      const isValid = timingSafeEqual(
        Buffer.from(verificationRecord.code_hash, 'hex'),
        Buffer.from(hashedCode, 'hex')
      );

      if (isValid) {
        // Mark code as used
        db.prepare(`
          UPDATE verification_codes
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(verificationRecord.id);

        this.logMFAEvent(userId, 'mfa_verified', 'email');
      }

      return { isValid, method: 'email' };
    } catch (error) {
      logger.error('Error verifying email code', error);
      return { isValid: false, method: 'email' };
    }
  }

  /**
   * Disable MFA for user
   */
  disableMFA(userId: number): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE users
        SET two_factor_enabled = 0,
            two_factor_secret = NULL,
            two_factor_backup_codes = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(userId);

      if (result.changes > 0) {
        this.logMFAEvent(userId, 'mfa_disabled');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error disabling MFA', error);
      return false;
    }
  }

  /**
   * Get user's MFA status
   */
  getMFAStatus(userId: number): {
    enabled: boolean;
    methods: string[];
    backup_codes_remaining: number;
  } {
    try {
      const user = db.prepare(`
        SELECT two_factor_enabled, two_factor_secret, two_factor_backup_codes
        FROM users WHERE id = ?
      `).get(userId) as any;

      if (!user) {
        return { enabled: false, methods: [], backup_codes_remaining: 0 };
      }

      const methods: string[] = [];
      let backupCodesRemaining = 0;

      if (user.two_factor_enabled) {
        if (user.two_factor_secret) {
          methods.push('totp');
        }

        if (user.two_factor_backup_codes) {
          const backupCodes = JSON.parse(user.two_factor_backup_codes);
          backupCodesRemaining = backupCodes.length;
          if (backupCodesRemaining > 0) {
            methods.push('backup_codes');
          }
        }
      }

      return {
        enabled: !!user.two_factor_enabled,
        methods,
        backup_codes_remaining: backupCodesRemaining
      };
    } catch (error) {
      logger.error('Error getting MFA status', error);
      return { enabled: false, methods: [], backup_codes_remaining: 0 };
    }
  }

  /**
   * Generate new backup codes
   */
  generateNewBackupCodes(userId: number): string[] | null {
    try {
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(code =>
        createHmac('sha256', process.env.MFA_SECRET || 'default-mfa-secret')
          .update(code)
          .digest('hex')
      );

      const stmt = db.prepare(`
        UPDATE users
        SET two_factor_backup_codes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND two_factor_enabled = 1
      `);

      const result = stmt.run(JSON.stringify(hashedBackupCodes), userId);

      if (result.changes > 0) {
        this.logMFAEvent(userId, 'backup_codes_regenerated');
        return backupCodes;
      }

      return null;
    } catch (error) {
      logger.error('Error generating new backup codes', error);
      return null;
    }
  }

  /**
   * Verify any MFA method
   */
  async verifyMFA(userId: number, code: string, method?: string): Promise<MFAVerification> {
    // Try TOTP first if no method specified
    if (!method || method === 'totp') {
      const totpResult = this.verifyTOTP(userId, code);
      if (totpResult.isValid) return totpResult;
    }

    // Try backup code
    if (!method || method === 'backup_code') {
      const backupResult = this.verifyBackupCode(userId, code);
      if (backupResult.isValid) return backupResult;
    }

    // Try SMS if method specified
    if (method === 'sms') {
      return this.verifySMSCode(userId, code);
    }

    // Try email if method specified
    if (method === 'email') {
      return this.verifyEmailCode(userId, code);
    }

    return { isValid: false, method: method as any || 'totp' };
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      const code = randomBytes(4).toString('hex').toLowerCase();
      // Format as XXXX-XXXX
      const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
      codes.push(formattedCode);
    }
    return codes;
  }

  /**
   * Generate numeric code
   */
  private generateNumericCode(length: number): string {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Hash verification code
   */
  private hashVerificationCode(code: string): string {
    return createHmac('sha256', process.env.MFA_SECRET || 'default-mfa-secret')
      .update(code.toLowerCase().replace(/\s/g, ''))
      .digest('hex');
  }

  /**
   * Log MFA event for audit
   */
  private logMFAEvent(userId: number, eventType: string, method?: string): void {
    try {
      db.prepare(`
        INSERT INTO auth_audit_logs (user_id, event_type, details)
        VALUES (?, ?, ?)
      `).run(userId, eventType, JSON.stringify({ method }));
    } catch (error) {
      logger.error('Error logging MFA event', error);
    }
  }
}

export const mfaManager = new MFAManager();
export default mfaManager;