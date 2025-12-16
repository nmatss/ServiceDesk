#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');

const files = glob.sync('/home/nic20/ProjetosWeb/ServiceDesk/app/api/**/route.ts');

let totalFixes = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix broken map calls: array(param: any) => should be array.map((param: any) =>
  const patterns = [
    // Pattern: arrayName(param: any) => expr)
    /(\w+)\((\w+):\s*any\)\s*=>\s*([^)]+)\)/g,
    // Pattern: arrayName(param: any) => { ... })
    /(\w+)\((\w+):\s*any\)\s*=>\s*\(/g
  ];

  patterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, (match, arrayName, param, rest) => {
        // Check if this looks like a broken map/filter/reduce call
        if (rest) {
          return `${arrayName}.map((${param}: any) => ${rest})`;
        } else {
          return `${arrayName}.map((${param}: any) =>`;
        }
      });
      modified = true;
    }
  });

  // More specific pattern fixes
  // Fix: `slaPredictor` destructured from import that doesn't exist
  if (content.includes('const { slaPredictor }')) {
    content = content.replace(/const\s*{\s*slaPredictor\s*}\s*=\s*[^;]+;?\s*\n/g, '');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixes++;
    console.log(`Fixed: ${filePath}`);
  }
});

console.log(`\nTotal files fixed: ${totalFixes}`);
