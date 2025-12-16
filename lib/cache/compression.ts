/**
 * Compression Utilities for Cache
 *
 * Provides compression/decompression for cache values using gzip or brotli.
 * Automatically selects best compression based on value size and type.
 */

import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync } from 'zlib';
import logger from '../monitoring/structured-logger';

export type CompressionAlgorithm = 'gzip' | 'brotli' | 'none';

export interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  level?: number; // 1-9 for gzip, 0-11 for brotli
  threshold?: number; // Minimum size to compress (bytes)
}

const COMPRESSION_MARKER = {
  gzip: 'GZIP:',
  brotli: 'BR:',
  none: '',
};

/**
 * Compress a string value
 */
export async function compress(
  value: string,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    algorithm = 'gzip',
    level,
    threshold = 1024, // 1KB default
  } = options;

  // Skip compression for small values
  if (value.length < threshold) {
    return value;
  }

  try {
    let compressed: Buffer;

    if (algorithm === 'gzip') {
      compressed = gzipSync(value, { level: level || 6 });
    } else if (algorithm === 'brotli') {
      compressed = brotliCompressSync(value, {
        params: {
          [require('zlib').constants.BROTLI_PARAM_QUALITY]: level || 4,
        },
      });
    } else {
      return value;
    }

    const compressedStr = compressed.toString('base64');
    const marker = COMPRESSION_MARKER[algorithm];

    // Only use compressed version if it's actually smaller
    if (compressedStr.length < value.length) {
      logger.debug('Compression applied', {
        algorithm,
        original: value.length,
        compressed: compressedStr.length,
        ratio: ((1 - compressedStr.length / value.length) * 100).toFixed(2) + '%',
      });

      return `${marker}${compressedStr}`;
    }

    logger.debug('Compression skipped (not beneficial)', {
      algorithm,
      original: value.length,
      compressed: compressedStr.length,
    });

    return value;
  } catch (error) {
    logger.error('Compression failed', error);
    return value; // Return original on error
  }
}

/**
 * Decompress a string value
 */
export async function decompress(value: string): Promise<string> {
  try {
    // Check compression marker
    let algorithm: CompressionAlgorithm = 'none';
    let compressedData = value;

    if (value.startsWith(COMPRESSION_MARKER.gzip)) {
      algorithm = 'gzip';
      compressedData = value.slice(COMPRESSION_MARKER.gzip.length);
    } else if (value.startsWith(COMPRESSION_MARKER.brotli)) {
      algorithm = 'brotli';
      compressedData = value.slice(COMPRESSION_MARKER.brotli.length);
    } else {
      // Not compressed
      return value;
    }

    const buffer = Buffer.from(compressedData, 'base64');
    let decompressed: Buffer;

    if (algorithm === 'gzip') {
      decompressed = gunzipSync(buffer);
    } else if (algorithm === 'brotli') {
      decompressed = brotliDecompressSync(buffer);
    } else {
      return value;
    }

    return decompressed.toString('utf-8');
  } catch (error) {
    logger.error('Decompression failed', error);
    throw new Error('Failed to decompress value');
  }
}

/**
 * Check if value is compressed
 */
export function isCompressed(value: string): boolean {
  return (
    value.startsWith(COMPRESSION_MARKER.gzip) ||
    value.startsWith(COMPRESSION_MARKER.brotli)
  );
}

/**
 * Get compression algorithm used
 */
export function getCompressionAlgorithm(value: string): CompressionAlgorithm {
  if (value.startsWith(COMPRESSION_MARKER.gzip)) {
    return 'gzip';
  } else if (value.startsWith(COMPRESSION_MARKER.brotli)) {
    return 'brotli';
  }
  return 'none';
}

/**
 * Estimate compression ratio (for testing/benchmarking)
 */
export async function estimateCompressionRatio(
  value: string,
  algorithm: CompressionAlgorithm = 'gzip'
): Promise<number> {
  const compressed = await compress(value, { algorithm });
  const compressedSize = isCompressed(compressed)
    ? compressed.length - COMPRESSION_MARKER[algorithm].length
    : compressed.length;

  return compressedSize / value.length;
}
