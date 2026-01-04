#!/usr/bin/env tsx

/**
 * Script para aplicar o schema.sql completo ao banco de dados
 * Isso criará todas as tabelas que ainda não existem
 */

import db from '../lib/db/connection';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔄 Applying database schema...\n');

try {
  // Lê o arquivo de schema
  const schemaPath = join(process.cwd(), 'lib', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  console.log('📝 Executing schema.sql...');

  // Executa o schema (CREATE TABLE IF NOT EXISTS garante que não quebrará)
  db.exec(schema);

  console.log('✅ Schema applied successfully!\n');

  // Verificar tabelas criadas
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (
      name LIKE '%notification%' OR
      name LIKE '%escalation%' OR
      name LIKE '%filter%' OR
      name LIKE '%batch%'
    )
    ORDER BY name
  `).all() as { name: string }[];

  console.log('📊 Notification-related tables:');
  tables.forEach(t => console.log(`  ✓ ${t.name}`));

  console.log('\n=== VERIFYING REQUIRED TABLES ===\n');

  const requiredTables = [
    'notification_batches',
    'batch_configurations',
    'filter_rules',
    'escalation_rules',
    'escalation_instances'
  ];

  let allExist = true;
  requiredTables.forEach(tableName => {
    const exists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name = ?
    `).get(tableName);

    if (exists) {
      console.log(`✅ ${tableName}`);
    } else {
      console.log(`❌ ${tableName} - MISSING`);
      allExist = false;
    }
  });

  if (allExist) {
    console.log('\n🎉 All required tables created successfully!');
  } else {
    console.log('\n⚠️  Some tables are still missing!');
    process.exit(1);
  }

  db.close();
} catch (error) {
  console.error('❌ Error applying schema:', error);
  process.exit(1);
}
