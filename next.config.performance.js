/**
 * Next.js Performance Optimization Configuration
 *
 * Optimizations included:
 * - Bundle size reduction
 * - Code splitting
 * - Image optimization
 * - Caching strategies
 * - Compression
 */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const performanceConfig = {
  // ========================================
  // BUNDLE SIZE OPTIMIZATION
  // ========================================

  // Enable SWC minification (faster than Terser)
  swcMinify: true,

  // Optimize production bundle
  productionBrowserSourceMaps: false, // Disable source maps in production

  // Webpack optimization
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      // Enable tree shaking
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,

        // Split chunks for better caching
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk for node_modules
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate chunk for React/Next.js
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              name: 'react',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Separate chunk for UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@headlessui|@heroicons|framer-motion)[\\/]/,
              name: 'ui',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Separate chunk for charts
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
              name: 'charts',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Common chunks
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },

        // Minimize bundle size
        minimize: true,
      };

      // Analyze bundle size
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: isServer
              ? '../bundle-analyzer/server.html'
              : './bundle-analyzer/client.html',
            openAnalyzer: false,
          })
        );
      }
    }

    // Optimize imports
    config.resolve.alias = {
      ...config.resolve.alias,
      // Replace heavy date libraries with date-fns
      moment: 'date-fns',
      // Optimize lodash imports
      lodash: 'lodash-es',
    };

    return config;
  },

  // ========================================
  // COMPRESSION & CACHING
  // ========================================

  // Enable compression
  compress: true,

  // HTTP headers for caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache API responses with short TTL
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },

  // ========================================
  // IMAGE OPTIMIZATION
  // ========================================

  images: {
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],

    // Optimize images
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year

    // Image domains
    domains: [],

    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for next/image
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ========================================
  // EXPERIMENTAL FEATURES
  // ========================================

  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      '@heroicons/react',
      '@headlessui/react',
      'recharts',
      'lucide-react',
      'date-fns',
    ],

    // Enable Partial Prerendering
    ppr: false, // Enable when stable

    // Enable React Compiler
    reactCompiler: false, // Enable when stable

    // Optimize CSS
    optimizeCss: true,
  },

  // ========================================
  // OUTPUT OPTIMIZATION
  // ========================================

  // Output standalone build for deployment
  output: 'standalone',

  // Enable React strict mode
  reactStrictMode: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  // ========================================
  // COMPILER OPTIONS
  // ========================================

  compiler: {
    // Remove console.logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

module.exports = withBundleAnalyzer(performanceConfig);
