import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

// SECURITY: Base directory for file storage - all file operations must be within this directory
const UPLOADS_BASE_PATH = path.resolve(process.cwd(), 'uploads');

/**
 * SECURITY: Validates and sanitizes file paths to prevent path traversal attacks.
 * Returns the safe resolved path or null if the path is invalid/malicious.
 */
function validateAndResolvePath(decodedPath: string): string | null {
  // Reject paths containing null bytes (potential bypass attempt)
  if (decodedPath.includes('\0')) {
    return null;
  }

  // Reject absolute paths
  if (path.isAbsolute(decodedPath)) {
    return null;
  }

  // Reject paths with explicit traversal patterns
  if (decodedPath.includes('..') || decodedPath.includes('//')) {
    return null;
  }

  // Normalize and sanitize the path
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');

  // Resolve the full path within the uploads directory
  const resolvedPath = path.resolve(UPLOADS_BASE_PATH, safePath);

  // CRITICAL: Ensure the resolved path is within the allowed base directory
  if (!resolvedPath.startsWith(UPLOADS_BASE_PATH + path.sep) && resolvedPath !== UPLOADS_BASE_PATH) {
    return null;
  }

  return resolvedPath;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { path: filePath } = await params
    const fullPath = filePath.join('/')

    // Decode the file path
    const decodedPath = decodeURIComponent(fullPath)

    // SECURITY: Validate path to prevent path traversal attacks
    const physicalPath = validateAndResolvePath(decodedPath);
    if (!physicalPath) {
      logger.warn('Path traversal attempt blocked', { path: decodedPath, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' });
      return new Response('Forbidden: Invalid file path', { status: 403 });
    }

    // Get file info from database
    const fileRecord = db.prepare(
      'SELECT * FROM file_storage WHERE file_path = ?'
    ).get(decodedPath) as any

    if (!fileRecord) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // Check tenant context
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext || tenantContext.id !== fileRecord.tenant_id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // If file is not public, check authentication and permissions
    if (!fileRecord.is_public) {
      const userContext = getUserContextFromRequest(request)
      if (!userContext) {
        return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
      }

      // Check if user can access the file
      const canAccess = (
        // File owner
        userContext.id === fileRecord.uploaded_by ||
        // Admin users can access all files
        ['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role) ||
        // For ticket files, check if user has access to the ticket
        (fileRecord.entity_type === 'ticket' && await hasTicketAccess(
          fileRecord.entity_id,
          userContext.id,
          userContext.role,
          tenantContext.id
        ))
      )

      if (!canAccess) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    // NOTE: physicalPath is already securely computed at the start of this function
    // using validateAndResolvePath() which prevents path traversal attacks

    // Check if file exists
    if (!fs.existsSync(physicalPath)) {
      return NextResponse.json({ error: 'Arquivo físico não encontrado' }, { status: 404 })
    }

    // Read file
    const fileBuffer = fs.readFileSync(physicalPath)

    // Set appropriate headers
    const headers = new Headers()
    headers.set('Content-Type', fileRecord.mime_type || 'application/octet-stream')
    headers.set('Content-Length', fileRecord.size.toString())
    headers.set('Content-Disposition', `inline; filename="${fileRecord.original_name}"`)
    headers.set('Cache-Control', 'public, max-age=31536000') // 1 year cache

    return new NextResponse(fileBuffer, { headers })

  } catch (error) {
    logger.error('Error serving file', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

async function hasTicketAccess(
  ticketId: number,
  userId: number,
  userRole: string,
  tenantId: number
): Promise<boolean> {
  // Admin users have access to all tickets
  if (['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userRole)) {
    return true
  }

  // Check if user owns the ticket
  const ticket = db.prepare(
    'SELECT id FROM tickets WHERE id = ? AND user_id = ? AND tenant_id = ?'
  ).get(ticketId, userId, tenantId)

  return !!ticket
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { path: filePath } = await params
    const fullPath = filePath.join('/')
    const decodedPath = decodeURIComponent(fullPath)

    // SECURITY: Validate path to prevent path traversal attacks
    const physicalPath = validateAndResolvePath(decodedPath);
    if (!physicalPath) {
      logger.warn('Path traversal attempt blocked in DELETE', { path: decodedPath, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' });
      return new Response('Forbidden: Invalid file path', { status: 403 });
    }

    // Get file record
    const fileRecord = db.prepare(
      'SELECT * FROM file_storage WHERE file_path = ? AND tenant_id = ?'
    ).get(decodedPath, tenantContext.id) as any

    if (!fileRecord) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // Check permissions - only file owner or admins can delete
    const canDelete = (
      fileRecord.uploaded_by === userContext.id ||
      ['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    )

    if (!canDelete) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    // Delete physical file (using securely validated physicalPath)
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath)
    }

    // Delete database record
    db.prepare('DELETE FROM file_storage WHERE id = ?').run(fileRecord.id)

    return NextResponse.json({
      success: true,
      message: 'Arquivo excluído com sucesso'
    })

  } catch (error) {
    logger.error('Error deleting file', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}