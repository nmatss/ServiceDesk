import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token não fornecido',
          code: 'NO_TOKEN'
        },
        { status: 401 }
      )
    }

    // Verificar token
    const user = await verifyToken(token)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      )
    }

    // Log da verificação (simplificado)
    console.log('Token verified for user:', user.email)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })

  } catch (error) {
    console.error('Error verifying token:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token não fornecido',
          code: 'NO_TOKEN'
        },
        { status: 400 }
      )
    }

    const user = await verifyToken(token)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })

  } catch (error) {
    console.error('Error verifying token:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}