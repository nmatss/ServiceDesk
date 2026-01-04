/**
 * CI Types API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const db = getDatabase()

    const types = db.prepare(`
      SELECT * FROM ci_types
      WHERE organization_id = ? OR organization_id IS NULL
      ORDER BY display_order ASC, name ASC
    `).all(auth.user.organization_id)

    return NextResponse.json({ success: true, types })
  } catch {
    // Return default types if table doesn't exist
    return NextResponse.json({
      success: true,
      types: [
        { id: 1, name: 'Servidor', icon: 'server', color: '#3B82F6' },
        { id: 2, name: 'Desktop', icon: 'desktop', color: '#10B981' },
        { id: 3, name: 'Notebook', icon: 'laptop', color: '#8B5CF6' },
        { id: 4, name: 'Rede', icon: 'network', color: '#F59E0B' },
        { id: 5, name: 'Aplicação', icon: 'application', color: '#EF4444' },
        { id: 6, name: 'Banco de Dados', icon: 'database', color: '#06B6D4' },
        { id: 7, name: 'Storage', icon: 'storage', color: '#6366F1' },
        { id: 8, name: 'Cloud', icon: 'cloud', color: '#EC4899' },
        { id: 9, name: 'Mobile', icon: 'mobile', color: '#14B8A6' },
        { id: 10, name: 'Impressora', icon: 'printer', color: '#64748B' }
      ]
    })
  }
}
