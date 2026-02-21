import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import {
  getTenantContextFromRequest,
  getUserContextFromRequest,
  validateTenantAccess,
} from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

// SECURITY: Base directory for file storage - all file operations must be within this directory
const UPLOADS_BASE_PATH = path.resolve(process.cwd(), 'uploads');
const FILE_ADMIN_ROLES = ['super_admin', 'tenant_admin', 'team_manager', 'admin'];
const TICKET_ELEVATED_ROLES = ['super_admin', 'tenant_admin', 'team_manager', 'admin', 'agent', 'manager'];

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

function resolvePhysicalPathWithLegacyFallback(decodedPath: string): string | null {
  const primaryPath = validateAndResolvePath(decodedPath);
  if (!primaryPath) {
    return null;
  }

  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  // Legacy compatibility: some records persist file_path as uploads/<tenant>/...
  if (decodedPath.startsWith('uploads/')) {
    const withoutPrefix = decodedPath.substring('uploads/'.length);
    const fallbackPath = validateAndResolvePath(withoutPrefix);
    if (fallbackPath && fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  return primaryPath;
}

export async function GET(
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

    const { path: filePath } = await params
    const fullPath = filePath.join('/')

    // Decode the file path
    const decodedPath = decodeURIComponent(fullPath)

    // SECURITY: Validate path to prevent path traversal attacks
    const physicalPath = resolvePhysicalPathWithLegacyFallback(decodedPath);
    if (!physicalPath) {
      logger.warn('Path traversal attempt blocked', { path: decodedPath, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' });
      return new Response('Forbidden: Invalid file path', { status: 403 });
    }

    // Get file info from database scoped by tenant
    let fileRecord: any;
    try {
      fileRecord = await executeQueryOne<any>('SELECT * FROM file_storage WHERE (file_path = ? OR storage_path = ?) AND COALESCE(tenant_id, organization_id) = ?', [decodedPath, decodedPath, tenantContext.id])
    } catch {
      fileRecord = await executeQueryOne<any>('SELECT * FROM file_storage WHERE (file_path = ? OR storage_path = ?) AND organization_id = ?', [decodedPath, decodedPath, tenantContext.id])
    }

    if (!fileRecord) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    const recordTenantId = Number(fileRecord.tenant_id ?? fileRecord.organization_id ?? 0);
    if (recordTenantId !== tenantContext.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // If file is not public, check authentication and permissions
    if (!fileRecord.is_public) {
      const userContext = getUserContextFromRequest(request)
      if (!userContext) {
        return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
      }

      if (!validateTenantAccess(userContext, tenantContext)) {
        return NextResponse.json({ error: 'Acesso negado - mismatch de tenant' }, { status: 403 })
      }

      // Check if user can access the file
      const canAccess = (
        // File owner
        userContext.id === fileRecord.uploaded_by ||
        // Admin users can access all files
        FILE_ADMIN_ROLES.includes(userContext.role) ||
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
    } else {
      // If user is authenticated, enforce tenant match even for public file reads.
      const userContext = getUserContextFromRequest(request)
      if (userContext && !validateTenantAccess(userContext, tenantContext)) {
        return NextResponse.json({ error: 'Acesso negado - mismatch de tenant' }, { status: 403 })
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
    headers.set('Content-Length', Number(fileRecord.size ?? fileRecord.file_size ?? 0).toString())
    // Sanitize filename: remove control characters, quotes, backslashes, and non-ASCII
    const rawFilename = fileRecord.original_name || fileRecord.original_filename || fileRecord.filename || 'download'
    const safeFilename = rawFilename
      .replace(/[^\w.\-() ]/g, '_')
      .replace(/_{2,}/g, '_')
    headers.set(
      'Content-Disposition',
      `inline; filename="${safeFilename}"`
    )
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
  if (TICKET_ELEVATED_ROLES.includes(userRole)) {
    try {
      const ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND tenant_id = ?', [ticketId, tenantId])
      return !!ticket
    } catch {
      const ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND organization_id = ?', [ticketId, tenantId])
      return !!ticket
    }
  }

  // Check if user owns the ticket
  let ticket;
  try {
    ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND user_id = ? AND tenant_id = ?', [ticketId, userId, tenantId])
  } catch {
    ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND user_id = ? AND organization_id = ?', [ticketId, userId, tenantId])
  }

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

    if (!validateTenantAccess(userContext, tenantContext)) {
      return NextResponse.json({ error: 'Acesso negado - mismatch de tenant' }, { status: 403 })
    }

    const { path: filePath } = await params
    const fullPath = filePath.join('/')
    const decodedPath = decodeURIComponent(fullPath)

    // SECURITY: Validate path to prevent path traversal attacks
    const physicalPath = resolvePhysicalPathWithLegacyFallback(decodedPath);
    if (!physicalPath) {
      logger.warn('Path traversal attempt blocked in DELETE', { path: decodedPath, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' });
      return new Response('Forbidden: Invalid file path', { status: 403 });
    }

    // Get file record
    let fileRecord: any;
    try {
      fileRecord = await executeQueryOne<any>('SELECT * FROM file_storage WHERE (file_path = ? OR storage_path = ?) AND COALESCE(tenant_id, organization_id) = ?', [decodedPath, decodedPath, tenantContext.id])
    } catch {
      fileRecord = await executeQueryOne<any>('SELECT * FROM file_storage WHERE (file_path = ? OR storage_path = ?) AND organization_id = ?', [decodedPath, decodedPath, tenantContext.id])
    }

    if (!fileRecord) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    const recordTenantId = Number(fileRecord.tenant_id ?? fileRecord.organization_id ?? 0);
    if (recordTenantId !== tenantContext.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Check permissions - only file owner or admins can delete
    const canDelete = (
      fileRecord.uploaded_by === userContext.id ||
      FILE_ADMIN_ROLES.includes(userContext.role)
    )

    if (!canDelete) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    // Delete physical file (using securely validated physicalPath)
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath)
    }

    // Delete database record
    try {
      await executeRun('DELETE FROM file_storage WHERE id = ? AND COALESCE(tenant_id, organization_id) = ?', [fileRecord.id, tenantContext.id])
    } catch {
      await executeRun('DELETE FROM file_storage WHERE id = ? AND organization_id = ?', [fileRecord.id, tenantContext.id])
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo excluído com sucesso'
    })

  } catch (error) {
    logger.error('Error deleting file', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
