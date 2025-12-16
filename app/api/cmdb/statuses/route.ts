/**
 * CI Statuses API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const db = getDatabase()

    const statuses = db.prepare(`
      SELECT * FROM ci_statuses
      WHERE organization_id = ? OR organization_id IS NULL
      ORDER BY display_order ASC, name ASC
    `).all(auth.user.organization_id)

    return NextResponse.json({ success: true, statuses })
  } catch {
    // Return default statuses if table doesn't exist
    return NextResponse.json({
      success: true,
      statuses: [
        { id: 1, name: 'Ativo', color: '#10B981', is_operational: true },
        { id: 2, name: 'Inativo', color: '#6B7280', is_operational: false },
        { id: 3, name: 'Em Manutenção', color: '#F59E0B', is_operational: false },
        { id: 4, name: 'Com Falha', color: '#EF4444', is_operational: false },
        { id: 5, name: 'Aposentado', color: '#374151', is_operational: false },
        { id: 6, name: 'Em Estoque', color: '#3B82F6', is_operational: false },
        { id: 7, name: 'Encomendado', color: '#8B5CF6', is_operational: false }
      ]
    })
  }
}
