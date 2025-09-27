import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/src/lib/auth";
import { logLoginAttempt } from "@/src/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    // Simular tentativa de login
    if (!stackServerApp) {
      return NextResponse.json({ error: "Stack Auth not configured" }, { status: 500 });
    }
    
    const user = await stackServerApp.getUser({ or: "return-null" });
    
    if (user) {
      await logLoginAttempt(email, true, ip);
      return NextResponse.json({ 
        success: true, 
        message: "Authentication test successful",
        user: {
          id: user.id,
          email: user.primaryEmail,
          isAdmin: user.serverMetadata?.isAdmin || false
        }
      });
    } else {
      await logLoginAttempt(email, false, ip);
      return NextResponse.json({ 
        success: false, 
        message: "Authentication test failed" 
      }, { status: 401 });
    }
  } catch (error) {
    console.error("Auth test error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
