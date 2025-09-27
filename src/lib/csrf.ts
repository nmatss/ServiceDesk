// Usar Web Crypto API para compatibilidade com Edge Runtime
function getRandomBytes(length: number): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  // Fallback para Node.js
  const crypto = require('crypto');
  return crypto.randomBytes(length);
}

const tokens = new Map<string, number>();

export function generateCSRFToken(): string {
  const bytes = getRandomBytes(32);
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  tokens.set(token, Date.now() + 3600000); // 1 hora
  return token;
}

export function validateCSRFToken(token: string): boolean {
  const expiry = tokens.get(token);
  if (!expiry || Date.now() > expiry) {
    tokens.delete(token);
    return false;
  }
  
  tokens.delete(token); // Token único
  return true;
}

// Função para limpar tokens expirados
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  const expiredTokens: string[] = [];
  
  tokens.forEach((expiry, token) => {
    if (now > expiry) {
      expiredTokens.push(token);
    }
  });
  
  expiredTokens.forEach(token => {
    tokens.delete(token);
  });
}

// Limpar tokens expirados a cada 5 minutos
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

// Função para middleware de validação CSRF
export function validateCSRFMiddleware(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  return validateCSRFToken(token);
}
