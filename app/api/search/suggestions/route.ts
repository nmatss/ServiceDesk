import { NextRequest, NextResponse } from 'next/server'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';
import { executeQuery } from '@/lib/db/adapter';
import { apiError } from '@/lib/api/api-helpers';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { isAdmin } from '@/lib/auth/roles';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação via unified guard
    const { auth, context, response } = requireTenantUserContext(request);
    if (response) return response;

    const user = { id: auth.userId, role: auth.role, organizationId: auth.organizationId };

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
    const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_')

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
        WHERE organization_id = ?
        AND (
          title LIKE ? ESCAPE '\\' OR
          description LIKE ? ESCAPE '\\' OR
          CAST(id as TEXT) LIKE ? ESCAPE '\\'
        )
        AND (
          ? = 'admin' OR
          created_by = ? OR
          assigned_to = ?
        )
        ORDER BY
          CASE
            WHEN title LIKE ? ESCAPE '\\' THEN 1
            WHEN CAST(id as TEXT) LIKE ? ESCAPE '\\' THEN 2
            ELSE 3
          END,
          created_at DESC
        LIMIT ?
      `, [
        context.tenant.id,
        `%${escapedQuery}%`, `%${escapedQuery}%`, `%${escapedQuery}%`,
        user.role, user.id, user.id,
        `${escapedQuery}%`, `${escapedQuery}%`,
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
    if ((type === 'all' || type === 'users') && isAdmin(user.role)) {
      const userSuggestions = await executeQuery<any>(`
        SELECT
          'user' as type,
          id,
          name,
          email,
          role
        FROM users
        WHERE organization_id = ?
        AND (
          name LIKE ? ESCAPE '\\' OR
          email LIKE ? ESCAPE '\\'
        )
        ORDER BY
          CASE
            WHEN name LIKE ? ESCAPE '\\' THEN 1
            WHEN email LIKE ? ESCAPE '\\' THEN 2
            ELSE 3
          END,
          name ASC
        LIMIT ?
      `, [
        context.tenant.id,
        `%${escapedQuery}%`, `%${escapedQuery}%`,
        `${escapedQuery}%`, `${escapedQuery}%`,
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
        WHERE organization_id = ?
        AND name LIKE ? ESCAPE '\\'
        ORDER BY
          CASE WHEN name LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END,
          name ASC
        LIMIT ?
      `, [context.tenant.id, `%${escapedQuery}%`, `${escapedQuery}%`, Math.floor(limit / 4)])

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
          title LIKE ? ESCAPE '\\' OR
          content LIKE ? ESCAPE '\\' OR
          summary LIKE ? ESCAPE '\\'
        )
        AND organization_id = ?
        AND status = 'published'
        ORDER BY
          CASE WHEN title LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END,
          title ASC
        LIMIT ?
      `, [
        `%${escapedQuery}%`, `%${escapedQuery}%`, `%${escapedQuery}%`,
        context.tenant.id,
        `${escapedQuery}%`,
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
        AND details->>'search_query' LIKE ? ESCAPE '\\'
        ORDER BY created_at DESC
        LIMIT 3
      `, [cutoffDate, `%${escapedQuery}%`])

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
    return apiError('Erro interno do servidor', 500)
  }
}
