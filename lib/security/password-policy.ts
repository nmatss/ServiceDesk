/**
 * Enterprise Password Policy Manager
 *
 * Implements comprehensive password security policies:
 * - Configurable complexity requirements
 * - Password history tracking (prevent reuse)
 * - Password expiration policies
 * - Breach detection via HaveIBeenPwned API
 * - Common password blacklist
 */

import * as crypto from 'crypto';
import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';

/**
 * Password policy configuration
 */
export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  historyCount: number; // Number of previous passwords to remember
  maxAge: number; // Days until password must be changed (0 = never)
  preventCommonPasswords: boolean;
  checkBreachedPasswords: boolean;
}

/**
 * Default password policy (enterprise-grade)
 */
export const DEFAULT_POLICY: PasswordPolicyConfig = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  historyCount: 5,
  maxAge: 90, // 90 days
  preventCommonPasswords: true,
  checkBreachedPasswords: true,
};

/**
 * Common weak passwords to block
 */
const COMMON_PASSWORDS = [
  'password', 'Password1!', '12345678', 'qwerty123', 'abc123456',
  'password123', 'admin123', 'welcome123', 'letmein123', 'monkey123',
  'dragon123', '123456789', 'iloveyou', 'admin', 'root', 'toor',
  'Pass@word1', 'Password123!', 'Admin@123', 'Welcome@123'
];

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
}

/**
 * Initialize password_history table
 */
export function initializePasswordHistoryTable(): void {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS password_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `).run();

    // Create index for performance
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_password_history_user
      ON password_history(user_id, tenant_id)
    `).run();

    logger.info('Password history table initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize password history table', error);
  }
}

/**
 * Validate password against policy
 */
export async function validatePassword(
  password: string,
  userId?: number,
  tenantId?: number,
  policy: PasswordPolicyConfig = DEFAULT_POLICY
): Promise<PasswordValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Length check
  if (password.length < policy.minLength) {
    errors.push(`A senha deve ter pelo menos ${policy.minLength} caracteres`);
  }

  // Uppercase check
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula');
  }

  // Lowercase check
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minúscula');
  }

  // Number check
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número');
  }

  // Special character check
  if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('A senha deve conter pelo menos um caractere especial');
  }

  // Common password check
  if (policy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    for (const common of COMMON_PASSWORDS) {
      if (lowerPassword === common.toLowerCase() || lowerPassword.includes(common.toLowerCase())) {
        errors.push('Esta senha é muito comum e fácil de adivinhar. Escolha uma senha mais forte.');
        break;
      }
    }
  }

  // Password history check (if user exists)
  if (userId && tenantId) {
    const isReused = await checkPasswordHistory(password, userId, tenantId, policy.historyCount);
    if (isReused) {
      errors.push(`Você não pode reutilizar as últimas ${policy.historyCount} senhas`);
    }
  }

  // Breached password check (HaveIBeenPwned)
  if (policy.checkBreachedPasswords) {
    const isBreached = await checkBreachedPassword(password);
    if (isBreached) {
      errors.push('Esta senha foi encontrada em vazamentos de dados conhecidos. Por favor, escolha outra senha.');
    }
  }

  // Calculate password strength
  const strength = calculatePasswordStrength(password);

  if (strength === 'weak' && errors.length === 0) {
    warnings.push('Sua senha é fraca. Considere adicionar mais caracteres ou complexidade.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    strength,
  };
}

/**
 * Check if password has been used recently
 */
async function checkPasswordHistory(
  password: string,
  userId: number,
  tenantId: number,
  historyCount: number
): Promise<boolean> {
  try {
    // Get recent password hashes
    const history = db.prepare(`
      SELECT password_hash FROM password_history
      WHERE user_id = ? AND tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, tenantId, historyCount) as { password_hash: string }[];

    // Import bcrypt for comparison
    const bcrypt = await import('bcryptjs');

    // Check if password matches any historical hash
    for (const record of history) {
      const matches = await bcrypt.compare(password, record.password_hash);
      if (matches) {
        return true; // Password has been used before
      }
    }

    return false; // Password is new
  } catch (error) {
    logger.error('Password history check failed', error);
    return false; // Fail open - don't block on error
  }
}

/**
 * Check if password appears in known breaches (HaveIBeenPwned API)
 * Uses k-Anonymity model - only sends first 5 chars of SHA-1 hash
 */
async function checkBreachedPassword(password: string): Promise<boolean> {
  try {
    // Create SHA-1 hash of password
    const hash = crypto
      .createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();

    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Query HaveIBeenPwned API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'ServiceDesk-PasswordChecker'
      },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      logger.warn('HaveIBeenPwned API request failed', { status: response.status });
      return false; // Fail open - don't block on API error
    }

    const data = await response.text();
    const hashes = data.split('\n');

    // Check if our suffix appears in results
    for (const line of hashes) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix === suffix) {
        return true; // Password found in breach database
      }
    }

    return false; // Password not found in breaches
  } catch (error) {
    logger.warn('Breached password check failed', error);
    return false; // Fail open - don't block on error
  }
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' | 'very_strong' {
  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  // Bonus for mixing character types within sections
  if (/[a-z].*[A-Z]|[A-Z].*[a-z]/.test(password)) score += 1;
  if (/[a-zA-Z].*[0-9]|[0-9].*[a-zA-Z]/.test(password)) score += 1;

  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters (aaa, 111)
  if (/12345|abcde|qwerty/i.test(password)) score -= 2; // Sequential patterns

  // Classify strength
  if (score <= 3) return 'weak';
  if (score <= 5) return 'medium';
  if (score <= 7) return 'strong';
  return 'very_strong';
}

/**
 * Store password in history
 */
export async function storePasswordHistory(
  userId: number,
  tenantId: number,
  passwordHash: string
): Promise<void> {
  try {
    db.prepare(`
      INSERT INTO password_history (user_id, tenant_id, password_hash)
      VALUES (?, ?, ?)
    `).run(userId, tenantId, passwordHash);

    // Clean up old history (keep only configured amount)
    const policy = DEFAULT_POLICY;
    db.prepare(`
      DELETE FROM password_history
      WHERE user_id = ? AND tenant_id = ?
      AND id NOT IN (
        SELECT id FROM password_history
        WHERE user_id = ? AND tenant_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
    `).run(userId, tenantId, userId, tenantId, policy.historyCount);
  } catch (error) {
    logger.error('Failed to store password history', error);
  }
}

/**
 * Check if user's password has expired
 */
export function isPasswordExpired(
  lastPasswordChange: string,
  policy: PasswordPolicyConfig = DEFAULT_POLICY
): boolean {
  if (policy.maxAge === 0) {
    return false; // Password never expires
  }

  const lastChange = new Date(lastPasswordChange);
  const now = new Date();
  const daysSinceChange = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceChange >= policy.maxAge;
}

/**
 * Get days until password expires
 */
export function getDaysUntilExpiration(
  lastPasswordChange: string,
  policy: PasswordPolicyConfig = DEFAULT_POLICY
): number | null {
  if (policy.maxAge === 0) {
    return null; // Password never expires
  }

  const lastChange = new Date(lastPasswordChange);
  const now = new Date();
  const daysSinceChange = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = policy.maxAge - daysSinceChange;

  return Math.max(0, daysRemaining);
}

/**
 * Generate secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + numbers + special;

  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
