import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/auth-service'
import { logger } from '@/lib/monitoring/logger';
import { executeQuery } from '@/lib/db/adapter';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'Digite pelo menos 2 caracteres para buscar'
      })
    }
    const suggestions: any[] = []

    // Buscar tickets se type for 'all' ou 'tickets'
    if (type === 'all' || type === 'tickets') {
      const ticketSuggestions = await executeQuery<any>(`
        SELECT
          'ticket' as type,
          id,
          title,
          status,
          priority,
          created_at
        FROM tickets
        WHERE (
          title LIKE ? OR
          description LIKE ? OR
          CAST(id as TEXT) LIKE ?
        )
        AND (
          ? = 'admin' OR
          created_by = ? OR
          assigned_to = ?
        )
        ORDER BY
          CASE
            WHEN title LIKE ? THEN 1
            WHEN CAST(id as TEXT) LIKE ? THEN 2
            ELSE 3
          END,
          created_at DESC
        LIMIT ?
      `, [
        `%${query}%`, `%${query}%`, `%${query}%`,
        user.role, user.id, user.id,
        `${query}%`, `${query}%`,
        Math.floor(limit / 2)
      ])

      suggestions.push(...ticketSuggestions.map((ticket: any) => ({
        type: 'ticket',
        id: ticket.id,
        title: ticket.title,
        subtitle: `Ticket #${ticket.id} • ${ticket.status} • ${ticket.priority}`,
        url: `/tickets/${ticket.id}`,
        icon: 'TicketIcon',
        priority: ticket.priority
      })))
    }

    // Buscar usuários se type for 'all' ou 'users' e user for admin
    if ((type === 'all' || type === 'users') && user.role === 'admin') {
      const userSuggestions = await executeQuery<any>(`
        SELECT
          'user' as type,
          id,
          name,
          email,
          role
        FROM users
        WHERE (
          name LIKE ? OR
          email LIKE ?
        )
        ORDER BY
          CASE
            WHEN name LIKE ? THEN 1
            WHEN email LIKE ? THEN 2
            ELSE 3
          END,
          name ASC
        LIMIT ?
      `, [
        `%${query}%`, `%${query}%`,
        `${query}%`, `${query}%`,
        Math.floor(limit / 4)
      ])

      suggestions.push(...userSuggestions.map((user: any) => ({
        type: 'user',
        id: user.id,
        title: user.name,
        subtitle: `${user.email} • ${user.role}`,
        url: `/admin/users/${user.id}/edit`,
        icon: 'UserIcon',
        role: user.role
      })))
    }

    // Buscar categorias se type for 'all' ou 'categories'
    if (type === 'all' || type === 'categories') {
      const categorySuggestions = await executeQuery<any>(`
        SELECT
          'category' as type,
          id,
          name,
          description
        FROM categories
        WHERE name LIKE ?
        ORDER BY
          CASE WHEN name LIKE ? THEN 1 ELSE 2 END,
          name ASC
        LIMIT ?
      `, [`%${query}%`, `${query}%`, Math.floor(limit / 4)])

      suggestions.push(...categorySuggestions.map((category: any) => ({
        type: 'category',
        id: category.id,
        title: category.name,
        subtitle: category.description || 'Categoria',
        url: `/tickets?category=${category.id}`,
        icon: 'FolderIcon'
      })))
    }

    // Buscar artigos da base de conhecimento se type for 'all' ou 'knowledge'
    if (type === 'all' || type === 'knowledge') {
      const knowledgeSuggestions = await executeQuery<any>(`
        SELECT
          'knowledge' as type,
          id,
          title,
          summary,
          status
        FROM knowledge_articles
        WHERE (
          title LIKE ? OR
          content LIKE ? OR
          summary LIKE ?
        )
        AND status = 'published'
        ORDER BY
          CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
          title ASC
        LIMIT ?
      `, [
        `%${query}%`, `%${query}%`, `%${query}%`,
        `${query}%`,
        Math.floor(limit / 4)
      ])

      suggestions.push(...knowledgeSuggestions.map((article: any) => ({
        type: 'knowledge',
        id: article.id,
        title: article.title,
        subtitle: article.summary || 'Artigo da base de conhecimento',
        url: `/knowledge/${article.id}`,
        icon: 'BookOpenIcon'
      })))
    }

    // Ordenar sugestões por relevância
    const sortedSuggestions = suggestions
      .sort((a, b) => {
        // Priorizar matches exatos no título
        const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0

        if (aExact !== bExact) return bExact - aExact

        // Depois por tipo (tickets primeiro)
        const typeOrder: Record<string, number> = { ticket: 1, user: 2, category: 3, knowledge: 4 }
        return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5)
      })
      .slice(0, limit)

    // Buscar termos relacionados/histórico se não houver muitos resultados
    const relatedTerms: string[] = []
    if (suggestions.length < 5) {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentSearches = await executeQuery<{ term?: string }>(`
        SELECT DISTINCT details->>'search_query' as term
        FROM audit_logs
        WHERE action = 'SEARCH_PERFORMED'
        AND created_at > ?
        AND details->>'search_query' LIKE ?
        ORDER BY created_at DESC
        LIMIT 3
      `, [cutoffDate, `%${query}%`])

      relatedTerms.push(...recentSearches
        .map((row) => row.term)
        .filter((term): term is string => Boolean(term) && term !== query)
      )
    }

    return NextResponse.json({
      success: true,
      suggestions: sortedSuggestions,
      relatedTerms,
      query,
      total: suggestions.length
    })

  } catch (error) {
    logger.error('Error fetching search suggestions', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
