#!/usr/bin/env node

/**
 * Script to fix common TypeScript errors in app/api routes
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in app/api
const files = glob.sync('/home/nic20/ProjetosWeb/ServiceDesk/app/api/**/route.ts');

let totalFixes = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix 1: Replace await db.get/all/run with db.prepare().get/all/run
  if (content.includes('await db.get(') || content.includes('await db.all(') || content.includes('await db.run(')) {
    content = content.replace(/await db\.get\(`([^`]+)`(?:,\s*\[([^\]]+)\])?\)/g, (match, query, params) => {
      return params
        ? `db.prepare(\`${query}\`).get(${params}) as any`
        : `db.prepare(\`${query}\`).get() as any`;
    });

    content = content.replace(/await db\.all\(`([^`]+)`(?:,\s*\[([^\]]+)\])?\)/g, (match, query, params) => {
      return params
        ? `db.prepare(\`${query}\`).all(${params}) as any[]`
        : `db.prepare(\`${query}\`).all() as any[]`;
    });

    content = content.replace(/await db\.run\(`([^`]+)`(?:,\s*\[([^\]]+)\])?\)/g, (match, query, params) => {
      return params
        ? `db.prepare(\`${query}\`).run(${params})`
        : `db.prepare(\`${query}\`).run()`;
    });

    modified = true;
  }

  // Fix 2: Remove next-auth imports
  if (content.includes('next-auth')) {
    content = content.replace(/import\s+{\s*getServerSession\s*}\s+from\s+['"]next-auth['"];?\s*\n/g, '');
    content = content.replace(/import\s+{\s*authOptions\s*}\s+from\s+['"]@\/lib\/auth['"];?\s*\n/g, '');
    modified = true;
  }

  // Fix 3: Replace { db } with default db import
  if (content.includes("{ db } from '@/lib/db/connection'") || content.includes('{ db } from "@/lib/db/connection"')) {
    content = content.replace(/import\s+{\s*db\s*}\s+from\s+['"]@\/lib\/db\/connection['"]/g, "import db from '@/lib/db/connection'");
    modified = true;
  }

  // Fix 4: Replace { getDb } with default db import
  if (content.includes("{ getDb }")) {
    content = content.replace(/import\s+{\s*getDb\s*}\s+from\s+['"]@\/lib\/db\/connection['"]/g, "import db from '@/lib/db/connection'");
    content = content.replace(/getDb\(\)/g, 'db');
    modified = true;
  }

  // Fix 5: Replace { getDB } with default db import
  if (content.includes("{ getDB }")) {
    content = content.replace(/import\s+{\s*getDB\s*}\s+from\s+['"]@\/lib\/db\/connection['"]/g, "import db from '@/lib/db/connection'");
    content = content.replace(/getDB\(\)/g, 'db');
    modified = true;
  }

  //Fix 6: Add verifyToken import if getServerSession is being replaced
  if (content.includes('getServerSession') && !content.includes('verifyToken')) {
    // Add import at top after other imports
    const importMatch = content.match(/(import[^;]+from\s+['"][^'"]+['"];?\n)+/);
    if (importMatch) {
      content = content.replace(importMatch[0], importMatch[0] + "import { verifyToken } from '@/lib/auth/sqlite-auth';\n");
      modified = true;
    }
  }

  // Fix 7: Replace ZodError .errors with .issues
  if (content.includes('.errors') && content.includes('ZodError')) {
    content = content.replace(/error\.errors/g, 'error.issues');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixes++;
    console.log(`Fixed: ${filePath}`);
  }
});

console.log(`\nTotal files fixed: ${totalFixes}`);
