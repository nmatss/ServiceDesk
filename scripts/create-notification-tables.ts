#!/usr/bin/env tsx

/**
 * Script para criar apenas as tabelas de notificação faltantes
 */

import db from '../lib/db/connection';

console.log('🔄 Creating notification tables...\n');

try {
  // Tabela de regras de escalação de notificações
  console.log('Creating escalation_rules table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS escalation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      conditions TEXT NOT NULL,
      actions TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      is_active BOOLEAN DEFAULT TRUE,
      cooldown_period INTEGER NOT NULL DEFAULT 30,
      max_escalations INTEGER NOT NULL DEFAULT 3,
      created_by INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );
  `);

  // Tabela de instâncias de escalação ativas
  console.log('Creating escalation_instances table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS escalation_instances (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      triggered_at DATETIME NOT NULL,
      executed_actions TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
      escalation_level INTEGER NOT NULL DEFAULT 1,
      last_action_at DATETIME,
      next_action_at DATETIME,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES escalation_rules(id) ON DELETE CASCADE
    );
  `);

  // Criar índices
  console.log('Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active);
    CREATE INDEX IF NOT EXISTS idx_escalation_rules_priority ON escalation_rules(priority);
    CREATE INDEX IF NOT EXISTS idx_escalation_rules_created_by ON escalation_rules(created_by);

    CREATE INDEX IF NOT EXISTS idx_escalation_instances_notification ON escalation_instances(notification_id);
    CREATE INDEX IF NOT EXISTS idx_escalation_instances_rule ON escalation_instances(rule_id);
    CREATE INDEX IF NOT EXISTS idx_escalation_instances_status ON escalation_instances(status);
    CREATE INDEX IF NOT EXISTS idx_escalation_instances_next_action ON escalation_instances(next_action_at) WHERE status = 'pending';
  `);

  // Criar triggers
  console.log('Creating triggers...');
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_escalation_rules_updated_at
      AFTER UPDATE ON escalation_rules
      BEGIN
        UPDATE escalation_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS update_escalation_instances_updated_at
      AFTER UPDATE ON escalation_instances
      BEGIN
        UPDATE escalation_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `);

  console.log('✅ Tables created successfully!\n');

  // Verificar tabelas criadas
  const requiredTables = [
    'escalation_rules',
    'escalation_instances'
  ];

  console.log('=== VERIFYING TABLES ===\n');

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
  console.error('❌ Error creating tables:', error);
  process.exit(1);
}
