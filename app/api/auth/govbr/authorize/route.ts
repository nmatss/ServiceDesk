import { NextRequest, NextResponse } from 'next/server';
import { GovBrAuthClient } from '@/lib/integrations/govbr/auth';
import { createAuditLog } from '@/lib/audit/logger';
import { cookies } from 'next/headers';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET - Iniciar autenticação Gov.br
 * Redireciona para o portal Gov.br para autenticação
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    if (!process.env.GOVBR_CLIENT_ID || !process.env.GOVBR_CLIENT_SECRET) {
      if (process.env.NODE_ENV !== 'production') {
        const fallbackUrl = new URL('/auth/login', request.url);
        fallbackUrl.searchParams.set('govbr', 'unavailable');
        fallbackUrl.searchParams.set('reason', 'not_configured');
        return NextResponse.redirect(fallbackUrl);
      }

      return NextResponse.json(
        { error: 'Gov.br authentication is not configured' },
        { status: 503 }
      );
    }

    // Cria cliente Gov.br
    const govbrClient = await GovBrAuthClient.createFromSystemSettings();

    // Gera URL de autorização
    const { url, state, codeVerifier } = govbrClient.generateAuthorizationUrl();

    // Salva state e code verifier em cookies seguros
    const cookieStore = await cookies();
    cookieStore.set('govbr_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutos
    });

    cookieStore.set('govbr_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutos
    });

    cookieStore.set('govbr_return_url', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutos
    });

    // Log da tentativa de autenticação
    await createAuditLog({
      action: 'govbr_auth_initiated',
      resource_type: 'authentication',
      new_values: JSON.stringify({
        state,
        returnUrl
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    // Redireciona para Gov.br
    return NextResponse.redirect(url);
  } catch (error) {
    logger.error('Error initiating Gov.br authentication', error);

    await createAuditLog({
      action: 'govbr_auth_error',
      resource_type: 'authentication',
      new_values: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown'
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMessage.toLowerCase().includes('configuration incomplete') ? 503 : 500;

    return NextResponse.json(
      {
        error: status === 503
          ? 'Gov.br authentication is not configured'
          : 'Failed to initiate Gov.br authentication'
      },
      { status }
    );
  }
}
