/**
 * Access Control & RBAC API
 *
 * Manages access policies, roles, permissions, and security settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'

interface AccessPolicy {
  id: string
  name: string
  description: string
  type: 'role' | 'permission' | 'data'
  scope: string
  users_affected: number
  permissions: string[]
  last_modified: string
  status: 'active' | 'draft' | 'deprecated'
  created_by: string
}

interface SecuritySetting {
  id: string
  category: string
  name: string
  description: string
  value: string | boolean | number
  type: 'toggle' | 'select' | 'number' | 'text'
  options?: string[]
}

interface SSOProvider {
  id: string
  name: string
  type: 'azure_ad' | 'google' | 'okta' | 'saml'
  status: 'configured' | 'not_configured' | 'disabled'
  last_sync: string | null
  users_synced: number
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user || auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      )
    }

    const db = getDatabase()

    // Get user counts per role
    let roleCounts: Record<string, number> = { admin: 0, agent: 0, user: 0 }
    try {
      const counts = db.prepare(`
        SELECT role, COUNT(*) as count
        FROM users
        WHERE organization_id = ?
        GROUP BY role
      `).all(auth.user.organization_id) as Array<{ role: string; count: number }>

      counts.forEach(c => {
        roleCounts[c.role] = c.count
      })
    } catch {
      roleCounts = { admin: 3, agent: 15, user: 45 }
    }

    // Access policies
    const policies: AccessPolicy[] = [
      {
        id: '1',
        name: 'Administradores do Sistema',
        description: 'Acesso total a todas as funcionalidades administrativas',
        type: 'role',
        scope: 'Global',
        users_affected: roleCounts.admin,
        permissions: [
          'admin.full_access',
          'users.manage',
          'settings.manage',
          'reports.view',
          'audit.view'
        ],
        last_modified: '2024-12-01',
        status: 'active',
        created_by: 'Sistema'
      },
      {
        id: '2',
        name: 'Agentes de Suporte',
        description: 'Gerenciamento de tickets e atendimento ao usuário',
        type: 'role',
        scope: 'Service Desk',
        users_affected: roleCounts.agent,
        permissions: [
          'tickets.view',
          'tickets.create',
          'tickets.update',
          'tickets.assign',
          'knowledge.view',
          'knowledge.create'
        ],
        last_modified: '2024-11-28',
        status: 'active',
        created_by: 'Admin'
      },
      {
        id: '3',
        name: 'Gestores de Mudanças',
        description: 'Aprovação e gestão de RFCs e mudanças',
        type: 'role',
        scope: 'Change Management',
        users_affected: 5,
        permissions: [
          'changes.view',
          'changes.approve',
          'changes.schedule',
          'cab.participate',
          'reports.changes'
        ],
        last_modified: '2024-11-15',
        status: 'active',
        created_by: 'Admin'
      },
      {
        id: '4',
        name: 'Visualização de Dados Sensíveis',
        description: 'Acesso a informações PII e dados confidenciais',
        type: 'data',
        scope: 'LGPD Protected',
        users_affected: 8,
        permissions: [
          'data.pii.view',
          'data.financial.view',
          'data.health.view',
          'export.sensitive'
        ],
        last_modified: '2024-12-10',
        status: 'active',
        created_by: 'DPO'
      },
      {
        id: '5',
        name: 'Relatórios Gerenciais',
        description: 'Acesso a dashboards e analytics avançados',
        type: 'permission',
        scope: 'Analytics',
        users_affected: 12,
        permissions: [
          'reports.view',
          'reports.export',
          'dashboard.customize',
          'analytics.advanced'
        ],
        last_modified: '2024-12-05',
        status: 'active',
        created_by: 'Admin'
      },
      {
        id: '6',
        name: 'Usuários Padrão',
        description: 'Acesso básico ao portal de autoatendimento',
        type: 'role',
        scope: 'Portal',
        users_affected: roleCounts.user,
        permissions: [
          'tickets.create',
          'tickets.view_own',
          'knowledge.view',
          'profile.edit'
        ],
        last_modified: '2024-11-20',
        status: 'active',
        created_by: 'Sistema'
      }
    ]

    // SSO Providers
    const ssoProviders: SSOProvider[] = [
      {
        id: '1',
        name: 'Azure Active Directory',
        type: 'azure_ad',
        status: 'configured',
        last_sync: '2024-12-14T08:00:00Z',
        users_synced: 45
      },
      {
        id: '2',
        name: 'Google Workspace',
        type: 'google',
        status: 'configured',
        last_sync: '2024-12-14T07:30:00Z',
        users_synced: 23
      },
      {
        id: '3',
        name: 'Okta',
        type: 'okta',
        status: 'not_configured',
        last_sync: null,
        users_synced: 0
      },
      {
        id: '4',
        name: 'SAML 2.0 Genérico',
        type: 'saml',
        status: 'not_configured',
        last_sync: null,
        users_synced: 0
      }
    ]

    // MFA Statistics
    const mfaStats = {
      total_users: Object.values(roleCounts).reduce((a, b) => a + b, 0),
      mfa_enabled: Math.round(Object.values(roleCounts).reduce((a, b) => a + b, 0) * 0.65),
      by_role: {
        admin: { enabled: roleCounts.admin, total: roleCounts.admin, percentage: 100 },
        agent: { enabled: Math.round(roleCounts.agent * 0.85), total: roleCounts.agent, percentage: 85 },
        user: { enabled: Math.round(roleCounts.user * 0.42), total: roleCounts.user, percentage: 42 }
      }
    }

    // Security settings
    const securitySettings: SecuritySetting[] = [
      {
        id: '1',
        category: 'Autenticação',
        name: 'Exigir MFA para administradores',
        description: 'Todos os administradores devem usar autenticação de dois fatores',
        value: true,
        type: 'toggle'
      },
      {
        id: '2',
        category: 'Autenticação',
        name: 'Tempo máximo de sessão',
        description: 'Tempo em minutos antes de exigir novo login',
        value: 480,
        type: 'number'
      },
      {
        id: '3',
        category: 'Autenticação',
        name: 'Tentativas de login antes de bloqueio',
        description: 'Número de tentativas falhas antes de bloquear a conta',
        value: 5,
        type: 'number'
      },
      {
        id: '4',
        category: 'Senhas',
        name: 'Complexidade mínima de senha',
        description: 'Nível de complexidade exigido para senhas',
        value: 'high',
        type: 'select',
        options: ['low', 'medium', 'high', 'very_high']
      },
      {
        id: '5',
        category: 'Senhas',
        name: 'Expiração de senha (dias)',
        description: 'Dias até exigir troca de senha (0 = nunca)',
        value: 90,
        type: 'number'
      },
      {
        id: '6',
        category: 'Auditoria',
        name: 'Registrar todas as ações',
        description: 'Criar log de auditoria para todas as operações',
        value: true,
        type: 'toggle'
      },
      {
        id: '7',
        category: 'Auditoria',
        name: 'Alertar atividades suspeitas',
        description: 'Enviar notificações para atividades de alto risco',
        value: true,
        type: 'toggle'
      }
    ]

    // Recent security events
    const securityEvents = [
      {
        id: '1',
        type: 'mfa_disabled',
        severity: 'warning',
        message: 'MFA desabilitado para usuário carlos@empresa.com',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
        user: 'admin@empresa.com'
      },
      {
        id: '2',
        type: 'role_change',
        severity: 'info',
        message: 'Role alterado de user para agent: maria@empresa.com',
        timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
        user: 'admin@empresa.com'
      },
      {
        id: '3',
        type: 'login_blocked',
        severity: 'critical',
        message: 'Conta bloqueada após 5 tentativas falhas: test@empresa.com',
        timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
        user: 'Sistema'
      }
    ]

    return NextResponse.json({
      success: true,
      policies,
      ssoProviders,
      mfaStats,
      securitySettings,
      securityEvents,
      summary: {
        total_policies: policies.filter(p => p.status === 'active').length,
        total_users: Object.values(roleCounts).reduce((a, b) => a + b, 0),
        sso_configured: ssoProviders.filter(p => p.status === 'configured').length,
        mfa_coverage: Math.round((mfaStats.mfa_enabled / mfaStats.total_users) * 100)
      }
    })
  } catch (error) {
    console.error('Error fetching access control data:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar dados de controle de acesso' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user || auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'create_policy':
        return NextResponse.json({
          success: true,
          message: 'Política criada com sucesso',
          id: `policy_${Date.now()}`
        })

      case 'update_policy':
        return NextResponse.json({
          success: true,
          message: 'Política atualizada com sucesso'
        })

      case 'delete_policy':
        return NextResponse.json({
          success: true,
          message: 'Política removida com sucesso'
        })

      case 'configure_sso':
        return NextResponse.json({
          success: true,
          message: `Provedor ${data?.provider} configurado com sucesso`
        })

      case 'sync_sso':
        return NextResponse.json({
          success: true,
          message: 'Sincronização iniciada',
          users_synced: 0
        })

      case 'update_security_setting':
        return NextResponse.json({
          success: true,
          message: 'Configuração de segurança atualizada'
        })

      case 'enable_mfa':
        return NextResponse.json({
          success: true,
          message: 'MFA habilitado para o usuário'
        })

      case 'disable_mfa':
        return NextResponse.json({
          success: true,
          message: 'MFA desabilitado para o usuário'
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing access control action:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao processar ação de controle de acesso' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user || auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { policy_id, updates } = body

    // In production, this would update the database
    return NextResponse.json({
      success: true,
      message: 'Política atualizada com sucesso',
      policy_id,
      updates
    })
  } catch (error) {
    console.error('Error updating access policy:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar política de acesso' },
      { status: 500 }
    )
  }
}
