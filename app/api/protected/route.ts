import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/src/lib/auth";
import { z } from "zod";
import { logUserAction } from "@/src/lib/audit";

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
  try {
    // Verificar autenticação
    if (!stackServerApp) {
      return NextResponse.json({ error: "Stack Auth not configured" }, { status: 500 });
    }
    
    const user = await stackServerApp.getUser({ or: "return-null" });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Validar entrada
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    // Verificar permissões específicas
    if (validatedData.action === "delete" && !user.serverMetadata?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Log de auditoria
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await logUserAction(user.id, validatedData.action, validatedData.data, ip);
    
    // Processar requisição
    const result = await processRequest(validatedData);
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processRequest(data: any) {
  // Implementar lógica de negócio aqui
  return { processed: true, timestamp: new Date().toISOString() };
}
