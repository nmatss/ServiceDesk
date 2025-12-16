/**
 * API Versioning Strategy
 * Enterprise-grade API versioning with backward compatibility
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiContext, ApiVersion } from './types'

// Version Configuration
interface VersionConfig {
  version: string
  deprecated: boolean
  deprecationDate?: Date
  supportEndDate?: Date
  changes: string[]
  breakingChanges?: string[]
  compatibilityLayer?: boolean
  migrations?: Record<string, any>
}

// Version Registry
export class VersionRegistry {
  private versions: Map<string, VersionConfig> = new Map()
  private currentVersion: string = 'v1'
  private defaultVersion: string = 'v1'

  constructor() {
    this.initializeVersions()
  }

  private initializeVersions(): void {
    // Version 1.0 - Initial release
    this.registerVersion({
      version: 'v1',
      deprecated: false,
      changes: [
        'Initial API release',
        'Basic CRUD operations for tickets',
        'User authentication and authorization',
        'File upload support',
        'Knowledge base operations',
      ],
    })

    // Version 1.1 - Enhanced features (future)
    this.registerVersion({
      version: 'v1.1',
      deprecated: false,
      changes: [
        'Enhanced ticket filtering',
        'Bulk operations support',
        'Improved search functionality',
        'Advanced analytics endpoints',
      ],
    })

    // Version 2.0 - Major revision (future)
    this.registerVersion({
      version: 'v2',
      deprecated: false,
      changes: [
        'Redesigned response format',
        'GraphQL support',
        'Real-time subscriptions',
        'Enhanced webhook system',
      ],
      breakingChanges: [
        'Response format changed',
        'Some endpoints removed',
        'Authentication method updated',
      ],
    })
  }

  registerVersion(config: VersionConfig): void {
    this.versions.set(config.version, config)

    // Update current version if this is newer
    if (this.isNewerVersion(config.version, this.currentVersion)) {
      this.currentVersion = config.version
    }
  }

  getVersion(version: string): VersionConfig | null {
    return this.versions.get(version) || null
  }

  getAllVersions(): VersionConfig[] {
    return Array.from(this.versions.values())
  }

  getCurrentVersion(): string {
    return this.currentVersion
  }

  getDefaultVersion(): string {
    return this.defaultVersion
  }

  setDefaultVersion(version: string): void {
    if (this.versions.has(version)) {
      this.defaultVersion = version
    }
  }

  isVersionSupported(version: string): boolean {
    const config = this.versions.get(version)
    if (!config) return false

    // Check if version is past its support end date
    if (config.supportEndDate && new Date() > config.supportEndDate) {
      return false
    }

    return true
  }

  isVersionDeprecated(version: string): boolean {
    const config = this.versions.get(version)
    return config?.deprecated || false
  }

  private isNewerVersion(version1: string, version2: string): boolean {
    const v1Parts = version1.replace('v', '').split('.').map(Number)
    const v2Parts = version2.replace('v', '').split('.').map(Number)

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0

      if (v1Part > v2Part) return true
      if (v1Part < v2Part) return false
    }

    return false
  }
}

// Version Detection
export class VersionDetector {
  private registry: VersionRegistry

  constructor(registry: VersionRegistry) {
    this.registry = registry
  }

  // Extract version from request
  detectVersion(req: NextRequest): string {
    // Method 1: Header-based versioning (preferred)
    const headerVersion = req.headers.get('X-API-Version') || req.headers.get('Accept-Version')
    if (headerVersion && this.registry.isVersionSupported(headerVersion)) {
      return headerVersion
    }

    // Method 2: URL path versioning
    const pathMatch = req.nextUrl.pathname.match(/^\/api\/(v\d+(?:\.\d+)?)\//)
    if (pathMatch) {
      const pathVersion = pathMatch[1]
      if (pathVersion && this.registry.isVersionSupported(pathVersion)) {
        return pathVersion
      }
    }

    // Method 3: Query parameter versioning
    const queryVersion = req.nextUrl.searchParams.get('version')
    if (queryVersion && this.registry.isVersionSupported(queryVersion)) {
      return queryVersion
    }

    // Method 4: Content-Type versioning
    const contentType = req.headers.get('content-type')
    if (contentType) {
      const versionMatch = contentType.match(/application\/vnd\.servicedesk\.(v\d+(?:\.\d+)?)\+json/)
      if (versionMatch) {
        const ctVersion = versionMatch[1]
        if (ctVersion && this.registry.isVersionSupported(ctVersion)) {
          return ctVersion
        }
      }
    }

    // Default to latest supported version
    return this.registry.getDefaultVersion()
  }

  // Validate version compatibility
  validateVersion(version: string): { valid: boolean; deprecated: boolean; message?: string } {
    if (!this.registry.isVersionSupported(version)) {
      return {
        valid: false,
        deprecated: false,
        message: `API version ${version} is not supported`,
      }
    }

    const deprecated = this.registry.isVersionDeprecated(version)
    const config = this.registry.getVersion(version)

    return {
      valid: true,
      deprecated,
      message: deprecated
        ? `API version ${version} is deprecated. Please migrate to version ${this.registry.getCurrentVersion()}.`
        : undefined,
    }
  }
}

// Version Middleware
export class VersionMiddleware {
  private registry: VersionRegistry
  private detector: VersionDetector

  constructor() {
    this.registry = new VersionRegistry()
    this.detector = new VersionDetector(this.registry)
  }

  async handle(req: NextRequest, context: ApiContext): Promise<NextResponse | null> {
    const version = this.detector.detectVersion(req)
    const validation = this.detector.validateVersion(version)

    // Add version to context
    context.version = version

    // Check if version is supported
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_API_VERSION',
            message: validation.message || 'Unsupported API version',
            details: {
              requestedVersion: version,
              supportedVersions: this.registry.getAllVersions().map(v => v.version),
              currentVersion: this.registry.getCurrentVersion(),
            },
            timestamp: new Date().toISOString(),
            path: req.nextUrl.pathname,
            requestId: context.requestId,
          },
        },
        {
          status: 400,
          headers: {
            'X-API-Version': this.registry.getCurrentVersion(),
            'X-Supported-Versions': this.registry.getAllVersions().map(v => v.version).join(', '),
          },
        }
      )
    }

    // Add deprecation warning if needed
    if (validation.deprecated) {
      const response = NextResponse.next()
      response.headers.set('X-API-Deprecated', 'true')
      response.headers.set('X-API-Deprecation-Message', validation.message || '')
      response.headers.set('Sunset', this.getDeprecationDate(version) || '')
      return null // Continue to next middleware
    }

    return null // Continue to next middleware
  }

  getVersionInfo(): ApiVersion[] {
    return this.registry.getAllVersions().map(config => ({
      version: config.version,
      deprecated: config.deprecated,
      deprecationDate: config.deprecationDate?.toISOString(),
      supportEndDate: config.supportEndDate?.toISOString(),
      changes: config.changes,
    }))
  }

  private getDeprecationDate(version: string): string | undefined {
    const config = this.registry.getVersion(version)
    return config?.supportEndDate?.toISOString()
  }
}

// Response Transformers for Version Compatibility
export class ResponseTransformer {
  private transformers: Map<string, Map<string, (data: any) => any>> = new Map()

  constructor() {
    this.initializeTransformers()
  }

  private initializeTransformers(): void {
    // Example: Transform v1 response to v2 format
    this.addTransformer('v1', 'v2', (data) => {
      if (data.success !== undefined) {
        // v2 uses 'status' instead of 'success'
        return {
          status: data.success ? 'ok' : 'error',
          result: data.data,
          error: data.error,
          metadata: data.meta,
        }
      }
      return data
    })

    // Example: Transform v2 response to v1 format
    this.addTransformer('v2', 'v1', (data) => {
      if (data.status !== undefined) {
        // v1 uses 'success' instead of 'status'
        return {
          success: data.status === 'ok',
          data: data.result,
          error: data.error,
          meta: data.metadata,
        }
      }
      return data
    })
  }

  addTransformer(fromVersion: string, toVersion: string, transformer: (data: any) => any): void {
    if (!this.transformers.has(fromVersion)) {
      this.transformers.set(fromVersion, new Map())
    }
    this.transformers.get(fromVersion)!.set(toVersion, transformer)
  }

  transform(data: any, fromVersion: string, toVersion: string): any {
    const versionTransformers = this.transformers.get(fromVersion)
    if (!versionTransformers) return data

    const transformer = versionTransformers.get(toVersion)
    if (!transformer) return data

    return transformer(data)
  }

  hasTransformer(fromVersion: string, toVersion: string): boolean {
    const versionTransformers = this.transformers.get(fromVersion)
    return versionTransformers?.has(toVersion) || false
  }
}

// Version-aware response helper
export function createVersionedResponse(
  data: any,
  version: string,
  options: {
    status?: number
    headers?: Record<string, string>
    meta?: any
  } = {}
): NextResponse {
  const responseData = {
    success: true,
    data,
    meta: {
      version,
      timestamp: new Date().toISOString(),
      ...options.meta,
    },
  }

  const headers = {
    'X-API-Version': version,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  return NextResponse.json(responseData, {
    status: options.status || 200,
    headers,
  })
}

// Versioning utilities
export const versionUtils = {
  // Parse version string
  parseVersion(version: string): { major: number; minor: number; patch: number } {
    const cleaned = version.replace('v', '')
    const parts = cleaned.split('.').map(Number)
    return {
      major: parts[0] || 1,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    }
  },

  // Compare versions
  compareVersions(v1: string, v2: string): number {
    const parsed1 = this.parseVersion(v1)
    const parsed2 = this.parseVersion(v2)

    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major
    }
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor
    }
    return parsed1.patch - parsed2.patch
  },

  // Check if version is compatible
  isCompatible(requiredVersion: string, availableVersion: string): boolean {
    const required = this.parseVersion(requiredVersion)
    const available = this.parseVersion(availableVersion)

    // Major version must match for compatibility
    if (required.major !== available.major) {
      return false
    }

    // Available version must be >= required version
    return this.compareVersions(availableVersion, requiredVersion) >= 0
  },

  // Get version from any source
  extractVersion(source: string): string | null {
    const versionRegex = /v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/
    const match = source.match(versionRegex)

    if (match) {
      const major = match[1]
      const minor = match[2] || '0'
      const patch = match[3] || '0'
      return `v${major}.${minor}.${patch}`
    }

    return null
  },
}

// Create middleware instance
export const versionMiddleware = new VersionMiddleware()
export const responseTransformer = new ResponseTransformer()

// API versioning decorator
export function withVersioning(supportedVersions?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (req: NextRequest, context?: ApiContext) {
      if (!context) {
        throw new Error('ApiContext is required for versioning')
      }

      // Check if specific versions are supported
      if (supportedVersions && !supportedVersions.includes(context.version)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNSUPPORTED_API_VERSION',
              message: `This endpoint does not support version ${context.version}`,
              details: {
                supportedVersions,
                requestedVersion: context.version,
              },
              timestamp: new Date().toISOString(),
              path: req.nextUrl.pathname,
              requestId: context.requestId,
            },
          },
          { status: 400 }
        )
      }

      // Call original method
      const response = await originalMethod.call(this, req, context)

      // Add version headers
      if (response instanceof NextResponse) {
        response.headers.set('X-API-Version', context.version)
      }

      return response
    }

    return descriptor
  }
}

export default {
  VersionRegistry,
  VersionDetector,
  VersionMiddleware,
  ResponseTransformer,
  versionMiddleware,
  responseTransformer,
  createVersionedResponse,
  versionUtils,
  withVersioning,
}