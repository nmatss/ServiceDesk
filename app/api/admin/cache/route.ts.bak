import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';
import {
  getCacheStats,
  cleanupExpiredCache,
  clearAllCache,
  removeCachePattern,
  invalidateStatsCache,
  invalidateTicketCache,
  invalidateUserCache,
  getCacheConfig,
  configureCacheSystem
} from '@/lib/cache';

// GET - Estatísticas do cache
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Apenas admins podem acessar informações de cache
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const stats = getCacheStats();
    const config = getCacheConfig();

    return NextResponse.json({
      success: true,
      stats,
      config,
      actions_available: [
        'cleanup_expired',
        'clear_all',
        'clear_pattern',
        'invalidate_stats',
        'invalidate_tickets',
        'invalidate_user'
      ]
    });

  } catch (error) {
    logger.error('Erro ao buscar estatísticas do cache', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Gerenciar cache
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Apenas admins podem gerenciar cache
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { action, params = {} } = body;

    let result: any = {};

    switch (action) {
      case 'cleanup_expired':
        const cleanupCount = cleanupExpiredCache();
        result = {
          message: `${cleanupCount} entradas expiradas removidas`,
          cleaned_count: cleanupCount
        };
        break;

      case 'clear_all':
        const clearCount = clearAllCache();
        result = {
          message: `Cache limpo completamente`,
          cleared_count: clearCount
        };
        break;

      case 'clear_pattern':
        if (!params.pattern) {
          return NextResponse.json({
            error: 'Parâmetro "pattern" é obrigatório para esta ação'
          }, { status: 400 });
        }
        const patternCount = removeCachePattern(params.pattern);
        result = {
          message: `${patternCount} entradas removidas para o padrão "${params.pattern}"`,
          removed_count: patternCount
        };
        break;

      case 'invalidate_stats':
        invalidateStatsCache();
        result = {
          message: 'Cache de estatísticas invalidado'
        };
        break;

      case 'invalidate_tickets':
        if (params.ticket_id) {
          invalidateTicketCache(params.ticket_id);
          result = {
            message: `Cache do ticket ${params.ticket_id} invalidado`
          };
        } else {
          removeCachePattern('tickets:%');
          result = {
            message: 'Cache de todos os tickets invalidado'
          };
        }
        break;

      case 'invalidate_user':
        if (!params.user_id) {
          return NextResponse.json({
            error: 'Parâmetro "user_id" é obrigatório para esta ação'
          }, { status: 400 });
        }
        invalidateUserCache(params.user_id);
        result = {
          message: `Cache do usuário ${params.user_id} invalidado`
        };
        break;

      case 'configure':
        if (!params.config) {
          return NextResponse.json({
            error: 'Parâmetro "config" é obrigatório para esta ação'
          }, { status: 400 });
        }
        configureCacheSystem(params.config);
        result = {
          message: 'Configuração do cache atualizada',
          new_config: getCacheConfig()
        };
        break;

      default:
        return NextResponse.json({
          error: 'Ação inválida',
          available_actions: [
            'cleanup_expired',
            'clear_all',
            'clear_pattern',
            'invalidate_stats',
            'invalidate_tickets',
            'invalidate_user',
            'configure'
          ]
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro ao gerenciar cache', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Configurar cache
export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Apenas admins podem configurar cache
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { defaultTTL, maxSize, enabled } = body;

    const config: any = {};

    if (typeof defaultTTL === 'number' && defaultTTL > 0) {
      config.defaultTTL = defaultTTL;
    }

    if (typeof maxSize === 'number' && maxSize > 0) {
      config.maxSize = maxSize;
    }

    if (typeof enabled === 'boolean') {
      config.enabled = enabled;
    }

    if (Object.keys(config).length === 0) {
      return NextResponse.json({
        error: 'Nenhuma configuração válida fornecida'
      }, { status: 400 });
    }

    configureCacheSystem(config);

    return NextResponse.json({
      success: true,
      message: 'Configuração do cache atualizada',
      config: getCacheConfig()
    });

  } catch (error) {
    logger.error('Erro ao configurar cache', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Limpar cache
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Apenas admins podem limpar cache
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pattern = searchParams.get('pattern');

    let result: any;

    if (pattern) {
      // Limpar por padrão
      const removedCount = removeCachePattern(pattern);
      result = {
        message: `${removedCount} entradas removidas para o padrão "${pattern}"`,
        removed_count: removedCount,
        pattern
      };
    } else {
      // Limpar todo o cache
      const clearedCount = clearAllCache();
      result = {
        message: 'Todo o cache foi limpo',
        cleared_count: clearedCount
      };
    }

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro ao limpar cache', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}