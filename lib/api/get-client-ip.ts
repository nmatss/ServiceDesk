import { NextRequest } from 'next/server';

/**
 * Extrai o IP real do cliente considerando proxies confiáveis
 * Previne IP spoofing via X-Forwarded-For
 */
export function getTrustedClientIP(request: NextRequest): string {
  // Lista de proxies confiáveis (IPs de load balancers, Cloudflare, etc.)
  const trustedProxies = (process.env.TRUSTED_PROXIES || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);

  const trustProxy = process.env.TRUST_PROXY === 'true';

  // Se não confiamos em proxies, usar IP direto
  if (!trustProxy) {
    return request.headers.get('x-real-ip') ||
           request.ip ||
           'unknown';
  }

  // Processar X-Forwarded-For
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());

    // Percorrer IPs da direita para esquerda, pulando proxies confiáveis
    for (let i = ips.length - 1; i >= 0; i--) {
      const ip = ips[i];

      // Se não é um proxy confiável, é o IP real do cliente
      if (!trustedProxies.includes(ip) && isValidIP(ip)) {
        return ip;
      }
    }
  }

  return request.headers.get('x-real-ip') ||
         request.ip ||
         'unknown';
}

/**
 * Valida formato de IP (IPv4 ou IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(part => part >= 0 && part <= 255);
  }

  // IPv6 (simplificado)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}
