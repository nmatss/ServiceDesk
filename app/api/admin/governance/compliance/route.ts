/**
 * Governance Compliance Controls API
 *
 * Manages compliance controls for COBIT, LGPD, ISO27001, and ITIL frameworks.
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface ComplianceControl {
  id: string
  framework: 'COBIT' | 'LGPD' | 'ISO27001' | 'ITIL'
  control_id: string
  name: string
  description: string
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable'
  last_assessment: string
  owner: string
  evidence_count: number
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] })
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const { searchParams } = new URL(request.url)
    const framework = searchParams.get('framework') || 'all'
try {
      // Try to fetch from compliance_controls table
      let query = `
        SELECT
          cc.id,
          cc.framework,
          cc.control_id,
          cc.name,
          cc.description,
          cc.status,
          cc.last_assessment,
          u.name as owner,
          (SELECT COUNT(*) FROM compliance_evidence ce WHERE ce.control_id = cc.id) as evidence_count
        FROM compliance_controls cc
        LEFT JOIN users u ON cc.owner_id = u.id
        WHERE cc.organization_id = ?
      `
      const params: (string | number)[] = [organizationId]

      if (framework !== 'all') {
        query += ' AND cc.framework = ?'
        params.push(framework)
      }

      query += ' ORDER BY cc.framework, cc.control_id'

      const controls = await executeQuery<ComplianceControl>(query, params)

      // Calculate statistics
      const stats = {
        total: controls.length,
        compliant: controls.filter(c => c.status === 'compliant').length,
        partial: controls.filter(c => c.status === 'partial').length,
        non_compliant: controls.filter(c => c.status === 'non_compliant').length,
        not_applicable: controls.filter(c => c.status === 'not_applicable').length
      }

      // Framework-specific stats
      const frameworkStats = ['COBIT', 'LGPD', 'ISO27001', 'ITIL'].map(fw => {
        const fwControls = controls.filter(c => c.framework === fw)
        const compliant = fwControls.filter(c => c.status === 'compliant').length
        return {
          framework: fw,
          total: fwControls.length,
          compliant,
          percentage: fwControls.length > 0 ? Math.round((compliant / fwControls.length) * 100) : 0
        }
      })

      return NextResponse.json({
        success: true,
        controls,
        stats,
        frameworkStats
      })
    } catch {
      // Table doesn't exist, return sample data
      const controls = getDefaultControls()
      const filteredControls = framework !== 'all'
        ? controls.filter(c => c.framework === framework)
        : controls

      const stats = {
        total: filteredControls.length,
        compliant: filteredControls.filter(c => c.status === 'compliant').length,
        partial: filteredControls.filter(c => c.status === 'partial').length,
        non_compliant: filteredControls.filter(c => c.status === 'non_compliant').length,
        not_applicable: filteredControls.filter(c => c.status === 'not_applicable').length
      }

      const frameworkStats = ['COBIT', 'LGPD', 'ISO27001', 'ITIL'].map(fw => {
        const fwControls = controls.filter(c => c.framework === fw)
        const compliant = fwControls.filter(c => c.status === 'compliant').length
        return {
          framework: fw,
          total: fwControls.length,
          compliant,
          percentage: fwControls.length > 0 ? Math.round((compliant / fwControls.length) * 100) : 0
        }
      })

      return NextResponse.json({
        success: true,
        controls: filteredControls,
        stats,
        frameworkStats,
        notice: 'Usando dados de exemplo. A tabela compliance_controls ainda não foi criada.'
      })
    }
  } catch (error) {
    logger.error('Error fetching compliance controls:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar controles de compliance' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] })
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const body = await request.json()
    const {
      framework,
      control_id,
      name,
      description,
      status,
      owner_id
    } = body
try {
      const result = await executeRun(`
        INSERT INTO compliance_controls (
          organization_id, framework, control_id, name, description,
          status, owner_id, last_assessment, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      `, [organizationId,
        framework,
        control_id,
        name,
        description,
        status,
        owner_id])

      return NextResponse.json({
        success: true,
        id: result.lastInsertRowid
      })
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Tabela compliance_controls não existe. Execute a migração primeiro.'
      }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error creating compliance control:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar controle de compliance' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] })
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const body = await request.json()
    const { id, status, notes } = body
try {
      await executeRun(`
        UPDATE compliance_controls
        SET status = ?, assessment_notes = ?, last_assessment = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND organization_id = ?
      `, [status, notes, id, organizationId])

      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Tabela compliance_controls não existe. Execute a migração primeiro.'
      }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error updating compliance control:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar controle de compliance' },
      { status: 500 }
    )
  }
}

function getDefaultControls(): ComplianceControl[] {
  return [
    // COBIT Controls
    {
      id: '1',
      framework: 'COBIT',
      control_id: 'DSS02',
      name: 'Gerenciar Requisições de Serviço e Incidentes',
      description: 'Fornecer resposta oportuna e eficaz às solicitações dos usuários e resolução de todos os tipos de incidentes',
      status: 'compliant',
      last_assessment: '2024-12-01',
      owner: 'Gerente de Service Desk',
      evidence_count: 12
    },
    {
      id: '2',
      framework: 'COBIT',
      control_id: 'DSS03',
      name: 'Gerenciar Problemas',
      description: 'Identificar e classificar problemas e suas causas raiz para fornecer resolução oportuna',
      status: 'partial',
      last_assessment: '2024-12-01',
      owner: 'Gerente de Problemas',
      evidence_count: 8
    },
    {
      id: '3',
      framework: 'COBIT',
      control_id: 'BAI06',
      name: 'Gerenciar Mudanças',
      description: 'Gerenciar todas as mudanças de forma controlada, incluindo mudanças padrão e manutenção de emergência',
      status: 'compliant',
      last_assessment: '2024-11-15',
      owner: 'Gerente de Mudanças',
      evidence_count: 15
    },
    {
      id: '4',
      framework: 'COBIT',
      control_id: 'BAI09',
      name: 'Gerenciar Ativos',
      description: 'Gerenciar os ativos de TI ao longo de seu ciclo de vida desde a aquisição até o descarte',
      status: 'compliant',
      last_assessment: '2024-11-20',
      owner: 'Gerente de Ativos',
      evidence_count: 10
    },
    // LGPD Controls
    {
      id: '5',
      framework: 'LGPD',
      control_id: 'ART-7',
      name: 'Base Legal para Tratamento',
      description: 'Garantir base legal para todas as operações de tratamento de dados pessoais',
      status: 'compliant',
      last_assessment: '2024-12-10',
      owner: 'DPO',
      evidence_count: 20
    },
    {
      id: '6',
      framework: 'LGPD',
      control_id: 'ART-18',
      name: 'Direitos do Titular',
      description: 'Garantir o exercício dos direitos dos titulares de dados pessoais',
      status: 'compliant',
      last_assessment: '2024-12-10',
      owner: 'DPO',
      evidence_count: 10
    },
    {
      id: '7',
      framework: 'LGPD',
      control_id: 'ART-46',
      name: 'Medidas de Segurança',
      description: 'Implementar medidas técnicas e administrativas de proteção de dados pessoais',
      status: 'partial',
      last_assessment: '2024-12-05',
      owner: 'CISO',
      evidence_count: 18
    },
    {
      id: '8',
      framework: 'LGPD',
      control_id: 'ART-37',
      name: 'Encarregado (DPO)',
      description: 'Designar encarregado pelo tratamento de dados pessoais',
      status: 'compliant',
      last_assessment: '2024-11-01',
      owner: 'DPO',
      evidence_count: 5
    },
    // ISO27001 Controls
    {
      id: '9',
      framework: 'ISO27001',
      control_id: 'A.9.2',
      name: 'Gestão de Acesso do Usuário',
      description: 'Assegurar acesso autorizado de usuários e prevenir acesso não autorizado a sistemas',
      status: 'compliant',
      last_assessment: '2024-11-20',
      owner: 'Gerente de Segurança',
      evidence_count: 25
    },
    {
      id: '10',
      framework: 'ISO27001',
      control_id: 'A.12.4',
      name: 'Logging e Monitoramento',
      description: 'Registrar eventos e gerar evidências através de logs de auditoria',
      status: 'compliant',
      last_assessment: '2024-11-25',
      owner: 'Gerente de Segurança',
      evidence_count: 15
    },
    {
      id: '11',
      framework: 'ISO27001',
      control_id: 'A.18.1',
      name: 'Conformidade Legal',
      description: 'Evitar violações de obrigações legais, estatutárias, regulatórias ou contratuais',
      status: 'partial',
      last_assessment: '2024-12-01',
      owner: 'Compliance Officer',
      evidence_count: 12
    },
    // ITIL Controls
    {
      id: '12',
      framework: 'ITIL',
      control_id: 'CSI',
      name: 'Melhoria Contínua de Serviço',
      description: 'Identificar e implementar melhorias nos serviços de TI e processos',
      status: 'partial',
      last_assessment: '2024-12-01',
      owner: 'Gerente de Qualidade',
      evidence_count: 6
    },
    {
      id: '13',
      framework: 'ITIL',
      control_id: 'SLM',
      name: 'Gestão de Nível de Serviço',
      description: 'Garantir que metas de nível de serviço acordadas sejam cumpridas',
      status: 'compliant',
      last_assessment: '2024-11-15',
      owner: 'Gerente de SLA',
      evidence_count: 20
    },
    {
      id: '14',
      framework: 'ITIL',
      control_id: 'CAT',
      name: 'Catálogo de Serviços',
      description: 'Manter catálogo de serviços atualizado e acessível',
      status: 'compliant',
      last_assessment: '2024-12-05',
      owner: 'Gerente de Catálogo',
      evidence_count: 8
    }
  ]
}
