/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 13+

  // Handle the workspace root warning
  outputFileTracingRoot: "/home/nic20/ProjetosWeb/ServiceDesk",

  // Force dynamic rendering for all pages
  output: 'standalone',

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
      // API routes (no cache by default, controlled per route)
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
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

      // Enable production mode optimizations
      config.optimization = {
        ...config.optimization,
        minimize: true,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
            // UI components chunk
            ui: {
              name: 'ui',
              test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
              chunks: 'all',
              priority: 30,
            },
          },
        },
      }
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
        })
      )
    }

    return config
  },

  // ========================
  // EXPERIMENTAL FEATURES
  // ========================
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      '@headlessui/react',
      'recharts',
      'react-quill',
    ],
    // Optimize CSS
    optimizeCss: true,
    // Optimize fonts
    optimizeFonts: true,
    // Enable instrumentation for startup hooks
    instrumentationHook: false,
  },

  // ========================
  // POWER MODE (faster builds in dev)
  // ========================
  swcMinify: true, // Use SWC minifier (faster than Terser)

  // ========================
  // PRODUCTION OPTIMIZATIONS
  // ========================
  poweredByHeader: false, // Remove X-Powered-By header
  reactStrictMode: true, // Enable React strict mode

  // ========================
  // SOURCE MAPS (For Sentry)
  // ========================
  // Generate source maps in production for error tracking
  // These should be uploaded to Sentry and NOT served publicly
  productionBrowserSourceMaps: true, // Enable for Sentry error tracking
}

// ========================
// SENTRY INTEGRATION
// ========================
const { withSentryConfig } = require('@sentry/nextjs')

// Sentry webpack plugin options
const sentryWebpackPluginOptions = {
  // Suppress all Sentry CLI logs in development
  silent: process.env.NODE_ENV !== 'production',

  // Organization and project slugs from environment
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps when explicitly enabled
  // Set SENTRY_UPLOAD_SOURCEMAPS=true in production
  dryRun: process.env.SENTRY_UPLOAD_SOURCEMAPS !== 'true',

  // Disable automatic source map upload during build
  // We'll handle this manually in CI/CD
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
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
