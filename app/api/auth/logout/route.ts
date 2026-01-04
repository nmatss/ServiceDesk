import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Tentar invalidar refresh token no banco se existir
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (refreshToken) {
      try {
        db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
      } catch {
        // Tabela pode não existir, ignorar
      }
    }

    // Criar resposta de sucesso
    const response = NextResponse.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

    // Limpar TODOS os cookies de autenticação
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expira imediatamente
    });

    // Limpar refresh token cookie se existir
    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    // Limpar tenant context cookie
    response.cookies.set('tenant-context', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    // Limpar cookie de sessão se existir
    response.cookies.set('session_id', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    logger.info('User logged out successfully');

    return response;
  } catch (error) {
    logger.error('Erro na API de logout', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}