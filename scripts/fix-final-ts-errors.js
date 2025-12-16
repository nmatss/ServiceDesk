#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');

const files = glob.sync('/home/nic20/ProjetosWeb/ServiceDesk/app/api/**/route.ts');

let totalFixes = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix 1: Remove 'const db = db' or similar self-referential declarations
  if (content.match(/const db = db\s*\n/)) {
    content = content.replace(/\s*const db = db\s*\n/g, '\n');
    modified = true;
  }

  // Fix 2: Replace getDb imports
  if (content.includes("from '@/lib/db'")) {
    content = content.replace(/import\s+{\s*getDb\s*}\s+from\s+['"]@\/lib\/db['"]/g, "import db from '@/lib/db/connection'");
    modified = true;
  }

  // Fix 3: Remove unused imports
  const unusedImports = ['getDb', 'dashboardQueries', 'slaPredictor', 'VectorDatabase', 'AIModelManager'];
  unusedImports.forEach(imp => {
    // Check if import exists but isn't used in the file (simple check)
    const importRegex = new RegExp(`import\\s+{[^}]*\\b${imp}\\b[^}]*}\\s+from`, 'g');
    const usageRegex = new RegExp(`(?<!import[^;]+)\\b${imp}\\b`, 'g');

    if (importRegex.test(content)) {
      const contentWithoutImport = content.replace(importRegex, '');
      if (!usageRegex.test(contentWithoutImport)) {
        content = content.replace(new RegExp(`\\s*,?\\s*${imp}\\s*,?\\s*`, 'g'), match => {
          return match.includes(',') ? ', ' : '';
        });
        modified = true;
      }
    }
  });

  // Fix 4: Add type annotations for implicit any in arrow functions
  content = content.replace(/\.reduce\((\([a-z]+),\s*([a-z]+)\)\s*=>/g, '($1: any, $2: any) =>');
  content = content.replace(/\.map\(([a-z]+)\s*=>/g, '($1: any) =>');
  content = content.replace(/\.filter\(([a-z]+)\s*=>/g, '($1: any) =>');

  // Fix 5: Remove _startTime unused vars
  content = content.replace(/\s*const _startTime = Date\.now\(\);?\s*\n/g, '');

  // Fix 6: Fix specific 'session' references that were missed
  if (content.includes('session.') && !content.includes('getServerSession')) {
    content = content.replace(/session\.user\.id/g, 'user.id');
    content = content.replace(/session\.user\./g, 'user.');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixes++;
    console.log(`Fixed: ${filePath}`);
  }
});

console.log(`\nTotal files fixed: ${totalFixes}`);
