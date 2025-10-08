#!/usr/bin/env node
/**
 * Extended script to replace console statements across the entire codebase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all TypeScript files with console statements
const getFilesWithConsoleLogs = () => {
  try {
    // Find all .ts and .tsx files with console. statements (excluding node_modules, .next, etc.)
    const output = execSync(
      `find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) \
       -not -path "*/node_modules/*" \
       -not -path "*/.next/*" \
       -not -path "*/dist/*" \
       -not -path "*/build/*" \
       -not -path "*/playwright-report/*" \
       -exec grep -l "console\\." {} \\;`,
      { encoding: 'utf8', cwd: process.cwd() }
    ).trim();

    return output ? output.split('\n').map(f => f.replace('./', '')) : [];
  } catch (error) {
    return [];
  }
};

const projectRoot = process.cwd();
let totalReplacements = 0;
let filesModified = 0;
const modifications = {};

// Excluded files (documentation, markdown, etc.)
const excludePatterns = [
  '.md',
  'cleanup-console-logs',
  'node_modules',
  '.next',
  'dist',
  'build',
  'playwright-report',
  'ADMIN_TEMPLATE.md',
  'ADMIN_STYLE_GUIDE.md',
  'servicedesk-',
  'compass_artifact',
  'prompt-',
  '.backup'
];

const shouldExclude = (filePath) => {
  return excludePatterns.some(pattern => filePath.includes(pattern));
};

const determineImportPath = (filePath) => {
  // Count directory depth
  const depth = filePath.split('/').length - 1;

  if (filePath.startsWith('app/')) {
    return '@/lib/monitoring/logger';
  } else if (filePath.startsWith('src/')) {
    return '@/lib/monitoring/logger';
  } else if (filePath.startsWith('lib/')) {
    // Calculate relative path from lib subdirectory
    const parts = filePath.split('/');
    if (parts[1] === 'monitoring') {
      return './logger'; // Same directory
    } else {
      return '../monitoring/logger';
    }
  } else if (filePath.startsWith('components/')) {
    return '@/lib/monitoring/logger';
  } else {
    // Default fallback
    return '@/lib/monitoring/logger';
  }
};

const processFile = (filePath) => {
  if (shouldExclude(filePath)) {
    return;
  }

  const fullPath = path.join(projectRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Skip if it's the logger itself
  if (filePath.includes('lib/monitoring/logger.ts')) {
    return;
  }

  // Check if logger is already imported
  const hasLoggerImport = content.includes("import { logger }") ||
                         content.includes("import logger from");
  const hasMonitoringImport = content.includes("from '../monitoring/logger'") ||
                              content.includes("from '../../lib/monitoring/logger'") ||
                              content.includes("from '@/lib/monitoring/logger'") ||
                              content.includes('from "./logger"') ||
                              content.includes("from './logger'");

  let fileReplacements = 0;

  // Count existing console statements
  const errorCount = (content.match(/console\.error\(/g) || []).length;
  const logCount = (content.match(/console\.log\(/g) || []).length;
  const warnCount = (content.match(/console\.warn\(/g) || []).length;
  const infoCount = (content.match(/console\.info\(/g) || []).length;
  const debugCount = (content.match(/console\.debug\(/g) || []).length;

  const totalConsole = errorCount + logCount + warnCount + infoCount + debugCount;

  if (totalConsole === 0) {
    return; // No console statements to replace
  }

  // Add logger import if needed
  if (!hasLoggerImport && !hasMonitoringImport) {
    const importPath = determineImportPath(filePath);

    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('export ') && trimmed.includes('from')) {
        lastImportIndex = i;
      }
      if (trimmed && !trimmed.startsWith('import ') && !trimmed.startsWith('export') &&
          !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') &&
          lastImportIndex !== -1) {
        break;
      }
    }

    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, `import { logger } from '${importPath}';`);
      content = lines.join('\n');
    } else {
      // No imports found, add at the top
      content = `import { logger } from '${importPath}';\n\n` + content;
    }
  }

  // Replace console statements
  fileReplacements += errorCount;
  content = content.replace(/console\.error\(/g, 'logger.error(');

  fileReplacements += logCount;
  content = content.replace(/console\.log\(/g, 'logger.info(');

  fileReplacements += warnCount;
  content = content.replace(/console\.warn\(/g, 'logger.warn(');

  fileReplacements += infoCount;
  content = content.replace(/console\.info\(/g, 'logger.info(');

  fileReplacements += debugCount;
  content = content.replace(/console\.debug\(/g, 'logger.debug(');

  // Remove colons from logger messages
  content = content.replace(/logger\.(error|warn|info|debug)\('([^']+):'/g, "logger.$1('$2'");
  content = content.replace(/logger\.(error|warn|info|debug)\("([^"]+):"/g, 'logger.$1("$2"');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    filesModified++;
    totalReplacements += fileReplacements;
    modifications[filePath] = {
      replacements: fileReplacements,
      breakdown: { errorCount, logCount, warnCount, infoCount, debugCount }
    };
    console.log(`✅ ${filePath}: ${fileReplacements} replacements`);
  }
};

// Main execution
console.log('🔍 Finding files with console statements...\n');
const filesToProcess = getFilesWithConsoleLogs();

if (filesToProcess.length === 0) {
  console.log('✨ No files with console statements found!');
  process.exit(0);
}

console.log(`Found ${filesToProcess.length} files to process\n`);

filesToProcess.forEach(processFile);

console.log('\n📊 Summary:');
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);

// Categorize by directory
const byDirectory = {};
Object.keys(modifications).forEach(filePath => {
  const dir = filePath.split('/')[0];
  if (!byDirectory[dir]) {
    byDirectory[dir] = { count: 0, replacements: 0 };
  }
  byDirectory[dir].count++;
  byDirectory[dir].replacements += modifications[filePath].replacements;
});

console.log('\n📁 By Directory:');
Object.keys(byDirectory).sort().forEach(dir => {
  console.log(`   ${dir}: ${byDirectory[dir].count} files, ${byDirectory[dir].replacements} replacements`);
});

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    filesModified,
    totalReplacements
  },
  byDirectory,
  modifications
};

fs.writeFileSync(
  path.join(projectRoot, 'console-cleanup-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: console-cleanup-report.json');
