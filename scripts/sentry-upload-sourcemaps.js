#!/usr/bin/env node

/**
 * Sentry Source Maps Upload Script
 *
 * This script automatically uploads source maps to Sentry after a production build.
 * It runs as a postbuild step and handles:
 * - Release creation
 * - Source map upload
 * - Commit association
 * - Release finalization
 *
 * Environment Variables Required:
 * - SENTRY_AUTH_TOKEN: Authentication token for Sentry API
 * - SENTRY_ORG: Organization slug
 * - SENTRY_PROJECT: Project slug
 * - SENTRY_UPLOAD_SOURCEMAPS: Set to 'true' to enable upload
 * - SENTRY_RELEASE: (Optional) Release identifier, defaults to git SHA
 * - SENTRY_ENVIRONMENT: (Optional) Environment name, defaults to 'production'
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for pretty console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper function for colored output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if we're in a CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' || process.env.VERCEL === '1';

// Get configuration from environment variables
const config = {
  shouldUpload: process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  sentryUrl: process.env.SENTRY_URL || 'https://sentry.io',
};

// Get release identifier (git SHA or custom)
function getRelease() {
  if (process.env.SENTRY_RELEASE) {
    return process.env.SENTRY_RELEASE;
  }

  try {
    // Try to get git commit SHA
    const gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return gitSha;
  } catch (error) {
    // Fallback to timestamp if git is not available
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    log('⚠️  Git not available, using timestamp as release identifier', 'yellow');
    return `release-${timestamp}`;
  }
}

config.release = getRelease();

// Validate configuration
function validateConfig() {
  log('\n🔍 Validating Sentry configuration...', 'cyan');

  if (!config.shouldUpload) {
    log('ℹ️  Source map upload is disabled (SENTRY_UPLOAD_SOURCEMAPS != true)', 'yellow');
    log('   Set SENTRY_UPLOAD_SOURCEMAPS=true to enable upload\n', 'yellow');
    return false;
  }

  const missing = [];
  if (!config.authToken) missing.push('SENTRY_AUTH_TOKEN');
  if (!config.org) missing.push('SENTRY_ORG');
  if (!config.project) missing.push('SENTRY_PROJECT');

  if (missing.length > 0) {
    log('❌ Missing required environment variables:', 'red');
    missing.forEach(variable => log(`   - ${variable}`, 'red'));
    log('\n   Please configure these variables in your .env file or CI/CD settings\n', 'yellow');
    return false;
  }

  // Check if .next directory exists
  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    log('❌ Build directory (.next) not found', 'red');
    log('   Please run "npm run build" first\n', 'yellow');
    return false;
  }

  // Check for source maps
  const sourceMapCount = countSourceMaps(nextDir);
  if (sourceMapCount === 0) {
    log('⚠️  No source maps found in .next directory', 'yellow');
    log('   Make sure productionBrowserSourceMaps is enabled in next.config.js\n', 'yellow');
  } else {
    log(`✅ Found ${sourceMapCount} source map(s)`, 'green');
  }

  return true;
}

// Count source maps in directory
function countSourceMaps(dir) {
  let count = 0;

  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);
    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.map')) {
        count++;
      }
    });
  }

  traverse(dir);
  return count;
}

// Execute shell command with error handling
function execute(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || '',
    };
  }
}

// Check if Sentry CLI is installed
function checkSentryCLI() {
  const result = execute('sentry-cli --version', { silent: true });
  if (!result.success) {
    log('❌ Sentry CLI is not installed', 'red');
    log('   Install it with: npm install -g @sentry/cli\n', 'yellow');
    return false;
  }
  log(`✅ Sentry CLI installed: ${result.output.trim()}`, 'green');
  return true;
}

// Main upload process
async function uploadSourceMaps() {
  log('\n' + '='.repeat(60), 'cyan');
  log('  🚀 Sentry Source Maps Upload', 'bright');
  log('='.repeat(60) + '\n', 'cyan');

  // Display configuration
  log('📋 Configuration:', 'cyan');
  log(`   Organization: ${config.org}`, 'blue');
  log(`   Project:      ${config.project}`, 'blue');
  log(`   Release:      ${config.release}`, 'blue');
  log(`   Environment:  ${config.environment}`, 'blue');
  log(`   Sentry URL:   ${config.sentryUrl}`, 'blue');
  log('');

  // Step 1: Check Sentry CLI
  if (!checkSentryCLI()) {
    process.exit(0);
  }

  // Step 2: Validate configuration
  if (!validateConfig()) {
    if (isCI) {
      log('⚠️  Skipping source map upload in CI due to missing configuration', 'yellow');
      process.exit(0);
    }
    process.exit(0);
  }

  log('\n📦 Starting upload process...\n', 'cyan');

  // Step 3: Create release
  log('1️⃣  Creating release...', 'cyan');
  const createReleaseCmd = `sentry-cli releases new ${config.release} --org ${config.org} --project ${config.project}`;
  const createResult = execute(createReleaseCmd);

  if (!createResult.success) {
    // Check if release already exists
    if (createResult.output.includes('already exists')) {
      log(`   ℹ️  Release ${config.release} already exists, using existing release`, 'yellow');
    } else {
      log('   ❌ Failed to create release', 'red');
      log(`   ${createResult.error}\n`, 'red');
      process.exit(0);
    }
  } else {
    log(`   ✅ Release ${config.release} created`, 'green');
  }

  // Step 4: Upload source maps
  log('\n2️⃣  Uploading source maps...', 'cyan');

  // Upload client-side source maps
  log('   📤 Uploading client source maps...', 'blue');
  const uploadClientCmd = `sentry-cli sourcemaps upload --org ${config.org} --project ${config.project} --release ${config.release} --url-prefix ~/_next/static/ .next/static`;
  const uploadClientResult = execute(uploadClientCmd);

  if (!uploadClientResult.success) {
    log('   ⚠️  Client source maps upload failed (non-critical)', 'yellow');
  } else {
    log('   ✅ Client source maps uploaded', 'green');
  }

  // Upload server-side source maps (if they exist)
  const serverDir = path.join(process.cwd(), '.next', 'server');
  if (fs.existsSync(serverDir)) {
    log('   📤 Uploading server source maps...', 'blue');
    const uploadServerCmd = `sentry-cli sourcemaps upload --org ${config.org} --project ${config.project} --release ${config.release} --url-prefix ~/_next/server/ .next/server`;
    const uploadServerResult = execute(uploadServerCmd);

    if (!uploadServerResult.success) {
      log('   ⚠️  Server source maps upload failed (non-critical)', 'yellow');
    } else {
      log('   ✅ Server source maps uploaded', 'green');
    }
  }

  // Step 5: Associate commits (if in git repository)
  log('\n3️⃣  Associating commits...', 'cyan');
  const setCommitsCmd = `sentry-cli releases set-commits ${config.release} --auto --org ${config.org} --project ${config.project}`;
  const commitsResult = execute(setCommitsCmd);

  if (!commitsResult.success) {
    if (commitsResult.output.includes('not a git repository')) {
      log('   ℹ️  Not a git repository, skipping commit association', 'yellow');
    } else {
      log('   ⚠️  Failed to associate commits (non-critical)', 'yellow');
    }
  } else {
    log('   ✅ Commits associated', 'green');
  }

  // Step 6: Set deployment environment
  log('\n4️⃣  Setting deployment environment...', 'cyan');
  const deployCmd = `sentry-cli releases deploys ${config.release} new --env ${config.environment} --org ${config.org} --project ${config.project}`;
  const deployResult = execute(deployCmd);

  if (!deployResult.success) {
    log('   ⚠️  Failed to set deployment (non-critical)', 'yellow');
  } else {
    log(`   ✅ Deployment environment set to ${config.environment}`, 'green');
  }

  // Step 7: Finalize release
  log('\n5️⃣  Finalizing release...', 'cyan');
  const finalizeCmd = `sentry-cli releases finalize ${config.release} --org ${config.org} --project ${config.project}`;
  const finalizeResult = execute(finalizeCmd);

  if (!finalizeResult.success) {
    log('   ❌ Failed to finalize release', 'red');
    log(`   ${finalizeResult.error}\n`, 'red');
    process.exit(0);
  } else {
    log('   ✅ Release finalized', 'green');
  }

  // Success summary
  log('\n' + '='.repeat(60), 'green');
  log('  ✅ Source Maps Upload Complete!', 'bright');
  log('='.repeat(60), 'green');
  log('');
  log(`🎯 Release ${config.release} is now live in Sentry`, 'green');
  log(`📊 View in dashboard: ${config.sentryUrl}/organizations/${config.org}/releases/${config.release}/`, 'cyan');
  log('');
}

// Run the script — never fail the build
uploadSourceMaps().catch(error => {
  log('\n⚠️  Source map upload failed (non-blocking):', 'yellow');
  log(error.message, 'yellow');
  log('');
  process.exit(0);
});
