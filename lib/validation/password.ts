/**
 * Password Validation Utilities
 * Centralized password validation logic for consistent security across the application
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Strong password validation requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum length check
  if (password.length < 12) {
    errors.push('A senha deve ter pelo menos 12 caracteres');
  }

  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula');
  }

  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minúscula');
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número');
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('A senha deve conter pelo menos um caractere especial');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if password meets minimum security requirements
 * Throws an error with a descriptive message if validation fails
 */
export function requireStrongPassword(password: string): void {
  const result = validatePasswordStrength(password);

  if (!result.isValid) {
    throw new Error(result.errors.join('. '));
  }
}

/**
 * Common weak passwords to block (case-insensitive)
 */
const COMMON_WEAK_PASSWORDS = [
  'password',
  'password123',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  '1234567890',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'passw0rd',
  'shadow',
  '123123',
  '654321',
  'superman',
  'qazwsx',
  'michael',
  'football'
];

/**
 * Check if password is in the common weak passwords list
 */
export function isCommonWeakPassword(password: string): boolean {
  const lowerPassword = password.toLowerCase();
  return COMMON_WEAK_PASSWORDS.some(weak => lowerPassword === weak);
}

/**
 * Comprehensive password validation including common weak password check
 */
export function validatePassword(password: string): PasswordValidationResult {
  const result = validatePasswordStrength(password);

  // Check for common weak passwords
  if (isCommonWeakPassword(password)) {
    result.isValid = false;
    result.errors.push('Esta senha é muito comum e facilmente adivinhável. Por favor, escolha uma senha mais forte');
  }

  return result;
}

/**
 * Generate a password strength score (0-4)
 * 0 = Very Weak
 * 1 = Weak
 * 2 = Fair
 * 3 = Good
 * 4 = Strong
 */
export function getPasswordStrength(password: string): number {
  let score = 0;

  // Length score
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Complexity score
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  // Penalize common weak passwords
  if (isCommonWeakPassword(password)) {
    score = Math.max(0, score - 2);
  }

  // Cap at 4
  return Math.min(4, score);
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Muito Fraca';
    case 1:
      return 'Fraca';
    case 2:
      return 'Razoável';
    case 3:
      return 'Boa';
    case 4:
      return 'Forte';
    default:
      return 'Desconhecida';
  }
}
