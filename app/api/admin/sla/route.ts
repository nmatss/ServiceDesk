import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { getAllSLAPolicies, createSLAPolicy, getSLAMetrics } from '@/lib/sla';
import { CreateSLAPolicy } from '@/lib/types/database';

// GET - Listar todas as políticas de SLA ou métricas
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (action === 'metrics') {
      const metrics = getSLAMetrics(startDate || undefined, endDate || undefined);
      return NextResponse.json({
        success: true,
        metrics
      });
    }

    // Lista políticas de SLA
    const policies = getAllSLAPolicies();

    return NextResponse.json({
      success: true,
      policies
    });
  } catch (error) {
    console.error('Error in SLA API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova política de SLA
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      priority_id,
      category_id,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes,
      business_hours_only,
      is_active
    } = body;

    if (!name || !priority_id || !response_time_minutes || !resolution_time_minutes) {
      return NextResponse.json({
        error: 'Campos obrigatórios: name, priority_id, response_time_minutes, resolution_time_minutes'
      }, { status: 400 });
    }

    const policyData: CreateSLAPolicy = {
      name,
      description,
      priority_id: parseInt(priority_id),
      category_id: category_id ? parseInt(category_id) : undefined,
      response_time_hours: Math.ceil(parseInt(response_time_minutes) / 60),
      resolution_time_hours: Math.ceil(parseInt(resolution_time_minutes) / 60),
      business_hours_only: business_hours_only === true,
      is_active: is_active !== false
    };

    const policy = createSLAPolicy(policyData);

    if (!policy) {
      return NextResponse.json({ error: 'Erro ao criar política de SLA' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Error creating SLA policy:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}