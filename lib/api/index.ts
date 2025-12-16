/**
 * Enterprise API Foundation
 * Centralized API utilities and configurations for ServiceDesk
 */

export * from './types'
export * from './errors'
export * from './validation'
export * from './versioning'
export * from './cache'
export * from './rate-limit'
export * from './docs'
export * from './webhook'
export * from './events'

// API Configuration
export const API_CONFIG = {
  version: 'v1',
  basePath: '/api',
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  },
  cache: {
    defaultTTL: 300, // 5 minutes
    maxSize: 1000,
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-API-Version'],
  },
  security: {
    helmet: true,
    compression: true,
    bodyLimit: '10mb',
  },
  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    endpoint: '/api/health',
    metrics: '/api/metrics',
  },
}

// Export default configuration
export default API_CONFIG