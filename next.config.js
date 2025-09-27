/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 13+

  // Handle the workspace root warning
  outputFileTracingRoot: "/home/nic20/ProjetosWeb/ServiceDesk",

  // Force dynamic rendering for all pages
  output: 'standalone',

  // Configure headers for fonts and CSP
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://r2cdn.perplexity.ai data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
          },
        ],
      },
    ]
  },


  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },
}

module.exports = nextConfig
