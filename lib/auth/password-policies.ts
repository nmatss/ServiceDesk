import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import db from '../db/connection';
import logger from '../monitoring/structured-logger';

export interface PasswordPolicy {
  id: number;
  name: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  min_special_chars: number;
  max_age_days: number;
  prevent_reuse_last: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  is_active: boolean;
  applies_to_roles: string[];
  created_at: string;
  updated_at: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number; // Password strength score 0-100
  recommendations: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  minSpecialChars: number;
  forbiddenPatterns: string[];
  maxAge: number;
  preventReuse: number;
}

class PasswordPolicyManager {
  private readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'administrator', 'root', 'user', 'test', 'guest', 'demo',
    '111111', '000000', '123123', 'welcome', 'login', 'pass', '1234'
  ];

  private readonly SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  private readonly WEAK_PATTERNS = [
    /(.)\1{2,}/g, // Repeated characters (aaa, 111)
    /123456|654321/g, // Sequential numbers
    /abcdef|qwerty|asdf/g, // Keyboard patterns
    /password|admin|root|user/gi // Common words
  ];

  /**
   * Get active password policy for user role
   */
  getPolicyForRole(role: string): PasswordPolicy | null {
    try {
      const policy = db.prepare(`
        SELECT * FROM password_policies
        WHERE is_active = 1
          AND (applies_to_roles IS NULL OR json_extract(applies_to_roles, '$') LIKE '%"' || ? || '"%')
        ORDER BY
          CASE WHEN applies_to_roles IS NOT NULL THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 1
      `).get(role) as any;

      if (!policy) return null;

      return {
        ...policy,
        applies_to_roles: policy.applies_to_roles ? JSON.parse(policy.applies_to_roles as string) : []
      } as PasswordPolicy;
    } catch (error) {
      logger.error('Error getting password policy for role', error);
      return null;
    }
  }

  /**
   * Get default password policy
   */
  getDefaultPolicy(): PasswordPolicy {
    const defaultPolicy = this.getPolicyForRole('user');

    return defaultPolicy || {
      id: 0,
      name: 'Default Policy',
      min_length: 8,
      require_uppercase: true,
      require_lowercase: true,
      require_numbers: true,
      require_special_chars: true,
      min_special_chars: 1,
      max_age_days: 90,
      prevent_reuse_last: 5,
      max_failed_attempts: 5,
      lockout_duration_minutes: 30,
      is_active: true,
      applies_to_roles: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string, userRole: string, userId?: number): PasswordValidationResult {
    const policy = this.getPolicyForRole(userRole) || this.getDefaultPolicy();
    const errors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check minimum length
    if (password.length < policy.min_length) {
      errors.push(`Password must be at least ${policy.min_length} characters long`);
    } else {
      score += Math.min(25, (password.length / policy.min_length) * 25);
    }

    // Check uppercase requirement
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    // Check lowercase requirement
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    // Check numbers requirement
    if (policy.require_numbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    // Check special characters requirement
    const specialCharCount = (password.match(new RegExp(`[${this.escapeRegex(this.SPECIAL_CHARS)}]`, 'g')) || []).length;
    if (policy.require_special_chars && specialCharCount < policy.min_special_chars) {
      errors.push(`Password must contain at least ${policy.min_special_chars} special character(s)`);
    } else if (specialCharCount >= policy.min_special_chars) {
      score += Math.min(20, specialCharCount * 5);
    }

    // Check against common passwords
    if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
      score = Math.max(0, score - 30);
    }

    // Check for weak patterns
    for (const pattern of this.WEAK_PATTERNS) {
      if (pattern.test(password)) {
        errors.push('Password contains weak patterns (repeated characters, sequences, or common words)');
        score = Math.max(0, score - 20);
        break;
      }
    }

    // Check password reuse if userId provided
    if (userId && this.isPasswordReused(userId, password, policy.prevent_reuse_last)) {
      errors.push(`Password cannot be one of your last ${policy.prevent_reuse_last} passwords`);
    }

    // Additional entropy check
    const entropy = this.calculateEntropy(password);
    if (entropy < 30) {
      recommendations.push('Consider using a longer password with more varied characters');
    } else if (entropy >= 50) {
      score += 10; // Bonus for high entropy
    }

    // Recommendations based on missing requirements
    if (!policy.require_uppercase && !/[A-Z]/.test(password)) {
      recommendations.push('Consider adding uppercase letters for better security');
    }
    if (!policy.require_special_chars && specialCharCount === 0) {
      recommendations.push('Consider adding special characters for better security');
    }
    if (password.length < 12) {
      recommendations.push('Consider using a longer password (12+ characters) for better security');
    }

    return {
      isValid: errors.length === 0,
      errors,
      score: Math.min(100, score),
      recommendations
    };
  }

  /**
   * Get password requirements for user role
   */
  getRequirements(userRole: string): PasswordRequirements {
    const policy = this.getPolicyForRole(userRole) || this.getDefaultPolicy();

    return {
      minLength: policy.min_length,
      requireUppercase: policy.require_uppercase,
      requireLowercase: policy.require_lowercase,
      requireNumbers: policy.require_numbers,
      requireSpecialChars: policy.require_special_chars,
      minSpecialChars: policy.min_special_chars,
      forbiddenPatterns: ['common_passwords', 'repeated_chars', 'sequential_chars'],
      maxAge: policy.max_age_days,
      preventReuse: policy.prevent_reuse_last
    };
  }

  /**
   * Check if password is expired
   */
  isPasswordExpired(userId: number): boolean {
    try {
      const user = db.prepare(`
        SELECT password_changed_at, role FROM users WHERE id = ?
      `).get(userId) as any | undefined;

      if (!user || !user.password_changed_at) return false;

      const policy = this.getPolicyForRole(user.role as string) || this.getDefaultPolicy();
      const passwordChangedAt = new Date(user.password_changed_at as string);
      const expiryDate = new Date(passwordChangedAt.getTime() + (policy.max_age_days * 24 * 60 * 60 * 1000));

      return new Date() > expiryDate;
    } catch (error) {
      logger.error('Error checking password expiry', error);
      return false;
    }
  }

  /**
   * Get days until password expires
   */
  getDaysUntilExpiry(userId: number): number | null {
    try {
      const user = db.prepare(`
        SELECT password_changed_at, role FROM users WHERE id = ?
      `).get(userId) as any | undefined;

      if (!user || !user.password_changed_at) return null;

      const policy = this.getPolicyForRole(user.role as string) || this.getDefaultPolicy();
      const passwordChangedAt = new Date(user.password_changed_at as string);
      const expiryDate = new Date(passwordChangedAt.getTime() + (policy.max_age_days * 24 * 60 * 60 * 1000));
      const now = new Date();

      if (expiryDate <= now) return 0;

      return Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    } catch (error) {
      logger.error('Error calculating days until expiry', error);
      return null;
    }
  }

  /**
   * Store password in history
   */
  async storePasswordHistory(userId: number, passwordHash: string): Promise<void> {
    try {
      // Add new password to history
      db.prepare(`
        INSERT INTO password_history (user_id, password_hash)
        VALUES (?, ?)
      `).run(userId, passwordHash);

      // Clean up old password history based on policy
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any | undefined;
      if (user) {
        const policy = this.getPolicyForRole(user.role as string) || this.getDefaultPolicy();

        // Keep only the last N passwords
        db.prepare(`
          DELETE FROM password_history
          WHERE user_id = ?
            AND id NOT IN (
              SELECT id FROM password_history
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT ?
            )
        `).run(userId, userId, policy.prevent_reuse_last);
      }
    } catch (error) {
      logger.error('Error storing password history', error);
    }
  }

  /**
   * Check if password was recently used
   */
  private isPasswordReused(userId: number, password: string, preventReuseCount: number): boolean {
    try {
      const recentPasswords = db.prepare(`
        SELECT password_hash FROM password_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, preventReuseCount) as any[];

      for (const record of recentPasswords) {
        if (bcrypt.compareSync(password, record.password_hash as string)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking password reuse', error);
      return false;
    }
  }

  /**
   * Generate password strength meter data
   */
  getPasswordStrength(password: string): {
    score: number;
    level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
    feedback: string[];
  } {
    const result = this.validatePassword(password, 'user');
    const feedback: string[] = [];

    let level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';

    if (result.score < 20) {
      level = 'very-weak';
      feedback.push('Very weak password');
    } else if (result.score < 40) {
      level = 'weak';
      feedback.push('Weak password');
    } else if (result.score < 60) {
      level = 'fair';
      feedback.push('Fair password');
    } else if (result.score < 80) {
      level = 'good';
      feedback.push('Good password');
    } else {
      level = 'strong';
      feedback.push('Strong password');
    }

    // Add specific feedback
    if (password.length < 8) feedback.push('Too short');
    if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
    if (!/[a-z]/.test(password)) feedback.push('Add lowercase letters');
    if (!/\d/.test(password)) feedback.push('Add numbers');
    if (!new RegExp(`[${this.escapeRegex(this.SPECIAL_CHARS)}]`).test(password)) {
      feedback.push('Add special characters');
    }

    return {
      score: result.score,
      level,
      feedback: feedback.slice(0, 3) // Limit to 3 items
    };
  }

  /**
   * Create or update password policy
   */
  savePolicy(policy: Omit<PasswordPolicy, 'id' | 'created_at' | 'updated_at'> & { id?: number }): boolean {
    try {
      const appliesToRoles = JSON.stringify(policy.applies_to_roles);

      if (policy.id) {
        // Update existing policy
        const stmt = db.prepare(`
          UPDATE password_policies
          SET name = ?, min_length = ?, require_uppercase = ?, require_lowercase = ?,
              require_numbers = ?, require_special_chars = ?, min_special_chars = ?,
              max_age_days = ?, prevent_reuse_last = ?, max_failed_attempts = ?,
              lockout_duration_minutes = ?, is_active = ?, applies_to_roles = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        const result = stmt.run(
          policy.name, policy.min_length, policy.require_uppercase ? 1 : 0,
          policy.require_lowercase ? 1 : 0, policy.require_numbers ? 1 : 0,
          policy.require_special_chars ? 1 : 0, policy.min_special_chars,
          policy.max_age_days, policy.prevent_reuse_last, policy.max_failed_attempts,
          policy.lockout_duration_minutes, policy.is_active ? 1 : 0, appliesToRoles,
          policy.id
        );

        return result.changes > 0;
      } else {
        // Create new policy
        const stmt = db.prepare(`
          INSERT INTO password_policies
          (name, min_length, require_uppercase, require_lowercase, require_numbers,
           require_special_chars, min_special_chars, max_age_days, prevent_reuse_last,
           max_failed_attempts, lockout_duration_minutes, is_active, applies_to_roles)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          policy.name, policy.min_length, policy.require_uppercase ? 1 : 0,
          policy.require_lowercase ? 1 : 0, policy.require_numbers ? 1 : 0,
          policy.require_special_chars ? 1 : 0, policy.min_special_chars,
          policy.max_age_days, policy.prevent_reuse_last, policy.max_failed_attempts,
          policy.lockout_duration_minutes, policy.is_active ? 1 : 0, appliesToRoles
        );

        return result.changes > 0;
      }
    } catch (error) {
      logger.error('Error saving password policy', error);
      return false;
    }
  }

  /**
   * Get all password policies
   */
  getAllPolicies(): PasswordPolicy[] {
    try {
      const policies = db.prepare(`
        SELECT * FROM password_policies
        ORDER BY is_active DESC, name ASC
      `).all() as any[];

      return policies.map(policy => ({
        ...policy,
        applies_to_roles: policy.applies_to_roles ? JSON.parse(policy.applies_to_roles as string) : []
      } as PasswordPolicy));
    } catch (error) {
      logger.error('Error getting all password policies', error);
      return [];
    }
  }

  /**
   * Delete password policy
   */
  deletePolicy(policyId: number): boolean {
    try {
      const stmt = db.prepare('DELETE FROM password_policies WHERE id = ?');
      const result = stmt.run(policyId);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error deleting password policy', error);
      return false;
    }
  }

  /**
   * Generate cryptographically secure password
   * Uses crypto.randomBytes for true randomness instead of Math.random()
   */
  generateSecurePassword(length: number = 16, includeSymbols: boolean = true): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = lowercase + uppercase + numbers;
    if (includeSymbols) {
      charset += symbols;
    }

    const passwordChars: string[] = [];

    // Ensure at least one character from each required set using crypto.randomInt
    passwordChars.push(lowercase.charAt(randomInt(0, lowercase.length)));
    passwordChars.push(uppercase.charAt(randomInt(0, uppercase.length)));
    passwordChars.push(numbers.charAt(randomInt(0, numbers.length)));

    if (includeSymbols) {
      passwordChars.push(symbols.charAt(randomInt(0, symbols.length)));
    }

    // Fill the rest using cryptographically secure random
    for (let i = passwordChars.length; i < length; i++) {
      passwordChars.push(charset.charAt(randomInt(0, charset.length)));
    }

    // Fisher-Yates shuffle using crypto.randomInt for secure shuffling
    for (let i = passwordChars.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      const temp = passwordChars[i];
      const temp2 = passwordChars[j];
      if (temp && temp2) {
        [passwordChars[i], passwordChars[j]] = [temp2, temp];
      }
    }

    return passwordChars.join('');
  }

  /**
   * Calculate password entropy
   */
  private calculateEntropy(password: string): number {
    let charsetSize = 0;

    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/\d/.test(password)) charsetSize += 10;
    if (new RegExp(`[${this.escapeRegex(this.SPECIAL_CHARS)}]`).test(password)) charsetSize += this.SPECIAL_CHARS.length;

    return Math.log2(Math.pow(charsetSize, password.length));
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const passwordPolicyManager = new PasswordPolicyManager();
export default passwordPolicyManager;