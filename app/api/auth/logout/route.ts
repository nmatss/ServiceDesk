import { NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';

export async function POST() {
  try {
    // Criar resposta de sucesso
    const response = NextResponse.json({
      message: 'Logout realizado com sucesso'
    });

    // Limpar o cookie de autenticação
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expira imediatamente
    });

    return response;
  } catch (error) {
    logger.error('Erro na API de logout', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}