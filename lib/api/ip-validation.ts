/**
 * IP Validation & Trusted Proxy Configuration
 * Prevents IP spoofing attacks and validates client IPs
 */

import { NextRequest } from 'next/server';

/**
 * Valida se um IP está em formato válido (IPv4 ou IPv6)
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;

  // IPv4
  if (isValidIPv4(ip)) return true;

  // IPv6
  if (isValidIPv6(ip)) return true;

  return false;
}

/**
 * Valida IPv4
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  const parts = ip.split('.').map(Number);
  return parts.every(part => part >= 0 && part <= 255);
}

/**
 * Valida IPv6
 */
export function isValidIPv6(ip: string): boolean {
  // IPv6 completo: 8 grupos de 4 dígitos hexadecimais
  const ipv6Full = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  // All zeros
  if (ip === '::') return true;

  // Verifica se tem mais de um :: (inválido)
  const doubleColonCount = (ip.match(/::/g) || []).length;
  if (doubleColonCount > 1) return false;

  // Verifica se tem ::: (inválido)
  if (ip.includes(':::')) return false;

  // IPv6-mapped IPv4
  const ipv6MappedIPv4 = /^::ffff:(\d{1,3}\.){3}\d{1,3}$/i;
  if (ipv6MappedIPv4.test(ip)) return true;

  // IPv6 comprimido
  // Permite :: em qualquer posição
  if (ip.includes('::')) {
    const parts = ip.split('::');
    if (parts.length !== 2) return false;

    const validatePart = (part: string): boolean => {
      if (!part) return true; // Empty part is valid
      const groups = part.split(':');
      return groups.every(g => /^[0-9a-fA-F]{1,4}$/.test(g));
    };

    return validatePart(parts[0]) && validatePart(parts[1]);
  }

  // IPv6 completo
  return ipv6Full.test(ip);
}

/**
 * Verifica se IP é privado/local (não roteável na internet)
 */
export function isPrivateIP(ip: string): boolean {
  if (isValidIPv4(ip)) {
    const parts = ip.split('.').map(Number);

    // 10.0.0.0/8
    if (parts[0] === 10) return true;

    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 127.0.0.0/8 (localhost)
    if (parts[0] === 127) return true;

    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  if (isValidIPv6(ip)) {
    const normalized = ip.toLowerCase();

    // ::1 (localhost)
    if (normalized === '::1') return true;

    // fc00::/7 (unique local address)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // fe80::/10 (link-local)
    if (normalized.startsWith('fe80:')) return true;
  }

  return false;
}

/**
 * Normaliza IP removendo prefixo IPv6-mapped IPv4
 */
export function normalizeIP(ip: string): string {
  // ::ffff:192.0.2.1 → 192.0.2.1
  const ipv6MappedPattern = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
  const match = ip.match(ipv6MappedPattern);
  if (match) {
    return match[1];
  }

  return ip;
}

/**
 * Extrai o IP real do cliente considerando proxies confiáveis
 * PROTEÇÃO CONTRA IP SPOOFING
 */
export function getTrustedClientIP(request: NextRequest): string {
  // Configuração de proxies confiáveis
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const cloudflareMode = process.env.CLOUDFLARE_MODE === 'true';
  const trustedProxies = getTrustedProxiesList();

  // Se não confiamos em proxies, usar apenas x-real-ip ou IP direto
  if (!trustProxy && !cloudflareMode) {
    const realIp = request.headers.get('x-real-ip');
    if (realIp && isValidIP(realIp)) {
      return normalizeIP(realIp);
    }

    return request.ip || 'unknown';
  }

  // Cloudflare Mode: usar CF-Connecting-IP
  if (cloudflareMode) {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp && isValidIP(cfIp)) {
      return normalizeIP(cfIp);
    }
  }

  // Processar X-Forwarded-For com validação de proxies
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => isValidIP(ip));

    // Percorrer da DIREITA para ESQUERDA (mais próximo do servidor)
    for (let i = ips.length - 1; i >= 0; i--) {
      const ip = normalizeIP(ips[i]);

      // Pular proxies confiáveis
      if (isTrustedProxy(ip, trustedProxies)) continue;

      // Primeiro IP não-confiável é o cliente real
      if (isValidIP(ip) && !isPrivateIP(ip)) {
        return ip;
      }
    }

    // Se todos são confiáveis ou inválidos, usar primeiro
    if (ips.length > 0) {
      return normalizeIP(ips[0]);
    }
  }

  // Fallback: x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp && isValidIP(realIp)) {
    return normalizeIP(realIp);
  }

  // Fallback final: IP direto da conexão
  return request.ip || 'unknown';
}

/**
 * Obtém lista de proxies confiáveis da configuração
 */
function getTrustedProxiesList(): string[] {
  const proxiesEnv = process.env.TRUSTED_PROXIES || '';

  const proxies = proxiesEnv
    .split(',')
    .map(ip => ip.trim())
    .filter(ip => ip && isValidIP(ip));

  // Adicionar proxies Cloudflare se modo ativado
  if (process.env.CLOUDFLARE_MODE === 'true') {
    const cloudflareRanges = getCloudflareIPRanges();
    return [...proxies, ...cloudflareRanges];
  }

  return proxies;
}

/**
 * Verifica se IP é um proxy confiável
 */
function isTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  // Comparação exata
  if (trustedProxies.includes(ip)) return true;

  // Verificar CIDRs
  for (const proxy of trustedProxies) {
    if (proxy.includes('/')) {
      if (isIPInCIDR(ip, proxy)) return true;
    }
  }

  return false;
}

/**
 * IP ranges do Cloudflare (atualizar periodicamente)
 * Fonte: https://www.cloudflare.com/ips/
 */
function getCloudflareIPRanges(): string[] {
  return [
    // IPv4
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
    // IPv6
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32'
  ];
}

/**
 * Verifica se IP está em um range CIDR
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);

  // Somente IPv4 por enquanto
  if (!isValidIPv4(ip) || !isValidIPv4(network)) {
    return false;
  }

  const ipBits = ipv4ToBits(ip);
  const networkBits = ipv4ToBits(network);

  // Comparar apenas os primeiros 'prefix' bits
  for (let i = 0; i < prefix; i++) {
    if (ipBits[i] !== networkBits[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Converte IPv4 para array de bits
 */
function ipv4ToBits(ip: string): number[] {
  const parts = ip.split('.').map(Number);
  const bits: number[] = [];

  for (const part of parts) {
    for (let i = 7; i >= 0; i--) {
      bits.push((part >> i) & 1);
    }
  }

  return bits;
}

/**
 * Valida headers de IP para detectar spoofing
 */
export function validateIPHeaders(request: NextRequest): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const cloudflareMode = process.env.CLOUDFLARE_MODE === 'true';

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');

  // Se não confiamos em proxies mas recebemos headers de proxy
  if (!trustProxy && !cloudflareMode && forwarded) {
    warnings.push('X-Forwarded-For header received but TRUST_PROXY=false');
  }

  // Se Cloudflare mode mas sem CF header
  if (cloudflareMode && !cfIp) {
    warnings.push('CLOUDFLARE_MODE=true but CF-Connecting-IP header missing');
  }

  // Validar formato dos IPs nos headers
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    const invalidIps = ips.filter(ip => !isValidIP(ip));
    if (invalidIps.length > 0) {
      warnings.push(`Invalid IPs in X-Forwarded-For: ${invalidIps.join(', ')}`);
    }
  }

  if (realIp && !isValidIP(realIp)) {
    warnings.push(`Invalid IP in X-Real-IP: ${realIp}`);
  }

  if (cfIp && !isValidIP(cfIp)) {
    warnings.push(`Invalid IP in CF-Connecting-IP: ${cfIp}`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Log de tentativa de spoofing
 */
export function logSpoofingAttempt(request: NextRequest, reason: string): void {
  console.warn('[SECURITY] Potential IP spoofing detected', {
    reason,
    url: request.url,
    headers: {
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'x-real-ip': request.headers.get('x-real-ip'),
      'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
    },
    ip: request.ip,
    timestamp: new Date().toISOString(),
  });
}
