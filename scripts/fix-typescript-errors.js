#!/usr/bin/env node

/**
 * Script para corrigir automaticamente erros TypeScript comuns
 * - Remove variáveis não utilizadas
 * - Remove imports não utilizados
 * - Adiciona prefixo _ para variáveis intencionalmente não utilizadas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Iniciando correção automática de erros TypeScript...\n');

// Passo 1: Obter lista de erros
console.log('📊 Analisando erros TypeScript...');
let errors;
try {
    execSync('npm run type-check 2>&1', { encoding: 'utf-8' });
    console.log('✅ Nenhum erro encontrado!');
    process.exit(0);
} catch (error) {
    errors = error.stdout;
}

// Passo 2: Parsear erros
const errorLines = errors.split('\n').filter(line => line.includes('error TS'));
console.log(`📝 Total de erros encontrados: ${errorLines.length}\n`);

// Agrupar erros por tipo
const errorsByType = {
    unusedVars: [], // TS6133
    unusedImports: [], // TS6192
    other: []
};

errorLines.forEach(line => {
    if (line.includes('TS6133')) {
        errorsByType.unusedVars.push(line);
    } else if (line.includes('TS6192')) {
        errorsByType.unusedImports.push(line);
    } else {
        errorsByType.other.push(line);
    }
});

console.log(`📦 Variáveis não utilizadas (TS6133): ${errorsByType.unusedVars.length}`);
console.log(`📦 Imports não utilizados (TS6192): ${errorsByType.unusedImports.length}`);
console.log(`📦 Outros erros: ${errorsByType.other.length}\n`);

// Passo 3: Corrigir imports não utilizados
console.log('🔧 Corrigindo imports não utilizados...');
const filesWithUnusedImports = new Set();

errorsByType.unusedImports.forEach(line => {
    const match = line.match(/^(.+?)\(/);
    if (match) {
        filesWithUnusedImports.add(match[1]);
    }
});

filesWithUnusedImports.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        // Encontrar imports não utilizados
        const unusedImportLines = errorsByType.unusedImports
            .filter(err => err.startsWith(file))
            .map(err => {
                const lineMatch = err.match(/\((\d+),/);
                return lineMatch ? parseInt(lineMatch[1]) - 1 : null;
            })
            .filter(l => l !== null);

        // Comentar imports não utilizados
        unusedImportLines.forEach(lineNum => {
            if (lines[lineNum] && lines[lineNum].includes('import')) {
                lines[lineNum] = '// ' + lines[lineNum] + ' // Auto-commented: unused import';
            }
        });

        fs.writeFileSync(file, lines.join('\n'), 'utf-8');
        console.log(`  ✅ ${file}`);
    } catch (error) {
        console.log(`  ❌ Erro ao processar ${file}: ${error.message}`);
    }
});

// Passo 4: Prefixar variáveis não utilizadas com _
console.log('\n🔧 Prefixando variáveis não utilizadas com _...');
const filesWithUnusedVars = {};

errorsByType.unusedVars.forEach(line => {
    const fileMatch = line.match(/^(.+?)\(/);
    const varMatch = line.match(/'(.+?)' is declared but/);

    if (fileMatch && varMatch) {
        const file = fileMatch[1];
        const varName = varMatch[1];

        if (!filesWithUnusedVars[file]) {
            filesWithUnusedVars[file] = new Set();
        }
        filesWithUnusedVars[file].add(varName);
    }
});

Object.entries(filesWithUnusedVars).forEach(([file, vars]) => {
    try {
        let content = fs.readFileSync(file, 'utf-8');

        vars.forEach(varName => {
            // Adicionar _ no início da variável
            // Padrões comuns: const varName, let varName, varName:, (varName,
            const patterns = [
                new RegExp(`\\bconst ${varName}\\b`, 'g'),
                new RegExp(`\\blet ${varName}\\b`, 'g'),
                new RegExp(`\\b${varName}:`, 'g'),
                new RegExp(`\\(${varName},`, 'g'),
                new RegExp(`\\(${varName}\\)`, 'g'),
                new RegExp(`, ${varName}\\)`, 'g'),
                new RegExp(`, ${varName},`, 'g'),
            ];

            patterns.forEach(pattern => {
                content = content.replace(pattern, match => {
                    return match.replace(varName, `_${varName}`);
                });
            });
        });

        fs.writeFileSync(file, content, 'utf-8');
        console.log(`  ✅ ${file} (${vars.size} variáveis)`);
    } catch (error) {
        console.log(`  ❌ Erro ao processar ${file}: ${error.message}`);
    }
});

console.log('\n✅ Correções automáticas concluídas!');
console.log('\n📊 Executando type-check novamente...');

try {
    execSync('npm run type-check 2>&1', { encoding: 'utf-8', stdio: 'inherit' });
    console.log('\n✅ Todos os erros foram corrigidos!');
} catch (error) {
    const remainingErrors = error.stdout.split('\n').filter(line => line.includes('error TS')).length;
    console.log(`\n⚠️  Ainda restam ${remainingErrors} erros que precisam de correção manual.`);
    console.log('Execute: npm run type-check | grep "error TS" | head -50');
}
