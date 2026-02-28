import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin, ADMIN_ROLES } from '@/lib/auth/roles';
import { apiError } from '@/lib/api/api-helpers';
import { logger } from '@/lib/monitoring/logger';
import { ReportFilters } from '@/lib/reports';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import {
  getTicketMetrics,
  getAgentPerformance,
  getSLAReport,
  getExecutiveDashboard,
  getTrendData,
  getSatisfactionMetrics,
  exportToCSV
} from '@/lib/reports';

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas administradores podem acessar relatórios administrativos.
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'overview';
    const period = searchParams.get('period') || '30';
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const agentId = searchParams.get('agent_id');
    const categoryId = searchParams.get('category_id');
    const priorityId = searchParams.get('priority_id');

    // SECURITY: Configurar filtros com tenantId OBRIGATÓRIO
    const filters: ReportFilters = {
      tenantId: tenantId, // MANDATORY for multi-tenant security
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      assignedTo: agentId ? parseInt(agentId) : undefined,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      priorityId: priorityId ? parseInt(priorityId) : undefined
    };

    let reportData: any;

    switch (reportType) {
      case 'overview':
      case 'tickets':
        reportData = getTicketMetrics(filters);
        break;

      case 'agents':
        reportData = getAgentPerformance(filters);
        break;

      case 'sla':
        reportData = getSLAReport(filters);
        break;

      case 'executive':
        reportData = getExecutiveDashboard(filters);
        break;

      case 'trends':
        reportData = getTrendData(filters);
        break;

      case 'satisfaction':
        reportData = getSatisfactionMetrics(filters);
        break;

      case 'custom':
        reportData = getTicketMetrics(filters);
        break;

      default:
        return NextResponse.json({ error: 'Tipo de relatório inválido' }, { status: 400 });
    }

    // Se formato é CSV, exportar como CSV
    if (format === 'csv') {
      const csvData = exportToCSV(reportData, reportType);

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="report_${reportType}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Retornar JSON
    return NextResponse.json({
      success: true,
      type: reportType,
      period: filters.period,
      generatedAt: new Date().toISOString(),
      data: reportData,
      reports: reportData
    });

  } catch (error) {
    logger.error('Erro ao gerar relatórios', error);
    return apiError('Erro interno do servidor', 500);
  }
}

// POST - Gerar relatório customizado ou agendar relatório
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem criar relatórios customizados
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const body = await request.json();
    const {
      name,
      description,
      type,
      filters: userFilters = {},
      metrics: _metrics = [],
      groupBy: _groupBy = 'date',
      format = 'json',
      schedule = null,
      recipients: _recipients = []
    } = body;

    // Validar dados obrigatórios
    if (!name || !type) {
      return NextResponse.json({
        error: 'Nome e tipo do relatório são obrigatórios'
      }, { status: 400 });
    }

    // SECURITY: Merge user filters with mandatory tenantId
    const filters: ReportFilters = {
      ...userFilters,
      tenantId: tenantId // MANDATORY - overwrite any user-provided tenantId
    };

    // Gerar relatório
    let reportData: any;

    try {
      switch (type) {
        case 'tickets':
          reportData = getTicketMetrics(filters);
          break;
        case 'agents':
          reportData = getAgentPerformance(filters);
          break;
        case 'sla':
          reportData = getSLAReport(filters);
          break;
        case 'executive':
          reportData = getExecutiveDashboard(filters);
          break;
        case 'trends':
          reportData = getTrendData(filters);
          break;
        case 'satisfaction':
          reportData = getSatisfactionMetrics(filters);
          break;
        case 'custom':
          reportData = getTicketMetrics(filters);
          break;
        default:
          return NextResponse.json({
            error: 'Tipo de relatório inválido'
          }, { status: 400 });
      }
    } catch (reportError) {
      logger.error('Erro ao gerar dados do relatório', reportError);
      return NextResponse.json({
        error: 'Erro ao processar relatório'
      }, { status: 500 });
    }

    // Se é um relatório agendado, salvar configuração
    if (schedule) {
      logger.info('Agendamento de relatório solicitado', schedule);
    }

    // Preparar resposta
    const response: any = {
      success: true,
      report: {
        name,
        description,
        type,
        generatedAt: new Date().toISOString(),
        generatedBy: auth.name,
        filters,
        data: reportData
      }
    };

    // Se formato é CSV, converter dados
    if (format === 'csv') {
      const csvData = exportToCSV(reportData, type);
      response.report.csvData = csvData;
      response.report.downloadUrl = `/api/admin/reports/download?id=${Date.now()}`;
    }

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Erro ao criar relatório customizado', error);
    return apiError('Erro interno do servidor', 500);
  }
}
