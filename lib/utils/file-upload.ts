import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import logger from '../monitoring/structured-logger';

export interface UploadedFile {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  filePath: string
  storageType: 'local' | 's3' | 'cloudinary'
  entityType?: string
  entityId?: number
  isPublic: boolean
  virusScanned: boolean
  virusScanResult?: string
}

export interface FileUploadOptions {
  maxSize?: number // in bytes
  allowedMimeTypes?: string[]
  storageType?: 'local' | 's3' | 'cloudinary'
  isPublic?: boolean
  entityType?: string
  entityId?: number
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed'
]

export function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName)
  const randomString = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now()
  return `${timestamp}_${randomString}${ext}`
}

export function sanitizeFilename(filename: string): string {
  // Remove special characters and replace spaces with underscores
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase()
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase()
}

export function getMimeTypeFromExtension(filename: string): string {
  const ext = getFileExtension(filename)
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Magic byte signatures for validating file content matches declared MIME type.
 * Prevents attackers from uploading malicious files with spoofed extensions/MIME types.
 */
const MAGIC_BYTES: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/jpg': [0xFF, 0xD8, 0xFF],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
  'application/zip': [0x50, 0x4B, 0x03, 0x04],
}

/**
 * Validate that a file's content matches its declared MIME type using magic bytes.
 * Returns true if the MIME type has no known signature or if the signature matches.
 */
export async function validateMagicBytes(file: File): Promise<{ valid: boolean; error?: string }> {
  const expectedBytes = MAGIC_BYTES[file.type]
  if (!expectedBytes) {
    // No known signature for this MIME type -- allow it
    return { valid: true }
  }

  const slice = file.slice(0, expectedBytes.length)
  const buffer = new Uint8Array(await slice.arrayBuffer())

  if (buffer.length < expectedBytes.length) {
    return { valid: false, error: 'Arquivo corrompido ou vazio' }
  }

  for (let i = 0; i < expectedBytes.length; i++) {
    if (buffer[i] !== expectedBytes[i]) {
      return { valid: false, error: 'O conteúdo do arquivo não corresponde ao tipo declarado' }
    }
  }

  return { valid: true }
}

export function validateFile(
  file: File,
  options: FileUploadOptions = {}
): { valid: boolean; error?: string } {
  const maxSize = options.maxSize || DEFAULT_MAX_SIZE
  const allowedMimeTypes = options.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${Math.round(maxSize / 1024 / 1024)}MB`
    }
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de arquivo não permitido'
    }
  }

  return { valid: true }
}

export async function ensureUploadDirectory(subPath: string = ''): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads', subPath)

  try {
    await fs.promises.access(uploadDir)
  } catch {
    await fs.promises.mkdir(uploadDir, { recursive: true })
  }

  return uploadDir
}

export async function saveFileLocally(
  file: File,
  filename: string,
  subPath: string = ''
): Promise<string> {
  const uploadDir = await ensureUploadDirectory(subPath)
  const filePath = path.join(uploadDir, filename)

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  await fs.promises.writeFile(filePath, buffer)

  return path.join('uploads', subPath, filename)
}

export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = path.join(process.cwd(), filePath)
  try {
    await fs.promises.unlink(fullPath)
  } catch (error) {
    logger.error('Error deleting file', error)
  }
}

export function getPublicFileUrl(filePath: string): string {
  // For local storage, return a URL that will be served by our API
  return `/api/files/${encodeURIComponent(filePath)}`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋'
  if (mimeType.startsWith('text/')) return '📄'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📎'
}