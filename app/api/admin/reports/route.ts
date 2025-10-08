import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';
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

    // Apenas admins e agentes podem acessar relatórios
    if (!['admin', 'agent'].includes(user.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'overview';
    const period = searchParams.get('period') || '30';
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const agentId = searchParams.get('agent_id');
    const categoryId = searchParams.get('category_id');
    const priorityId = searchParams.get('priority_id');

    // Configurar filtros
    const filters: any = {
      period: parseInt(period),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      agentId: agentId ? parseInt(agentId) : undefined,
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
        const metrics = searchParams.get('metrics')?.split(',') || [];
        const groupBy = searchParams.get('group_by') || 'date';
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
      data: reportData
    });

  } catch (error) {
    logger.error('Erro ao gerar relatórios', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Gerar relatório customizado ou agendar relatório
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

    // Apenas admins podem criar relatórios customizados
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      type,
      filters = {},
      metrics = [],
      groupBy = 'date',
      format = 'json',
      schedule = null,
      recipients = []
    } = body;

    // Validar dados obrigatórios
    if (!name || !type) {
      return NextResponse.json({
        error: 'Nome e tipo do relatório são obrigatórios'
      }, { status: 400 });
    }

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
      // TODO: Implementar sistema de agendamento
      // Por enquanto, apenas retornar os dados
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
        generatedBy: user.name,
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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
