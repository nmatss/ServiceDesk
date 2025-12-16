#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');

const files = glob.sync('/home/nic20/ProjetosWeb/ServiceDesk/app/api/**/route.ts');

let totalFixes = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix: Remove getServerSession and authOptions that were missed
  const hasGetServerSession = content.includes('getServerSession');
  const hasAuthOptions = content.includes('authOptions');

  if (hasGetServerSession || hasAuthOptions) {
    // Replace getServerSession usage with verifyToken
    content = content.replace(/const session = await getServerSession\(authOptions\);?\s*\n?\s*if \(!session\?\.user\) \{/g,
      `// Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {`);

    // Add verifyToken import if needed and not present
    if (!content.includes("import { verifyToken }") && !content.includes("import { verifyToken,")) {
      const firstImportMatch = content.match(/^import .+;\n/m);
      if (firstImportMatch) {
        content = content.replace(firstImportMatch[0], firstImportMatch[0] + "import { verifyToken } from '@/lib/auth/sqlite-auth';\n");
      }
    }

    // Replace session.user.id with user.id
    content = content.replace(/session\.user\.id/g, 'user.id');
    content = content.replace(/session\.user\.name/g, 'user.name');
    content = content.replace(/session\.user\.email/g, 'user.email');
    content = content.replace(/session\.user\.role/g, 'user.role');

    modified = true;
  }

  // Fix: Replace .lastID with .lastInsertRowid
  if (content.includes('.lastID')) {
    content = content.replace(/(\w+)\.lastID/g, '$1.lastInsertRowid');
    modified = true;
  }

  // Fix: Remove unused validateJWTSecret import
  if (content.includes("import { validateJWTSecret }") && content.indexOf('validateJWTSecret()') === -1) {
    content = content.replace(/import\s+{\s*validateJWTSecret\s*}\s*from\s+['"]@\/lib\/config\/env['"];?\s*\n?/g, '');
    modified = true;
  }

  // Fix: Remove unused startTime, _startTime
  content = content.replace(/const\s+_?startTime\s*=\s*Date\.now\(\);?\s*\n/g, '');

  // Fix: Remove unused getDb import
  if (content.includes('import db, { getDb }')) {
    content = content.replace(/import\s+db,\s*{\s*getDb\s*}\s*from/g, 'import db from');
    modified = true;
  }

  // Fix: vectorDb unused
  content = content.replace(/const\s+vectorDb\s*=\s*new\s+VectorDatabase\([^)]+\);?\s*\n/g, '');

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixes++;
    console.log(`Fixed: ${filePath}`);
  }
});

console.log(`\nTotal files fixed: ${totalFixes}`);
