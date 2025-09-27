import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { searchTickets, searchKnowledgeBase, globalSearch, saveSearch, getSearchHistory, getSearchSuggestions } from '@/lib/search';
import { getCachedTicketSearch, cacheTicketSearch } from '@/lib/cache';
import db from '@/lib/db/connection';

// GET - Busca avançada
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const query = searchParams.get('q') || '';

    // Histórico de buscas
    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const history = getSearchHistory(user.id, limit);
      return NextResponse.json({ success: true, history });
    }

    // Sugestões de busca
    if (action === 'suggestions') {
      const limit = parseInt(searchParams.get('limit') || '5');
      const suggestions = getSearchSuggestions(user.id, query, limit);
      return NextResponse.json({ success: true, suggestions });
    }

    // Busca global
    if (action === 'global') {
      const includeTickets = searchParams.get('include_tickets') !== 'false';
      const includeKnowledge = searchParams.get('include_knowledge') !== 'false';
      const includeUsers = searchParams.get('include_users') !== 'false';
      const limit = parseInt(searchParams.get('limit') || '10');

      const results = globalSearch(query, {
        includeTickets,
        includeKnowledge,
        includeUsers,
        limit
      });

      // Salvar busca no histórico
      if (query.trim()) {
        saveSearch(user.id, query, {}, results.total);
      }

      return NextResponse.json({
        success: true,
        query,
        results
      });
    }

    // Busca na Knowledge Base
    if (action === 'knowledge') {
      const categoryId = searchParams.get('category_id');
      const publishedOnly = searchParams.get('published_only') !== 'false';
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      const results = searchKnowledgeBase(query, {
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        publishedOnly,
        limit,
        offset
      });

      if (query.trim()) {
        saveSearch(user.id, query, { query }, results.total);
      }

      return NextResponse.json({
        success: true,
        query,
        ...results
      });
    }

    // Busca de tickets (padrão) - com filtros avançados
    const filters = {
      query,
      categories: searchParams.get('categories')?.split(',').map(Number).filter(Boolean) || [],
      priorities: searchParams.get('priorities')?.split(',').map(Number).filter(Boolean) || [],
      statuses: searchParams.get('statuses')?.split(',').map(Number).filter(Boolean) || [],
      assignedTo: searchParams.get('assigned_to')?.split(',').map(Number).filter(Boolean) || [],
      users: searchParams.get('users')?.split(',').map(Number).filter(Boolean) || [],
      dateFrom: searchParams.get('date_from') || undefined,
      dateTo: searchParams.get('date_to') || undefined,
      slaStatus: searchParams.get('sla_status') as 'compliant' | 'warning' | 'breach' | undefined,
      hasAttachments: searchParams.get('has_attachments') === 'true' ? true :
                     searchParams.get('has_attachments') === 'false' ? false : undefined,
      sortBy: searchParams.get('sort_by') as 'created_at' | 'updated_at' | 'priority' | 'status' | 'title' || 'created_at',
      sortOrder: searchParams.get('sort_order') as 'ASC' | 'DESC' || 'DESC',
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Aplicar filtro de permissão para usuários comuns
    if (user.role === 'user') {
      filters.users = [user.id];
    }

    // Tentar buscar no cache primeiro (apenas para buscas com query)
    let results;
    const cacheKey = query ? { search_query: query, ...filters, user_role: user.role, user_id: user.role === 'user' ? user.id : null } : null;

    if (cacheKey) {
      results = getCachedTicketSearch(cacheKey);
    }

    if (!results) {
      results = searchTickets(filters);

      // Cachear resultado se há query (60 segundos)
      if (cacheKey) {
        cacheTicketSearch(cacheKey, results, 60);
      }
    }

    // Salvar busca no histórico se houver query
    if (query.trim()) {
      saveSearch(user.id, query, filters, (results as any).total);
    }

    return NextResponse.json({
      success: true,
      query,
      filters,
      ...results
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Busca avançada com filtros complexos
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const {
      type = 'tickets',
      query = '',
      filters = {},
      saveToHistory = true
    } = body;

    let results;

    switch (type) {
      case 'tickets':
        // Aplicar filtro de permissão para usuários comuns
        if (user.role === 'user') {
          filters.users = [user.id];
        }
        results = searchTickets({ query, ...filters });
        break;

      case 'knowledge':
        results = searchKnowledgeBase(query, filters);
        break;

      case 'global':
        results = globalSearch(query, filters);
        break;

      default:
        return NextResponse.json({ error: 'Tipo de busca inválido' }, { status: 400 });
    }

    // Salvar no histórico se solicitado
    if (saveToHistory && query.trim()) {
      const resultCount = type === 'global' ? results.total : results.total;
      saveSearch(user.id, query, { query, ...filters }, resultCount);
    }

    return NextResponse.json({
      success: true,
      type,
      query,
      results
    });
  } catch (error) {
    console.error('Error in advanced search API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
