const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 13+

  // Handle the workspace root warning
  outputFileTracingRoot: path.join(__dirname),

  // Force dynamic rendering for all pages
  output: 'standalone',

  // TypeScript configuration
  typescript: {
    // TypeScript errors have been fixed - strict type checking is now enabled
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // ESLint warnings exist but don't block build
    ignoreDuringBuilds: true,
  },

  // ========================
  // IMAGE OPTIMIZATION
  // ========================
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ========================
  // COMPRESSION
  // ========================
  compress: true, // Enable gzip compression

  // ========================
  // CACHING & HEADERS
  // ========================
  async headers() {
    return [
      // Security & CSP headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://r2cdn.perplexity.ai data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // Static assets caching (1 year)
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Next.js static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Images caching (1 year)
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Fonts caching (1 year)
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ========================
      // API ROUTE CACHING
      // ========================
      // Knowledge Base API - 10 min cache (static content)
      {
        source: '/api/knowledge/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=600, stale-while-revalidate=300',
          },
        ],
      },
      // Catalog API - 10 min cache (static content)
      {
        source: '/api/catalog',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=600, stale-while-revalidate=300',
          },
        ],
      },
      // Analytics API - 5 min cache (semi-static)
      {
        source: '/api/analytics/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      // Dashboard API - 5 min cache (semi-static)
      {
        source: '/api/admin/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      // Static lookup APIs - 30 min cache (rarely changes)
      {
        source: '/api/statuses',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1800, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/api/priorities',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1800, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/api/categories',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1800, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/api/ticket-types/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1800, stale-while-revalidate=600',
          },
        ],
      },
      // Teams & Users - 5 min cache
      {
        source: '/api/teams',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/api/users',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      // CMDB - 5 min cache
      {
        source: '/api/cmdb',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      // Settings - 5 min cache
      {
        source: '/api/settings',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      // Workflows - 5 min cache
      {
        source: '/api/workflows/definitions',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      // Mutations - no cache (create, update, delete)
      {
        source: '/api/tickets/create',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/catalog/requests',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/problems/:id/activities',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/workflows/execute',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      // Authentication - no cache
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      // Real-time APIs - 30 sec cache
      {
        source: '/api/notifications',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=30, stale-while-revalidate=10',
          },
        ],
      },
    ]
  },

  // ========================
  // REDIRECTS & REWRITES
  // ========================
  async redirects() {
    return [
      // Add any redirects here
    ]
  },

  // ========================
  // WEBPACK OPTIMIZATION
  // ========================
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      // Configure source maps for Sentry
      config.devtool = 'hidden-source-map'
    }

    // Bundle analyzer (only when ANALYZE=true)
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
          openAnalyzer: true,
          generateStatsFile: true,
          statsFilename: isServer
            ? '../analyze/server-stats.json'
            : './analyze/client-stats.json',
        })
      )
    }

    return config
  },

  // ========================
  // DEV INDICATORS
  // ========================
  devIndicators: {
    position: 'bottom-right',
  },

  // ========================
  // SERVER EXTERNAL PACKAGES
  // ========================
  // These packages use browser-only APIs (self, window, document)
  // and should NOT be bundled into server-side code
  serverExternalPackages: [
    'react-grid-layout',
    'react-resizable',
    'socket.io-client',
    'html2canvas',
    'jspdf',
    'jspdf-autotable',
    'xlsx',
    'd3',
  ],

  // ========================
  // EXPERIMENTAL FEATURES
  // ========================
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      '@headlessui/react',
    ],
    // Optimize CSS
    optimizeCss: true,
  },

  // ========================
  // PRODUCTION OPTIMIZATIONS
  // ========================
  poweredByHeader: false, // Remove X-Powered-By header
  reactStrictMode: true, // Enable React strict mode

  // ========================
  // SOURCE MAPS (For Sentry)
  // ========================
  // SECURITY: Source maps are generated but NOT served publicly
  // They are uploaded to Sentry for error tracking, then removed from public access
  productionBrowserSourceMaps: false, // Disabled - source maps hidden via hideSourceMaps below
}

// ========================
// SENTRY INTEGRATION
// ========================
const { withSentryConfig } = require('@sentry/nextjs')

// Sentry webpack plugin options
const sentryWebpackPluginOptions = {
  // Show logs in production for transparency during deployment
  silent: false,

  // Organization and project slugs from environment
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps to Sentry in production when auth token is available
  // This will be a dry run (no upload) if:
  // - Not in production environment
  // - SENTRY_AUTH_TOKEN is not set
  dryRun: process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,

  // Source map upload configuration
  widenClientFileUpload: true,  // Upload all client files for better stack traces
  hideSourceMaps: true,          // Remove source maps from public output (SECURITY)
  disableLogger: false,          // Enable logging to see upload status
}

// Bundle analyzer plugin
let finalConfig = nextConfig

if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: true,
  })
  finalConfig = withBundleAnalyzer(nextConfig)
}

// Wrap with Sentry config
// Only apply Sentry wrapper if DSN is configured
if (process.env.SENTRY_DSN) {
  module.exports = withSentryConfig(finalConfig, sentryWebpackPluginOptions)
} else {
  module.exports = finalConfig
}
