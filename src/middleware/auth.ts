import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stackServerApp } from "@/src/lib/auth";
import { applySecurityHeaders } from "@/src/lib/security";
import { logAccess } from "@/src/lib/audit";

// Rotas protegidas
const protectedRoutes = [
  "/dashboard",
  "/admin",
  "/profile",
  "/api/protected",
];

// Rotas de autenticação
const authRoutes = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/password-reset",
];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Headers de segurança
  const response = NextResponse.next();
  applySecurityHeaders(response);
  
  // Verificar autenticação para rotas protegidas
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!stackServerApp) {
      return new NextResponse('Stack Auth not configured', { status: 500 });
    }
    
    const user = await stackServerApp.getUser({ or: "return-null" });
    
    if (!user) {
      return NextResponse.redirect(new URL("/auth/sign-in", request.url));
    }
    
    // Log de acesso para auditoria
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await logAccess(user.id, pathname, ip);
  }
  
  // Redirecionar usuários autenticados de páginas de auth
  if (authRoutes.some(route => pathname.startsWith(route))) {
    if (!stackServerApp) {
      return response;
    }
    
    const user = await stackServerApp.getUser({ or: "return-null" });
    
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
  
  return response;
}
