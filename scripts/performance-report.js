/**
 * Performance Report Generator
 * Analyzes bundle size and generates performance report
 */

const fs = require('fs')
const path = require('path')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get bundle size from .next directory
 */
function getBundleSize() {
  const nextDir = path.join(process.cwd(), '.next')

  if (!fs.existsSync(nextDir)) {
    console.error(`${colors.red}Error: .next directory not found. Run 'npm run build' first.${colors.reset}`)
    process.exit(1)
  }

  // Read build manifest
  const buildManifestPath = path.join(nextDir, 'build-manifest.json')
  if (!fs.existsSync(buildManifestPath)) {
    console.error(`${colors.red}Error: build-manifest.json not found.${colors.reset}`)
    process.exit(1)
  }

  const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'))

  // Analyze bundle sizes
  const bundles = {}
  let totalSize = 0

  // Get client chunks
  const staticDir = path.join(nextDir, 'static', 'chunks')
  if (fs.existsSync(staticDir)) {
    const chunks = fs.readdirSync(staticDir)
    chunks.forEach(chunk => {
      if (chunk.endsWith('.js')) {
        const filePath = path.join(staticDir, chunk)
        const stats = fs.statSync(filePath)
        bundles[chunk] = stats.size
        totalSize += stats.size
      }
    })
  }

  return { bundles, totalSize }
}

/**
 * Analyze bundle and show warnings
 */
function analyzeBundle(bundles, totalSize) {
  const warnings = []
  const suggestions = []

  // Check total bundle size
  const totalMB = totalSize / (1024 * 1024)
  if (totalMB > 2) {
    warnings.push(`Total bundle size is ${formatBytes(totalSize)} (> 2MB)`)
    suggestions.push('Consider code splitting and lazy loading for large components')
  }

  // Check individual chunk sizes
  Object.entries(bundles).forEach(([name, size]) => {
    const sizeMB = size / (1024 * 1024)
    if (sizeMB > 0.5) {
      warnings.push(`Large chunk detected: ${name} (${formatBytes(size)})`)
      suggestions.push(`Consider splitting ${name} into smaller chunks`)
    }
  })

  return { warnings, suggestions }
}

/**
 * Generate performance report
 */
function generateReport() {
  console.log(`\n${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.bold}${colors.blue}   PERFORMANCE REPORT${colors.reset}`)
  console.log(`${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)

  // Get bundle size
  const { bundles, totalSize } = getBundleSize()

  // Show summary
  console.log(`${colors.bold}Bundle Summary:${colors.reset}`)
  console.log(`  Total Size: ${colors.bold}${formatBytes(totalSize)}${colors.reset}`)
  console.log(`  Total Chunks: ${colors.bold}${Object.keys(bundles).length}${colors.reset}\n`)

  // Show top 10 largest chunks
  const sortedBundles = Object.entries(bundles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  console.log(`${colors.bold}Top 10 Largest Chunks:${colors.reset}`)
  sortedBundles.forEach(([name, size], index) => {
    const sizeColor = size > 500000 ? colors.red : size > 200000 ? colors.yellow : colors.green
    console.log(`  ${index + 1}. ${name}`)
    console.log(`     ${sizeColor}${formatBytes(size)}${colors.reset}`)
  })

  // Analyze and show warnings
  const { warnings, suggestions } = analyzeBundle(bundles, totalSize)

  if (warnings.length > 0) {
    console.log(`\n${colors.bold}${colors.yellow}⚠ Warnings:${colors.reset}`)
    warnings.forEach(warning => {
      console.log(`  ${colors.yellow}•${colors.reset} ${warning}`)
    })
  }

  if (suggestions.length > 0) {
    console.log(`\n${colors.bold}${colors.blue}💡 Suggestions:${colors.reset}`)
    suggestions.forEach(suggestion => {
      console.log(`  ${colors.blue}•${colors.reset} ${suggestion}`)
    })
  }

  // Performance recommendations
  console.log(`\n${colors.bold}Performance Recommendations:${colors.reset}`)
  console.log(`  ${colors.green}✓${colors.reset} Use dynamic imports for heavy components (Charts, Editors)`)
  console.log(`  ${colors.green}✓${colors.reset} Implement lazy loading for below-the-fold content`)
  console.log(`  ${colors.green}✓${colors.reset} Enable compression (gzip/brotli) on server`)
  console.log(`  ${colors.green}✓${colors.reset} Use Next.js Image component for image optimization`)
  console.log(`  ${colors.green}✓${colors.reset} Implement code splitting with route-based chunks`)

  // Web Vitals targets
  console.log(`\n${colors.bold}Web Vitals Targets:${colors.reset}`)
  console.log(`  LCP (Largest Contentful Paint): ${colors.green}< 2.5s${colors.reset}`)
  console.log(`  FID (First Input Delay):         ${colors.green}< 100ms${colors.reset}`)
  console.log(`  CLS (Cumulative Layout Shift):   ${colors.green}< 0.1${colors.reset}`)
  console.log(`  TTFB (Time to First Byte):       ${colors.green}< 600ms${colors.reset}`)
  console.log(`  FCP (First Contentful Paint):    ${colors.green}< 1.8s${colors.reset}`)

  // Next steps
  console.log(`\n${colors.bold}Next Steps:${colors.reset}`)
  console.log(`  1. Run ${colors.blue}npm run build:analyze${colors.reset} for detailed bundle analysis`)
  console.log(`  2. Run ${colors.blue}npm run lighthouse${colors.reset} for Lighthouse audit`)
  console.log(`  3. Monitor Web Vitals in production with analytics`)

  console.log(`\n${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)

  // Write JSON report
  const reportPath = path.join(process.cwd(), 'reports', 'performance-report.json')
  const report = {
    timestamp: new Date().toISOString(),
    totalSize: totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    totalChunks: Object.keys(bundles).length,
    largestChunks: sortedBundles.map(([name, size]) => ({
      name,
      size,
      sizeFormatted: formatBytes(size),
    })),
    warnings,
    suggestions,
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`${colors.green}✓${colors.reset} Report saved to: ${reportPath}\n`)
}

// Run report
try {
  generateReport()
} catch (error) {
  console.error(`${colors.red}Error generating report:${colors.reset}`, error.message)
  process.exit(1)
}
