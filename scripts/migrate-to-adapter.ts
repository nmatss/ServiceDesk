#!/usr/bin/env npx tsx
/**
 * Migration Script: Convert API routes from direct SQLite access to adapter pattern
 *
 * This script automatically transforms API route files from:
 *   import db from '@/lib/db/connection'
 *   db.prepare(SQL).get(args)
 *
 * To:
 *   import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
 *   await executeQueryOne(SQL, [args])
 *
 * Usage: npx tsx scripts/migrate-to-adapter.ts
 *        npx tsx scripts/migrate-to-adapter.ts --dry-run   (preview only)
 *        npx tsx scripts/migrate-to-adapter.ts --no-backup (skip .bak files)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── CLI flags ───────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const NO_BACKUP = process.argv.includes('--no-backup');

// ─── Counters ────────────────────────────────────────────────────────────────
let filesScanned = 0;
let filesModified = 0;
let filesAlreadyMigrated = 0;
const modifiedFiles: string[] = [];
const skippedFiles: { file: string; reason: string }[] = [];
const errorFiles: { file: string; error: string }[] = [];

// ─── Find all .ts files under app/api/ ───────────────────────────────────────
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.spec.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Check if file imports from connection ───────────────────────────────────
function importsFromConnection(content: string): boolean {
  return /import\s+(?:\{[^}]*\}|[a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"](?:@\/lib\/db\/connection|\.\.?\/.*connection)['"];?/.test(content);
}

// ─── Check if file already uses adapter ──────────────────────────────────────
function alreadyUsesAdapter(content: string): boolean {
  return /from\s+['"]@\/lib\/db\/adapter['"]/.test(content);
}

// ─── Determine which adapter functions are needed ────────────────────────────
function determineNeededImports(content: string): string[] {
  const needed = new Set<string>();

  if (/\.get\s*\(/.test(content)) needed.add('executeQueryOne');
  if (/\.all\s*\(/.test(content)) needed.add('executeQuery');
  if (/\.run\s*\(/.test(content)) needed.add('executeRun');
  if (/\.exec\s*\(/.test(content)) needed.add('executeRun');
  if (/\.transaction\s*\(/.test(content)) {
    needed.add('executeTransaction');
    needed.add('getDatabase');
  }

  if (needed.size === 0) {
    needed.add('executeQuery');
    needed.add('executeQueryOne');
    needed.add('executeRun');
  }

  return Array.from(needed);
}

// ─── Format args for adapter calls ───────────────────────────────────────────
function formatArgs(argsContent: string): string {
  if (!argsContent) return '';

  const trimmed = argsContent.trim();

  if (trimmed.includes('...')) {
    // Simple spread only: "...params"
    if (/^\.\.\.\w+$/.test(trimmed)) {
      return `, ${trimmed.substring(3)}`;
    }
    // Spread with other args: "...params, limit, offset"
    return `, [${trimmed}]`;
  }

  if (trimmed.startsWith('[')) {
    return `, ${trimmed}`;
  }

  return `, [${trimmed}]`;
}

// ─── Parse type cast after closing paren ─────────────────────────────────────
function parseTypeCast(content: string, startPos: number): { typeCast: string; endPos: number } {
  let checkCursor = startPos;
  while (checkCursor < content.length && /\s/.test(content[checkCursor])) checkCursor++;

  if (content.substring(checkCursor, checkCursor + 3) !== 'as ') {
    return { typeCast: '', endPos: startPos };
  }

  const castStart = checkCursor + 3;
  let castEnd = castStart;
  let braceDepth = 0;
  let angleDepth = 0;

  while (castEnd < content.length) {
    const ch = content[castEnd];
    if (ch === '{') braceDepth++;
    else if (ch === '}') {
      braceDepth--;
      if (braceDepth < 0) break;
      if (braceDepth === 0 && angleDepth === 0) { castEnd++; break; }
    }
    else if (ch === '<') angleDepth++;
    else if (ch === '>') {
      angleDepth--;
      if (angleDepth < 0) break;
      if (angleDepth === 0 && braceDepth === 0) { castEnd++; break; }
    }
    else if (braceDepth === 0 && angleDepth === 0) {
      if (ch === ';' || ch === '\n' || ch === ')' || ch === ',') break;
    }
    castEnd++;
  }

  // Check for trailing [] (array type: { id: number }[])
  let trailCursor = castEnd;
  while (trailCursor < content.length && /\s/.test(content[trailCursor])) trailCursor++;
  if (trailCursor < content.length - 1 && content[trailCursor] === '[' && content[trailCursor + 1] === ']') {
    castEnd = trailCursor + 2;
  }

  return {
    typeCast: content.substring(castStart, castEnd).trim(),
    endPos: castEnd
  };
}

// ─── Find matching closing parenthesis ───────────────────────────────────────
function findMatchingParen(str: string, openIdx: number): number {
  if (str[openIdx] !== '(') return -1;

  let depth = 1;
  let i = openIdx + 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let escaped = false;

  while (i < str.length && depth > 0) {
    const ch = str[i];

    if (escaped) { escaped = false; i++; continue; }
    if (ch === '\\') { escaped = true; i++; continue; }

    if (inSingleQuote) { if (ch === "'") inSingleQuote = false; i++; continue; }
    if (inDoubleQuote) { if (ch === '"') inDoubleQuote = false; i++; continue; }

    if (inBacktick) {
      if (ch === '`') inBacktick = false;
      if (ch === '$' && i + 1 < str.length && str[i + 1] === '{') {
        let braceDepth = 1;
        i += 2;
        while (i < str.length && braceDepth > 0) {
          if (str[i] === '{') braceDepth++;
          else if (str[i] === '}') braceDepth--;
          if (braceDepth > 0) i++;
        }
        if (i < str.length) i++;
        continue;
      }
      i++; continue;
    }

    if (ch === "'") { inSingleQuote = true; i++; continue; }
    if (ch === '"') { inDoubleQuote = true; i++; continue; }
    if (ch === '`') { inBacktick = true; i++; continue; }

    if (ch === '(') depth++;
    if (ch === ')') depth--;

    if (depth > 0) i++;
  }

  return depth === 0 ? i : -1;
}

// ─── Escape string for use in RegExp ─────────────────────────────────────────
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Build replacement for a prepare().method() call ─────────────────────────
function buildReplacement(methodName: string, sqlArg: string, argsContent: string, typeCast: string): string {
  let adapterFn: string;
  switch (methodName) {
    case 'get': adapterFn = 'executeQueryOne'; break;
    case 'all': adapterFn = 'executeQuery'; break;
    case 'run': adapterFn = 'executeRun'; break;
    default: adapterFn = 'executeQuery';
  }

  const formattedArgs = formatArgs(argsContent);

  let generic = '';
  if (typeCast && methodName !== 'run') {
    generic = `<${typeCast}>`;
  }

  return `await ${adapterFn}${generic}(${sqlArg}${formattedArgs})`;
}

// ─── Main transformation logic ──────────────────────────────────────────────
function transformFile(content: string, filePath: string): { result: string; changed: boolean } {
  let result = content;
  let changed = false;

  // ─── Step 1: Replace the import line ─────────────────────────────────────
  const neededImports = determineNeededImports(result);

  // Skip pool-only imports
  if (/^import\s+\{\s*pool\s*\}\s+from\s+['"]@\/lib\/db\/connection['"];?\s*$/m.test(result)) {
    skippedFiles.push({ file: filePath, reason: 'Uses pool import (not migratable)' });
    return { result, changed: false };
  }

  // Handle default import
  const defaultImportRe = /^import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"](?:@\/lib\/db\/connection|\.\.?\/.*connection)['"];?\s*$/m;
  const defaultMatch = result.match(defaultImportRe);

  // Handle named import
  const namedImportRe = /^import\s+\{([^}]+)\}\s+from\s+['"](?:@\/lib\/db\/connection|\.\.?\/.*connection)['"];?\s*$/m;
  const namedMatch = result.match(namedImportRe);

  let localDbVarName: string | null = null;
  let importStyle: 'default' | 'named' | null = null;
  let importedNames: string[] = [];

  if (defaultMatch) {
    localDbVarName = defaultMatch[1];
    importStyle = 'default';
  } else if (namedMatch) {
    importedNames = namedMatch[1].split(',').map(s => s.trim());
    importStyle = 'named';
  }

  if (!importStyle) {
    skippedFiles.push({ file: filePath, reason: 'Could not parse import pattern' });
    return { result, changed: false };
  }

  // Build replacement import
  const importParts = [...new Set(neededImports)].sort();
  const importLine = `import { ${importParts.join(', ')} } from '@/lib/db/adapter';`;

  if (importStyle === 'default') {
    result = result.replace(defaultImportRe, importLine);
    changed = true;
  } else {
    result = result.replace(namedImportRe, importLine);
    changed = true;
  }

  // ─── Step 2: Handle "const db = ..." assignments ─────────────────────────
  const localDbVarNames: string[] = [];
  if (localDbVarName) localDbVarNames.push(localDbVarName);

  // Remove: const db = getDatabase() / getDb() / getDB() / getConnection()
  const getDbAssignmentRe = /^\s*const\s+(\w+)\s*=\s*(?:getDatabase|getDb|getDB|getConnection)\s*\(\s*\)\s*;?\s*\n?/gm;
  let getDbMatch;
  const tempResult = result;
  while ((getDbMatch = getDbAssignmentRe.exec(tempResult)) !== null) {
    localDbVarNames.push(getDbMatch[1]);
  }
  result = result.replace(getDbAssignmentRe, '');

  // Remove: const db = dbConnection; (aliasing a default import)
  if (localDbVarName) {
    // Require the variable name to be followed by end-of-statement markers, not by . or word chars
    const aliasAssignmentRe = new RegExp(
      `^\\s*const\\s+(\\w+)\\s*=\\s*${escapeRegExp(localDbVarName)}(?![.\\w])\\s*;?\\s*\\n?`,
      'gm'
    );
    let aliasMatch;
    const tempResult2 = result;
    while ((aliasMatch = aliasAssignmentRe.exec(tempResult2)) !== null) {
      localDbVarNames.push(aliasMatch[1]);
    }
    result = result.replace(aliasAssignmentRe, '');
  }

  // Handle named imports
  for (const funcName of importedNames) {
    if (['getDatabase', 'getDb', 'getDB', 'getConnection'].includes(funcName)) {
      const specificRe = new RegExp(
        `^\\s*const\\s+(\\w+)\\s*=\\s*${escapeRegExp(funcName)}\\s*\\(\\s*\\)\\s*;?\\s*\\n?`,
        'gm'
      );
      let m;
      const tmpR = result;
      while ((m = specificRe.exec(tmpR)) !== null) {
        if (!localDbVarNames.includes(m[1])) localDbVarNames.push(m[1]);
      }
      result = result.replace(specificRe, '');
    }
  }

  if (localDbVarNames.length === 0) localDbVarNames.push('db');
  const uniqueVarNames = [...new Set(localDbVarNames)];

  // ─── Step 3: Transform db.prepare().get/all/run patterns ─────────────────
  for (const dbVar of uniqueVarNames) {
    const escaped = escapeRegExp(dbVar);

    // 3a: Handle db.exec(SQL) -> await executeRun(SQL)
    const execRe = new RegExp(`${escaped}\\s*\\.exec\\s*\\(`, 'g');
    result = result.replace(execRe, 'await executeRun(');

    // 3b: Handle db.prepare(SQL).get/all/run patterns (inline)
    result = transformPrepareStatements(result, dbVar);

    // 3c: Handle prepared statement variables
    result = transformPreparedStatementVariables(result, dbVar);

    // 3d: Handle db.transaction()
    result = transformTransactions(result, dbVar);
  }

  if (result !== content) changed = true;
  return { result, changed };
}

// ─── Transform db.prepare(SQL).method(args) calls ────────────────────────────
function transformPrepareStatements(content: string, dbVar: string): string {
  const escaped = escapeRegExp(dbVar);
  let result = content;
  let safetyCounter = 0;
  const MAX_ITERATIONS = 500;

  while (safetyCounter++ < MAX_ITERATIONS) {
    // Match db.prepare( or db\n  .prepare(
    const preparePattern = new RegExp(`${escaped}\\s*\\.prepare\\s*\\(`);
    const match = preparePattern.exec(result);
    if (!match) break;

    const startIdx = match.index;
    const afterPrepare = startIdx + match[0].length;
    const sqlEnd = findMatchingParen(result, afterPrepare - 1);
    if (sqlEnd === -1) break;

    const sqlArg = result.substring(afterPrepare, sqlEnd).trim();

    // After ), find .get/.all/.run
    let cursor = sqlEnd + 1;
    while (cursor < result.length && /\s/.test(result[cursor])) cursor++;

    if (result[cursor] !== '.') {
      // Standalone prepare (assigned to variable) - skip for later processing
      result = result.substring(0, startIdx) + '___SKIP_PREPARE___' + result.substring(startIdx + match[0].length);
      continue;
    }
    cursor++;

    let methodName = '';
    while (cursor < result.length && /[a-zA-Z]/.test(result[cursor])) {
      methodName += result[cursor];
      cursor++;
    }

    if (!['get', 'all', 'run'].includes(methodName)) {
      result = result.substring(0, startIdx) + '___SKIP_PREPARE___' + result.substring(startIdx + match[0].length);
      continue;
    }

    while (cursor < result.length && /\s/.test(result[cursor])) cursor++;

    if (result[cursor] !== '(') {
      result = result.substring(0, startIdx) + '___SKIP_PREPARE___' + result.substring(startIdx + match[0].length);
      continue;
    }

    const argsStart = cursor;
    const argsEnd = findMatchingParen(result, argsStart);
    if (argsEnd === -1) {
      result = result.substring(0, startIdx) + '___SKIP_PREPARE___' + result.substring(startIdx + match[0].length);
      continue;
    }

    const argsContent = result.substring(argsStart + 1, argsEnd).trim();

    // Check for type cast
    const { typeCast, endPos } = parseTypeCast(result, argsEnd + 1);
    const endOfExpression = typeCast ? endPos : argsEnd + 1;

    // Build replacement
    const replacement = buildReplacement(methodName, sqlArg, argsContent, typeCast);

    result = result.substring(0, startIdx) + replacement + result.substring(endOfExpression);
  }

  // Restore skipped markers
  result = result.replace(/___SKIP_PREPARE___/g, `${dbVar}.prepare(`);
  return result;
}

// ─── Handle prepared statement variables ─────────────────────────────────────
function transformPreparedStatementVariables(content: string, dbVar: string): string {
  const escaped = escapeRegExp(dbVar);
  let result = content;

  // Find: const/let/var VARNAME = db.prepare(SQL);
  const stmtDeclRe = new RegExp(
    `(?:const|let|var)\\s+(\\w+)\\s*=\\s*${escaped}\\s*\\.prepare\\s*\\(`,
    'g'
  );

  const stmtVars: { name: string; sql: string; fullMatchStart: number; fullMatchEnd: number }[] = [];
  let stmtMatch;

  while ((stmtMatch = stmtDeclRe.exec(result)) !== null) {
    const varName = stmtMatch[1];
    const prepareStart = stmtMatch.index;
    const afterParen = prepareStart + stmtMatch[0].length;
    const sqlEnd = findMatchingParen(result, afterParen - 1);
    if (sqlEnd === -1) continue;

    const sql = result.substring(afterParen, sqlEnd).trim();

    let stmtEnd = sqlEnd + 1;
    while (stmtEnd < result.length && result[stmtEnd] !== ';' && result[stmtEnd] !== '\n') stmtEnd++;
    if (stmtEnd < result.length && result[stmtEnd] === ';') stmtEnd++;

    stmtVars.push({ name: varName, sql, fullMatchStart: prepareStart, fullMatchEnd: stmtEnd });
  }

  // Process in reverse order to maintain indices
  for (let i = stmtVars.length - 1; i >= 0; i--) {
    const { name, sql, fullMatchStart, fullMatchEnd } = stmtVars[i];

    // Determine scope: from declaration to next declaration of same name (or end of file)
    let scopeEndInOriginal = result.length;
    for (let j = i + 1; j < stmtVars.length; j++) {
      if (stmtVars[j].name === name) {
        scopeEndInOriginal = stmtVars[j].fullMatchStart;
        break;
      }
    }

    // Extract parts
    const beforeDecl = result.substring(0, fullMatchStart);
    const afterDecl = result.substring(fullMatchEnd);
    const scopeLength = scopeEndInOriginal - fullMatchEnd;
    let scopedContent = afterDecl.substring(0, scopeLength);
    const afterScope = afterDecl.substring(scopeLength);

    // Replace usages within scope
    const usageRe = new RegExp(`${escapeRegExp(name)}\\.(get|all|run)\\s*\\(`, 'g');
    let safetyCounter = 0;

    while (safetyCounter++ < 200) {
      usageRe.lastIndex = 0;
      const usageMatch = usageRe.exec(scopedContent);
      if (!usageMatch) break;

      const usageStart = usageMatch.index;
      const method = usageMatch[1];
      const afterMethodParen = usageStart + usageMatch[0].length;
      const usageArgsEnd = findMatchingParen(scopedContent, afterMethodParen - 1);
      if (usageArgsEnd === -1) break;

      const argsContent = scopedContent.substring(afterMethodParen, usageArgsEnd).trim();

      const { typeCast, endPos } = parseTypeCast(scopedContent, usageArgsEnd + 1);
      const endOfExpr = typeCast ? endPos : usageArgsEnd + 1;

      const replacement = buildReplacement(method, sql, argsContent, typeCast);
      scopedContent = scopedContent.substring(0, usageStart) + replacement + scopedContent.substring(endOfExpr);
    }

    result = beforeDecl + scopedContent + afterScope;
  }

  return result;
}

// ─── Handle db.transaction() ─────────────────────────────────────────────────
function transformTransactions(content: string, dbVar: string): string {
  const escaped = escapeRegExp(dbVar);
  let result = content;

  const transactionRe = new RegExp(`${escaped}\\s*\\.transaction\\s*\\(`, 'g');
  if (transactionRe.test(result)) {
    result = result.replace(
      new RegExp(`${escaped}\\s*\\.transaction\\s*\\(`, 'g'),
      'getDatabase().transaction('
    );
  }

  return result;
}

// ─── Post-processing ─────────────────────────────────────────────────────────
function postProcess(content: string): string {
  let result = content;
  result = result.replace(/await\s+await\s+/g, 'await ');
  result = result.replace(/;;\s*$/gm, ';');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

// ─── Main entry point ───────────────────────────────────────────────────────
async function main() {
  const apiDir = path.join(process.cwd(), 'app', 'api');

  console.log('='.repeat(70));
  console.log('  ServiceDesk: Migrate API Routes to Database Adapter Pattern');
  console.log('='.repeat(70));
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will modify files)'}`);
  console.log(`  Backup: ${NO_BACKUP ? 'DISABLED' : 'ENABLED (.bak files)'}`);
  console.log(`  API directory: ${apiDir}`);
  console.log('');

  if (!fs.existsSync(apiDir)) {
    console.error(`ERROR: API directory not found: ${apiDir}`);
    process.exit(1);
  }

  const allFiles = findTsFiles(apiDir);
  console.log(`Found ${allFiles.length} TypeScript files under app/api/\n`);

  for (const filePath of allFiles) {
    filesScanned++;
    const relativePath = path.relative(process.cwd(), filePath);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      if (alreadyUsesAdapter(content)) {
        filesAlreadyMigrated++;
        continue;
      }

      if (!importsFromConnection(content)) {
        continue;
      }

      const { result, changed } = transformFile(content, filePath);
      if (!changed) continue;

      const finalContent = postProcess(result);

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would modify: ${relativePath}`);
        modifiedFiles.push(relativePath);
        filesModified++;
      } else {
        if (!NO_BACKUP) {
          fs.writeFileSync(filePath + '.bak', content, 'utf-8');
        }
        fs.writeFileSync(filePath, finalContent, 'utf-8');
        console.log(`  [MODIFIED] ${relativePath}`);
        modifiedFiles.push(relativePath);
        filesModified++;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  [ERROR] ${relativePath}: ${errMsg}`);
      errorFiles.push({ file: relativePath, error: errMsg });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('  MIGRATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Files scanned:           ${filesScanned}`);
  console.log(`  Files already migrated:  ${filesAlreadyMigrated}`);
  console.log(`  Files modified:          ${filesModified}`);
  console.log(`  Files skipped:           ${skippedFiles.length}`);
  console.log(`  Files with errors:       ${errorFiles.length}`);

  if (skippedFiles.length > 0) {
    console.log('\n  Skipped files:');
    for (const { file, reason } of skippedFiles) {
      console.log(`    - ${file}: ${reason}`);
    }
  }

  if (errorFiles.length > 0) {
    console.log('\n  Error files:');
    for (const { file, error } of errorFiles) {
      console.log(`    - ${file}: ${error}`);
    }
  }

  if (modifiedFiles.length > 0) {
    console.log('\n  Modified files:');
    for (const f of modifiedFiles) {
      console.log(`    - ${f}`);
    }
  }

  console.log('\n' + '='.repeat(70));

  if (DRY_RUN) {
    console.log('  This was a DRY RUN. No files were modified.');
    console.log('  Run without --dry-run to apply changes.');
  } else if (!NO_BACKUP) {
    console.log('  Backup files (.bak) were created for all modified files.');
    console.log('  To remove backups: find app/api -name "*.bak" -delete');
  }

  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
