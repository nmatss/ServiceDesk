import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, checkAuthRateLimit } from "@/src/lib/rate-limit";
import { validateCSRFMiddleware } from "@/src/lib/csrf";
import { isValidIP } from "@/src/lib/security";

export async function securityMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  
  // Verificar IP válido
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (ip !== 'unknown' && !isValidIP(ip)) {
    return new NextResponse('Invalid IP', { status: 400 });
  }
  
  // Rate limiting para APIs
  if (pathname.startsWith('/api/')) {
    const isRateLimited = await checkRateLimit(ip, 10); // 10 requests por minuto
    if (!isRateLimited) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }
  }
  
  // Rate limiting específico para autenticação
  if (pathname.startsWith('/api/auth/')) {
    const isAuthRateLimited = await checkAuthRateLimit(ip, 5); // 5 tentativas por 5 minutos
    if (!isAuthRateLimited) {
      return new NextResponse('Too many authentication attempts', { status: 429 });
    }
  }
  
  // Validação CSRF para POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token') || 
                     request.nextUrl.searchParams.get('csrf_token');
    
    if (!validateCSRFMiddleware(csrfToken || undefined)) {
      return new NextResponse('Invalid CSRF token', { status: 403 });
    }
  }
  
  return response;
}
