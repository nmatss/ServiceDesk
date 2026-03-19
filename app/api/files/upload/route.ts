import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { ADMIN_ROLES, TICKET_MANAGEMENT_ROLES } from '@/lib/auth/roles';
import {
  validateFile,
  validateMagicBytes,
  generateSecureFilename,
  saveFileLocally,
  getPublicFileUrl,
  formatFileSize,
  getFileIcon,
  isImageFile
} from '@/lib/utils/file-upload'
import { scanFile } from '@/lib/security/virus-scanner'

const TICKET_ELEVATED_ROLES = [...TICKET_MANAGEMENT_ROLES, 'manager'];
const ALLOWED_ENTITY_TYPES = new Set(['ticket', 'comment', 'knowledge_article']);

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

async function hasTicketAccess(ticketId: number, tenantId: number, userId: number, role: string): Promise<boolean> {
  if (TICKET_ELEVATED_ROLES.includes(role)) {
    try {
      const ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND tenant_id = ?', [ticketId, tenantId]);
      return Boolean(ticket);
    } catch {
      const ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND organization_id = ?', [ticketId, tenantId]);
      return Boolean(ticket);
    }
  }

  try {
    const ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND tenant_id = ? AND user_id = ?', [ticketId, tenantId, userId]);
    return Boolean(ticket);
  } catch {
    const ticket = await executeQueryOne('SELECT id FROM tickets WHERE id = ? AND organization_id = ? AND user_id = ?', [ticketId, tenantId, userId]);
    return Boolean(ticket);
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityTypeRaw = formData.get('entityType')
    const entityIdRaw = formData.get('entityId')
    const entityType = typeof entityTypeRaw === 'string' && entityTypeRaw.trim()
      ? entityTypeRaw.trim()
      : null
    const entityId = parsePositiveInt(entityIdRaw)
    const isPublic = formData.get('isPublic') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo foi enviado' }, { status: 400 })
    }

    if ((entityType && entityId === null) || (!entityType && entityId !== null)) {
      return NextResponse.json({ error: 'entityType e entityId devem ser enviados juntos' }, { status: 400 })
    }

    if (entityType && !ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 })
    }

    if (isPublic && !isAdminRole(auth.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem publicar arquivos' }, { status: 403 })
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Validate magic bytes to ensure file content matches declared MIME type
    const magicValidation = await validateMagicBytes(file)
    if (!magicValidation.valid) {
      return NextResponse.json({ error: magicValidation.error }, { status: 400 })
    }

    // Virus scan
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const scanResult = await scanFile(fileBuffer, file.name);
    if (!scanResult.safe) {
      return NextResponse.json(
        { error: `Arquivo rejeitado: ${scanResult.threat || 'possível ameaça detectada'}` },
        { status: 400 }
      );
    }

    // Validate entity if provided
    if (entityType && entityId !== null) {
      switch (entityType) {
        case 'ticket': {
          if (!await hasTicketAccess(entityId, auth.organizationId, auth.userId, auth.role)) {
            return NextResponse.json({ error: 'Ticket não encontrado ou sem permissão' }, { status: 404 })
          }
          break
        }

        case 'comment': {
          let comment: { id: number; ticket_id: number; ticket_user_id: number } | undefined;

          try {
            comment = await executeQueryOne<{ id: number; ticket_id: number; ticket_user_id: number }>(`
              SELECT c.id, c.ticket_id, t.user_id as ticket_user_id
              FROM comments c
              JOIN tickets t ON c.ticket_id = t.id
              WHERE c.id = ? AND c.tenant_id = ? AND t.tenant_id = ?
            `, [entityId, auth.organizationId, auth.organizationId]);
          } catch {
            comment = await executeQueryOne<{ id: number; ticket_id: number; ticket_user_id: number }>(`
              SELECT c.id, c.ticket_id, t.user_id as ticket_user_id
              FROM comments c
              JOIN tickets t ON c.ticket_id = t.id
              WHERE c.id = ? AND t.organization_id = ?
            `, [entityId, auth.organizationId]);
          }

          if (!comment) {
            return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })
          }

          const canAccessCommentTicket =
            TICKET_ELEVATED_ROLES.includes(auth.role) ||
            comment.ticket_user_id === auth.userId;
          if (!canAccessCommentTicket) {
            return NextResponse.json({ error: 'Sem permissão para anexar neste comentário' }, { status: 403 })
          }
          break
        }

        case 'knowledge_article': {
          if (!isAdminRole(auth.role)) {
            return NextResponse.json({ error: 'Permissão insuficiente para anexar arquivos em artigos' }, { status: 403 })
          }

          let articleExists = false;
          try {
            const article = await executeQueryOne('SELECT id FROM kb_articles WHERE id = ? AND tenant_id = ?', [entityId, auth.organizationId]);
            articleExists = Boolean(article);
          } catch {
            // Fall through to legacy table check.
          }

          if (!articleExists) {
            const legacyArticle = await executeQueryOne(`
              SELECT ka.id
              FROM knowledge_articles ka
              INNER JOIN users u ON u.id = ka.author_id
              WHERE ka.id = ? AND u.tenant_id = ?
            `, [entityId, auth.organizationId]);
            articleExists = Boolean(legacyArticle);
          }

          if (!articleExists) {
            return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
          }
          break
        }
      }
    }

    // Generate secure filename
    const secureFilename = generateSecureFilename(file.name)

    // Create subdirectory based on entity type and tenant
    const subPath = entityType
      ? `${auth.organizationId}/${entityType}`
      : `${auth.organizationId}/general`

    // Save file locally
    const filePath = await saveFileLocally(file, secureFilename, subPath)

    // Create file record in database
    const result = await executeRun(`
      INSERT INTO file_storage (
        tenant_id, organization_id, filename, original_name, original_filename,
        mime_type, size, file_size, file_path, storage_path, storage_type,
        uploaded_by, entity_type, entity_id, is_public, virus_scanned, virus_scan_result, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [auth.organizationId,
      auth.organizationId,
      secureFilename,
      file.name,
      file.name,
      file.type,
      file.size,
      file.size,
      filePath,
      filePath,
      'local',
      auth.userId,
      entityType || null,
      entityId ?? null,
      isPublic ? 1 : 0,
      scanResult.skipped ? 0 : 1,
      scanResult.skipped ? null : 'clean'
    ])

    // Get the created file record with user info
    const fileRecord = await executeQueryOne<any>(`
      SELECT
        fs.id,
        fs.filename,
        COALESCE(fs.original_name, fs.original_filename, fs.filename) as original_name,
        fs.mime_type,
        COALESCE(fs.size, fs.file_size, 0) as size,
        COALESCE(fs.file_path, fs.storage_path) as file_path,
        fs.storage_type,
        fs.entity_type,
        fs.entity_id,
        fs.is_public,
        fs.virus_scanned,
        fs.virus_scan_result,
        COALESCE(fs.created_at, fs.uploaded_at) as created_at,
        u.name as uploaded_by_name
      FROM file_storage fs
      LEFT JOIN users u ON fs.uploaded_by = u.id
      WHERE fs.id = ?
    `, [result.lastInsertRowid])

    // Build response with additional metadata
    const responseData = {
      success: true,
      file: {
        ...fileRecord,
        url: getPublicFileUrl(fileRecord.file_path),
        formattedSize: formatFileSize(fileRecord.size),
        icon: getFileIcon(fileRecord.mime_type),
        isImage: isImageFile(fileRecord.mime_type)
      }
    }

    return NextResponse.json(responseData, { status: 201 })

  } catch (error) {
    logger.error('Error uploading file', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10)
    const limitRaw = Number.parseInt(searchParams.get('limit') || '20', 10)
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20
    const offset = (page - 1) * limit

    if (entityType && !ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 })
    }

    const parsedEntityId = entityId !== null ? parsePositiveInt(entityId) : null
    if (entityId !== null && parsedEntityId === null) {
      return NextResponse.json({ error: 'entityId inválido' }, { status: 400 })
    }

    // Build query
    let query = `
      SELECT
        fs.id,
        fs.filename,
        COALESCE(fs.original_name, fs.original_filename, fs.filename) as original_name,
        fs.mime_type,
        COALESCE(fs.size, fs.file_size, 0) as size,
        COALESCE(fs.file_path, fs.storage_path) as file_path,
        fs.storage_type,
        fs.entity_type,
        fs.entity_id,
        fs.is_public,
        fs.virus_scanned,
        fs.virus_scan_result,
        COALESCE(fs.created_at, fs.uploaded_at) as created_at,
        u.name as uploaded_by_name
      FROM file_storage fs
      LEFT JOIN users u ON fs.uploaded_by = u.id
      WHERE COALESCE(fs.tenant_id, fs.organization_id) = ?
    `
    const queryParams: (string | number)[] = [auth.organizationId]

    if (entityType) {
      query += ' AND fs.entity_type = ?'
      queryParams.push(entityType)
    }

    if (entityId) {
      query += ' AND fs.entity_id = ?'
      queryParams.push(parsedEntityId as number)
    }

    // If not admin, only show files uploaded by user or public files
    if (!isAdminRole(auth.role)) {
      query += ' AND (fs.uploaded_by = ? OR fs.is_public = 1)'
      queryParams.push(auth.userId)
    }

    query += ' ORDER BY fs.created_at DESC LIMIT ? OFFSET ?'
    queryParams.push(limit, offset)

    const files = await executeQuery<any>(query, queryParams)

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM file_storage WHERE COALESCE(tenant_id, organization_id) = ?'
    const countParams: (string | number)[] = [auth.organizationId]

    if (entityType) {
      countQuery += ' AND entity_type = ?'
      countParams.push(entityType)
    }

    if (entityId) {
      countQuery += ' AND entity_id = ?'
      countParams.push(parsedEntityId as number)
    }

    if (!isAdminRole(auth.role)) {
      countQuery += ' AND (uploaded_by = ? OR is_public = 1)'
      countParams.push(auth.userId)
    }

    const totalCount = (await executeQueryOne<any>(countQuery, countParams))?.count || 0

    // Add metadata to files
    const filesWithMetadata = files.map(file => ({
      ...file,
      url: getPublicFileUrl(file.file_path),
      formattedSize: formatFileSize(file.size),
      icon: getFileIcon(file.mime_type),
      isImage: isImageFile(file.mime_type)
    }))

    return NextResponse.json({
      success: true,
      files: filesWithMetadata,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    logger.error('Error fetching files', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
