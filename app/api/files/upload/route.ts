import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import {
  validateFile,
  generateSecureFilename,
  saveFileLocally,
  getPublicFileUrl,
  formatFileSize,
  getFileIcon,
  isImageFile
} from '@/lib/utils/file-upload'

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const entityId = formData.get('entityId') as string
    const isPublic = formData.get('isPublic') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo foi enviado' }, { status: 400 })
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Validate entity if provided
    if (entityType && entityId) {
      const entityIdNum = parseInt(entityId)

      // Validate based on entity type
      switch (entityType) {
        case 'ticket':
          const ticket = db.prepare(
            'SELECT id FROM tickets WHERE id = ? AND tenant_id = ?'
          ).get(entityIdNum, tenantContext.id)

          if (!ticket) {
            return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
          }

          // Check if user has access to the ticket
          if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
            const userTicket = db.prepare(
              'SELECT id FROM tickets WHERE id = ? AND tenant_id = ? AND user_id = ?'
            ).get(entityIdNum, tenantContext.id, userContext.id)

            if (!userTicket) {
              return NextResponse.json({ error: 'Sem permissão para acessar este ticket' }, { status: 403 })
            }
          }
          break

        case 'comment':
          const comment = db.prepare(
            'SELECT c.id FROM comments c JOIN tickets t ON c.ticket_id = t.id WHERE c.id = ? AND c.tenant_id = ?'
          ).get(entityIdNum, tenantContext.id)

          if (!comment) {
            return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })
          }
          break

        case 'knowledge_article':
          if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
            return NextResponse.json({ error: 'Permissão insuficiente para anexar arquivos em artigos' }, { status: 403 })
          }

          const article = db.prepare(
            'SELECT id FROM knowledge_articles WHERE id = ? AND tenant_id = ?'
          ).get(entityIdNum, tenantContext.id)

          if (!article) {
            return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
          }
          break
      }
    }

    // Generate secure filename
    const secureFilename = generateSecureFilename(file.name)

    // Create subdirectory based on entity type and tenant
    const subPath = entityType
      ? `${tenantContext.id}/${entityType}`
      : `${tenantContext.id}/general`

    // Save file locally
    const filePath = await saveFileLocally(file, secureFilename, subPath)

    // Create file record in database
    const result = db.prepare(`
      INSERT INTO file_storage (
        tenant_id, filename, original_name, mime_type, size, file_path,
        storage_type, uploaded_by, entity_type, entity_id, is_public,
        virus_scanned, virus_scan_result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenantContext.id,
      secureFilename,
      file.name,
      file.type,
      file.size,
      filePath,
      'local',
      userContext.id,
      entityType || null,
      entityId ? parseInt(entityId) : null,
      isPublic ? 1 : 0,
      0, // virus_scanned - TODO: Implement virus scanning
      null // virus_scan_result
    )

    // Get the created file record with user info
    const fileRecord = db.prepare(`
      SELECT
        fs.id,
        fs.filename,
        fs.original_name,
        fs.mime_type,
        fs.size,
        fs.file_path,
        fs.storage_type,
        fs.entity_type,
        fs.entity_id,
        fs.is_public,
        fs.virus_scanned,
        fs.virus_scan_result,
        fs.created_at,
        u.name as uploaded_by_name
      FROM file_storage fs
      LEFT JOIN users u ON fs.uploaded_by = u.id AND u.tenant_id = ?
      WHERE fs.id = ?
    `).get(tenantContext.id, result.lastInsertRowid) as any

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
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = `
      SELECT
        fs.id,
        fs.filename,
        fs.original_name,
        fs.mime_type,
        fs.size,
        fs.file_path,
        fs.storage_type,
        fs.entity_type,
        fs.entity_id,
        fs.is_public,
        fs.virus_scanned,
        fs.virus_scan_result,
        fs.created_at,
        u.name as uploaded_by_name
      FROM file_storage fs
      LEFT JOIN users u ON fs.uploaded_by = u.id AND u.tenant_id = ?
      WHERE fs.tenant_id = ?
    `
    const queryParams: (string | number)[] = [tenantContext.id, tenantContext.id]

    if (entityType) {
      query += ' AND fs.entity_type = ?'
      queryParams.push(entityType)
    }

    if (entityId) {
      query += ' AND fs.entity_id = ?'
      queryParams.push(parseInt(entityId))
    }

    // If not admin, only show files uploaded by user or public files
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      query += ' AND (fs.uploaded_by = ? OR fs.is_public = 1)'
      queryParams.push(userContext.id)
    }

    query += ' ORDER BY fs.created_at DESC LIMIT ? OFFSET ?'
    queryParams.push(limit, offset)

    const files = db.prepare(query).all(...queryParams) as any[]

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM file_storage WHERE tenant_id = ?'
    const countParams: (string | number)[] = [tenantContext.id]

    if (entityType) {
      countQuery += ' AND entity_type = ?'
      countParams.push(entityType)
    }

    if (entityId) {
      countQuery += ' AND entity_id = ?'
      countParams.push(parseInt(entityId))
    }

    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      countQuery += ' AND (uploaded_by = ? OR is_public = 1)'
      countParams.push(userContext.id)
    }

    const totalCount = (db.prepare(countQuery).get(...countParams) as any)?.count || 0

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