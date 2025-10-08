#!/usr/bin/env node
/**
 * Script to replace console.log/error/warn statements with proper logger calls
 */

const fs = require('fs');
const path = require('path');

// Files to process
const filesToProcess = [
  // lib/auth
  'lib/auth/rbac.ts',
  'lib/auth/api-protection.ts',
  'lib/auth/sso.ts',
  'lib/auth/enterprise-auth.ts',
  'lib/auth/password-policies.ts',
  'lib/auth/sso-manager.ts',
  'lib/auth/rbac-engine.ts',
  'lib/auth/biometric-auth.ts',
  'lib/auth/dynamic-permissions.ts',
  'lib/auth/session-manager.ts',
  'lib/auth/index.ts',
  'lib/auth/data-row-security.ts',
  'lib/auth/mfa-manager.ts',

  // app/api/auth
  'app/api/auth/logout/route.ts',
  'app/api/auth/register/route.ts',
  'app/api/auth/test/route.ts',
  'app/api/auth/sso/[provider]/logout/route.ts',
  'app/api/auth/sso/[provider]/callback/route.ts',
  'app/api/auth/change-password/route.ts',
  'app/api/auth/sso/[provider]/route.ts',
  'app/api/auth/sso/providers/route.ts',
  'app/api/auth/verify/route.ts',
  'app/api/auth/govbr/authorize/route.ts',
  'app/api/auth/profile/route.ts',
  'app/api/auth/govbr/callback/route.ts',
];

const projectRoot = process.cwd();
let totalReplacements = 0;
let filesModified = 0;

filesToProcess.forEach(filePath => {
  const fullPath = path.join(projectRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Check if logger is already imported
  const hasLoggerImport = content.includes("import { logger }") || content.includes("import logger");
  const hasMonitoringImport = content.includes("from '../monitoring/logger'") ||
                               content.includes("from '../../lib/monitoring/logger'") ||
                               content.includes("from '@/lib/monitoring/logger'");

  // Add logger import if needed
  if (!hasLoggerImport && !hasMonitoringImport) {
    // Determine correct import path based on file location
    let importPath = '../monitoring/logger';
    if (filePath.startsWith('app/api/auth/')) {
      importPath = '@/lib/monitoring/logger';
    }

    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
      if (lines[i].trim() && !lines[i].trim().startsWith('import ') && !lines[i].trim().startsWith('//') && lastImportIndex !== -1) {
        break;
      }
    }

    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, `import { logger } from '${importPath}';`);
      content = lines.join('\n');
    }
  }

  let fileReplacements = 0;

  // Replace console.error
  const errorMatches = content.match(/console\.error\(/g);
  if (errorMatches) {
    fileReplacements += errorMatches.length;
  }
  content = content.replace(/console\.error\(/g, 'logger.error(');

  // Replace console.log (but keep in development environments if needed)
  const logMatches = content.match(/console\.log\(/g);
  if (logMatches) {
    fileReplacements += logMatches.length;
  }
  content = content.replace(/console\.log\(/g, 'logger.info(');

  // Replace console.warn
  const warnMatches = content.match(/console\.warn\(/g);
  if (warnMatches) {
    fileReplacements += warnMatches.length;
  }
  content = content.replace(/console\.warn\(/g, 'logger.warn(');

  // Replace console.info
  const infoMatches = content.match(/console\.info\(/g);
  if (infoMatches) {
    fileReplacements += infoMatches.length;
  }
  content = content.replace(/console\.info\(/g, 'logger.info(');

  // Remove colons from logger messages (console.error('Error:', error) -> logger.error('Error', error))
  content = content.replace(/logger\.(error|warn|info|debug)\('([^']+):'/g, "logger.$1('$2'");
  content = content.replace(/logger\.(error|warn|info|debug)\("([^"]+):"/g, 'logger.$1("$2"');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    filesModified++;
    totalReplacements += fileReplacements;
    console.log(`✅ ${filePath}: ${fileReplacements} replacements`);
  } else {
    console.log(`⏭️  ${filePath}: No changes needed`);
  }
});

console.log('\n📊 Summary:');
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);
