/**
 * API Compression Utilities
 *
 * Features:
 * - Brotli compression (better ratio)
 * - Gzip fallback
 * - Streaming compression
 * - Payload size optimization
 * - Conditional compression based on content type
 */

import { NextResponse } from 'next/server'
import { logger } from '../monitoring/logger'
import zlib from 'zlib'
import { promisify } from 'util'

const brotliCompress = promisify(zlib.brotliCompress)
const gzipCompress = promisify(zlib.gzip)

// ========================
// CONFIGURATION
// ========================

const COMPRESSION_CONFIG = {
  // Minimum size to compress (bytes)
  minSize: 1024, // 1KB

  // Compression level (0-11 for Brotli, 0-9 for Gzip)
  brotliLevel: 4, // Balance between speed and compression
  gzipLevel: 6,

  // Content types to compress
  compressibleTypes: [
    'application/json',
    'application/javascript',
    'application/xml',
    'text/html',
    'text/css',
    'text/plain',
    'text/javascript',
    'text/xml',
    'image/svg+xml',
  ],
}

// ========================
// COMPRESSION UTILITIES
// ========================

export interface CompressionResult {
  data: Buffer
  encoding: 'br' | 'gzip' | 'identity'
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

/**
 * Compress data using best available algorithm
 */
export async function compressData(
  data: string | Buffer,
  acceptEncoding?: string
): Promise<CompressionResult> {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data
  const originalSize = buffer.length

  // Don't compress small payloads
  if (originalSize < COMPRESSION_CONFIG.minSize) {
    return {
      data: buffer,
      encoding: 'identity',
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    }
  }

  const acceptedEncodings = acceptEncoding?.toLowerCase() || ''

  try {
    // Prefer Brotli (better compression)
    if (acceptedEncodings.includes('br')) {
      const compressed = await brotliCompress(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: COMPRESSION_CONFIG.brotliLevel,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      })

      return {
        data: compressed,
        encoding: 'br',
        originalSize,
        compressedSize: compressed.length,
        compressionRatio: originalSize / compressed.length,
      }
    }

    // Fallback to Gzip
    if (acceptedEncodings.includes('gzip')) {
      const compressed = await gzipCompress(buffer, {
        level: COMPRESSION_CONFIG.gzipLevel,
      })

      return {
        data: compressed,
        encoding: 'gzip',
        originalSize,
        compressedSize: compressed.length,
        compressionRatio: originalSize / compressed.length,
      }
    }

    // No compression
    return {
      data: buffer,
      encoding: 'identity',
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    }
  } catch (error) {
    logger.error('Compression failed', { error, originalSize })
    return {
      data: buffer,
      encoding: 'identity',
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    }
  }
}

/**
 * Check if content type should be compressed
 */
export function shouldCompress(contentType?: string): boolean {
  if (!contentType) return false

  return COMPRESSION_CONFIG.compressibleTypes.some((type) =>
    contentType.toLowerCase().includes(type)
  )
}

/**
 * Compress API response
 */
export async function compressResponse(
  data: any,
  acceptEncoding?: string,
  contentType = 'application/json'
): Promise<{
  body: Buffer
  headers: Record<string, string>
  stats: CompressionResult
}> {
  // Serialize data if object
  const serialized = typeof data === 'string' ? data : JSON.stringify(data)

  // Check if should compress
  if (!shouldCompress(contentType)) {
    const buffer = Buffer.from(serialized)
    return {
      body: buffer,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
      },
      stats: {
        data: buffer,
        encoding: 'identity',
        originalSize: buffer.length,
        compressedSize: buffer.length,
        compressionRatio: 1,
      },
    }
  }

  // Compress data
  const result = await compressData(serialized, acceptEncoding)

  logger.debug('Response compressed', {
    encoding: result.encoding,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    ratio: result.compressionRatio.toFixed(2),
  })

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': result.compressedSize.toString(),
    'X-Original-Size': result.originalSize.toString(),
    'X-Compression-Ratio': result.compressionRatio.toFixed(2),
  }

  if (result.encoding !== 'identity') {
    headers['Content-Encoding'] = result.encoding
    headers['Vary'] = 'Accept-Encoding'
  }

  return {
    body: result.data,
    headers,
    stats: result,
  }
}

/**
 * Create compressed NextResponse
 */
export async function createCompressedResponse(
  data: any,
  acceptEncoding?: string,
  options?: {
    status?: number
    statusText?: string
    headers?: Record<string, string>
  }
): Promise<NextResponse> {
  const compressed = await compressResponse(data, acceptEncoding)

  return new NextResponse(new Uint8Array(compressed.body), {
    status: options?.status || 200,
    statusText: options?.statusText,
    headers: {
      ...compressed.headers,
      ...options?.headers,
    },
  })
}

// ========================
// PAYLOAD OPTIMIZATION
// ========================

/**
 * Optimize JSON payload by removing null/undefined values
 */
export function optimizePayload<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(optimizePayload) as T
  }

  if (data !== null && typeof data === 'object') {
    const optimized: any = {}

    for (const [key, value] of Object.entries(data)) {
      // Skip null, undefined, empty strings
      if (value !== null && value !== undefined && value !== '') {
        optimized[key] = optimizePayload(value)
      }
    }

    return optimized as T
  }

  return data
}

/**
 * Paginate large responses
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function paginateResponse<T>(
  data: T[],
  page: number,
  limit: number
): PaginatedResponse<T> {
  const total = data.length
  const pages = Math.ceil(total / limit)
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit

  return {
    data: data.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  }
}

/**
 * Field selection - Return only requested fields
 */
export function selectFields<T extends object>(
  data: T | T[],
  fields?: string[]
): Partial<T> | Partial<T>[] {
  if (!fields || fields.length === 0) {
    return data
  }

  const select = (item: T): Partial<T> => {
    const selected: any = {}
    for (const field of fields) {
      if (field in item) {
        selected[field] = (item as any)[field]
      }
    }
    return selected
  }

  return Array.isArray(data) ? data.map(select) : select(data)
}

/**
 * Compress large text fields
 */
export async function compressTextField(text: string): Promise<string> {
  if (text.length < 1000) return text

  try {
    const compressed = await brotliCompress(Buffer.from(text))
    return compressed.toString('base64')
  } catch (error) {
    logger.error('Text compression failed', { error })
    return text
  }
}

/**
 * Decompress text field
 */
export async function decompressTextField(compressed: string): Promise<string> {
  try {
    const buffer = Buffer.from(compressed, 'base64')
    const decompressed = await promisify(zlib.brotliDecompress)(buffer)
    return decompressed.toString()
  } catch (error) {
    logger.error('Text decompression failed', { error })
    return compressed
  }
}

// ========================
// STREAMING COMPRESSION
// ========================

/**
 * Create compressed stream
 */
export function createCompressedStream(
  acceptEncoding?: string
): zlib.BrotliCompress | zlib.Gzip | null {
  const acceptedEncodings = acceptEncoding?.toLowerCase() || ''

  if (acceptedEncodings.includes('br')) {
    return zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: COMPRESSION_CONFIG.brotliLevel,
      },
    })
  }

  if (acceptedEncodings.includes('gzip')) {
    return zlib.createGzip({
      level: COMPRESSION_CONFIG.gzipLevel,
    })
  }

  return null
}

/**
 * Stream large data with compression
 */
export async function streamCompressedData(
  stream: NodeJS.ReadableStream,
  acceptEncoding?: string
): Promise<NodeJS.ReadableStream> {
  const compressionStream = createCompressedStream(acceptEncoding)

  if (!compressionStream) {
    return stream
  }

  return stream.pipe(compressionStream)
}

// ========================
// EXPORTS
// ========================

export default {
  compressData,
  compressResponse,
  createCompressedResponse,
  shouldCompress,
  optimizePayload,
  paginateResponse,
  selectFields,
  compressTextField,
  decompressTextField,
  createCompressedStream,
  streamCompressedData,
}
