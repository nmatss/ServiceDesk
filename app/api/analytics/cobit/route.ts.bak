/**
 * COBIT 2019 Metrics API
 *
 * Provides metrics aligned with COBIT 2019 governance framework.
 * Supports key performance indicators for IT governance and management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'

interface COBITMetrics {
  // EDM - Evaluate, Direct, Monitor (Governance)
  governance: {
    stakeholder_satisfaction: number
    value_realization: number
    risk_optimization: number
    resource_optimization: number
  }
  // APO - Align, Plan, Organize
  alignment: {
    strategy_alignment: number
    innovation_rate: number
    architecture_compliance: number
    budget_adherence: number
  }
  // BAI - Build, Acquire, Implement
  implementation: {
    project_success_rate: number
    change_success_rate: number
    deployment_frequency: number
    lead_time: number
  }
  // DSS - Deliver, Service, Support
  delivery: {
    service_availability: number
    incident_resolution_rate: number
    first_contact_resolution: number
    sla_compliance: number
    mttr: number
    mtbf: number
  }
  // MEA - Monitor, Evaluate, Assess
  monitoring: {
    control_effectiveness: number
    compliance_rate: number
    audit_findings_resolved: number
    security_incidents: number
  }
}

/**
 * GET /api/analytics/cobit - Get COBIT 2019 Metrics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    // Only managers and admins can view COBIT metrics
    if (!['admin', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito a gestores' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days
    const periodDays = parseInt(period)

    const db = getDatabase()
    const orgId = auth.user.organization_id

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)
    const startDateStr = startDate.toISOString().split('T')[0]

    // ========== DSS - Deliver, Service, Support Metrics ==========

    // Service Availability (based on uptime - simulated from ticket data)
    const totalTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ?
    `).get(orgId, startDateStr) as { count: number }

    const criticalIncidents = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ?
      AND priority IN ('critical', 'high') AND type = 'incident'
    `).get(orgId, startDateStr) as { count: number }

    // Simulated availability based on critical incidents
    const serviceAvailability = Math.max(95, 100 - (criticalIncidents.count * 0.1))

    // Incident Resolution Rate
    const resolvedIncidents = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ?
      AND type = 'incident' AND status IN ('resolved', 'closed')
    `).get(orgId, startDateStr) as { count: number }

    const totalIncidents = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ?
      AND type = 'incident'
    `).get(orgId, startDateStr) as { count: number }

    const incidentResolutionRate = totalIncidents.count > 0
      ? Math.round((resolvedIncidents.count / totalIncidents.count) * 100)
      : 100

    // First Contact Resolution
    const fcrTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      WHERE t.organization_id = ? AND t.created_at >= ?
      AND t.status IN ('resolved', 'closed')
      AND (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) <= 2
    `).get(orgId, startDateStr) as { count: number }

    const closedTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ?
      AND status IN ('resolved', 'closed')
    `).get(orgId, startDateStr) as { count: number }

    const firstContactResolution = closedTickets.count > 0
      ? Math.round((fcrTickets.count / closedTickets.count) * 100)
      : 0

    // SLA Compliance
    const slaMetTickets = db.prepare(`
      SELECT COUNT(*) as count FROM sla_tracking
      WHERE organization_id = ? AND created_at >= ?
      AND (response_breach = 0 OR response_breach IS NULL)
      AND (resolution_breach = 0 OR resolution_breach IS NULL)
    `).get(orgId, startDateStr) as { count: number }

    const totalSlaTracked = db.prepare(`
      SELECT COUNT(*) as count FROM sla_tracking
      WHERE organization_id = ? AND created_at >= ?
    `).get(orgId, startDateStr) as { count: number }

    const slaCompliance = totalSlaTracked.count > 0
      ? Math.round((slaMetTickets.count / totalSlaTracked.count) * 100)
      : 100

    // MTTR (Mean Time To Resolve) in hours
    const mttrResult = db.prepare(`
      SELECT AVG(
        (julianday(resolved_at) - julianday(created_at)) * 24
      ) as avg_hours
      FROM tickets
      WHERE organization_id = ? AND created_at >= ?
      AND resolved_at IS NOT NULL
    `).get(orgId, startDateStr) as { avg_hours: number | null }

    const mttr = Math.round((mttrResult.avg_hours || 0) * 10) / 10

    // MTBF (Mean Time Between Failures) in hours
    const mtbf = totalIncidents.count > 0
      ? Math.round((periodDays * 24) / totalIncidents.count)
      : periodDays * 24

    // ========== BAI - Build, Acquire, Implement Metrics ==========

    // Change Success Rate
    const successfulChanges = db.prepare(`
      SELECT COUNT(*) as count FROM change_requests
      WHERE organization_id = ? AND created_at >= ?
      AND status = 'completed'
    `).get(orgId, startDateStr) as { count: number }

    const totalChanges = db.prepare(`
      SELECT COUNT(*) as count FROM change_requests
      WHERE organization_id = ? AND created_at >= ?
      AND status IN ('completed', 'failed', 'cancelled')
    `).get(orgId, startDateStr) as { count: number }

    const changeSuccessRate = totalChanges.count > 0
      ? Math.round((successfulChanges.count / totalChanges.count) * 100)
      : 100

    // Deployment Frequency (changes per week)
    const deploymentFrequency = totalChanges.count > 0
      ? Math.round((successfulChanges.count / (periodDays / 7)) * 10) / 10
      : 0

    // Lead Time (average time from change creation to completion) in days
    const leadTimeResult = db.prepare(`
      SELECT AVG(
        julianday(completed_at) - julianday(created_at)
      ) as avg_days
      FROM change_requests
      WHERE organization_id = ? AND created_at >= ?
      AND completed_at IS NOT NULL
    `).get(orgId, startDateStr) as { avg_days: number | null }

    const leadTime = Math.round((leadTimeResult.avg_days || 0) * 10) / 10

    // ========== EDM - Governance Metrics ==========

    // Stakeholder Satisfaction (based on feedback and resolution)
    const stakeholderSatisfaction = Math.round(
      (slaCompliance * 0.4) +
      (incidentResolutionRate * 0.3) +
      (firstContactResolution * 0.3)
    )

    // Value Realization (composite metric)
    const valueRealization = Math.round(
      (serviceAvailability * 0.3) +
      (changeSuccessRate * 0.3) +
      (slaCompliance * 0.4)
    )

    // Risk Optimization
    const riskOptimization = Math.round(
      100 - (criticalIncidents.count * 2) - ((100 - changeSuccessRate) * 0.5)
    )

    // Resource Optimization (based on FCR and efficiency)
    const resourceOptimization = Math.round(
      (firstContactResolution * 0.5) +
      (incidentResolutionRate * 0.3) +
      (changeSuccessRate * 0.2)
    )

    // ========== APO - Alignment Metrics ==========

    // Strategy Alignment (simulated based on overall metrics)
    const strategyAlignment = Math.round(
      (slaCompliance * 0.3) +
      (changeSuccessRate * 0.3) +
      (serviceAvailability * 0.4) - 5
    )

    // Innovation Rate (new service requests as % of total)
    const newRequests = db.prepare(`
      SELECT COUNT(*) as count FROM service_requests
      WHERE organization_id = ? AND created_at >= ?
    `).get(orgId, startDateStr) as { count: number }

    const innovationRate = totalTickets.count > 0
      ? Math.round((newRequests.count / totalTickets.count) * 100)
      : 0

    // Architecture Compliance (CIs with proper relationships)
    const cisWithRelations = db.prepare(`
      SELECT COUNT(DISTINCT parent_ci_id) + COUNT(DISTINCT child_ci_id) as count
      FROM ci_relationships
      WHERE created_at >= ?
    `).get(startDateStr) as { count: number }

    const totalCIs = db.prepare(`
      SELECT COUNT(*) as count FROM configuration_items
      WHERE organization_id = ?
    `).get(orgId) as { count: number }

    const architectureCompliance = totalCIs.count > 0
      ? Math.min(100, Math.round((cisWithRelations.count / totalCIs.count) * 100))
      : 0

    // ========== MEA - Monitoring Metrics ==========

    // Control Effectiveness (based on SLA and change success)
    const controlEffectiveness = Math.round(
      (slaCompliance * 0.5) + (changeSuccessRate * 0.5)
    )

    // Compliance Rate (tickets following proper workflow)
    const complianceRate = Math.round(
      (slaCompliance * 0.6) + (changeSuccessRate * 0.4)
    )

    // Security Incidents
    const securityIncidents = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ?
      AND (title LIKE '%segurança%' OR title LIKE '%security%'
           OR description LIKE '%segurança%' OR description LIKE '%security%')
    `).get(orgId, startDateStr) as { count: number }

    const metrics: COBITMetrics = {
      governance: {
        stakeholder_satisfaction: Math.max(0, Math.min(100, stakeholderSatisfaction)),
        value_realization: Math.max(0, Math.min(100, valueRealization)),
        risk_optimization: Math.max(0, Math.min(100, riskOptimization)),
        resource_optimization: Math.max(0, Math.min(100, resourceOptimization))
      },
      alignment: {
        strategy_alignment: Math.max(0, Math.min(100, strategyAlignment)),
        innovation_rate: Math.max(0, Math.min(100, innovationRate)),
        architecture_compliance: Math.max(0, Math.min(100, architectureCompliance)),
        budget_adherence: 85 // Placeholder - would need financial data
      },
      implementation: {
        project_success_rate: 80, // Placeholder - would need project data
        change_success_rate: Math.max(0, Math.min(100, changeSuccessRate)),
        deployment_frequency: deploymentFrequency,
        lead_time: leadTime
      },
      delivery: {
        service_availability: Math.max(0, Math.min(100, serviceAvailability)),
        incident_resolution_rate: Math.max(0, Math.min(100, incidentResolutionRate)),
        first_contact_resolution: Math.max(0, Math.min(100, firstContactResolution)),
        sla_compliance: Math.max(0, Math.min(100, slaCompliance)),
        mttr: mttr,
        mtbf: mtbf
      },
      monitoring: {
        control_effectiveness: Math.max(0, Math.min(100, controlEffectiveness)),
        compliance_rate: Math.max(0, Math.min(100, complianceRate)),
        audit_findings_resolved: 90, // Placeholder
        security_incidents: securityIncidents.count
      }
    }

    // Calculate overall maturity level (1-5 scale)
    const overallScore = (
      metrics.governance.stakeholder_satisfaction +
      metrics.governance.value_realization +
      metrics.delivery.sla_compliance +
      metrics.delivery.service_availability +
      metrics.implementation.change_success_rate
    ) / 5

    const maturityLevel = Math.min(5, Math.max(1, Math.round(overallScore / 20)))

    // Get trends (compare to previous period)
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - periodDays)
    const previousStartDateStr = previousStartDate.toISOString().split('T')[0]

    const previousSLA = db.prepare(`
      SELECT
        SUM(CASE WHEN response_breach = 0 OR response_breach IS NULL THEN 1 ELSE 0 END) * 100.0 /
        NULLIF(COUNT(*), 0) as rate
      FROM sla_tracking
      WHERE organization_id = ? AND created_at >= ? AND created_at < ?
    `).get(orgId, previousStartDateStr, startDateStr) as { rate: number | null }

    const trends = {
      sla_trend: previousSLA.rate
        ? Math.round(slaCompliance - (previousSLA.rate || slaCompliance))
        : 0,
      resolution_trend: 0, // Would calculate similarly
      satisfaction_trend: 0
    }

    return NextResponse.json({
      success: true,
      metrics,
      maturity_level: maturityLevel,
      maturity_description: getMaturityDescription(maturityLevel),
      trends,
      period_days: periodDays,
      generated_at: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error fetching COBIT metrics', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar métricas COBIT' },
      { status: 500 }
    )
  }
}

function getMaturityDescription(level: number): string {
  const descriptions: Record<number, string> = {
    1: 'Inicial - Processos ad hoc e caóticos',
    2: 'Gerenciado - Processos planejados e controlados no nível de projeto',
    3: 'Definido - Processos caracterizados e bem compreendidos',
    4: 'Quantitativamente Gerenciado - Processos medidos e controlados',
    5: 'Otimizado - Foco em melhoria contínua de processos'
  }
  return descriptions[level] || descriptions[1]
}
