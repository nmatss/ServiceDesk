import { NextRequest, NextResponse } from "next/server";
import { requireTenantUserContext } from "@/lib/tenant/request-guard";
import { z } from "zod";
import { logger } from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Schema de validação
const requestSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  data: z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
  }),
});

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { userId, role } = guard.auth!;

    // Validar entrada
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Verificar permissões específicas
    if (validatedData.action === "delete" && role !== 'admin') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Log de auditoria
    logger.info('User action', {
      userId,
      action: validatedData.action,
      data: validatedData.data,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    // Processar requisição
    const result = await processRequest(validatedData);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }

    logger.error("API Error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processRequest(data: z.infer<typeof requestSchema>) {
  // Implementar lógica de negócio aqui
  return { processed: true, timestamp: new Date().toISOString() };
}
