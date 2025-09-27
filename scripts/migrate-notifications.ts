#!/usr/bin/env tsx

import { getDb } from '../lib/db';

/**
 * Migração para adicionar colunas em falta na tabela notifications
 */
function migrateNotifications() {
  const db = getDb();

  try {
    console.log('🔄 Migrating notifications table...');

    // Verificar se a coluna 'data' já existe
    const tableInfo = db.prepare("PRAGMA table_info(notifications)").all();
    const hasDataColumn = tableInfo.some((column: any) => column.name === 'data');
    const hasUpdatedAtColumn = tableInfo.some((column: any) => column.name === 'updated_at');

    if (!hasDataColumn) {
      console.log('➕ Adding data column to notifications table...');
      db.exec('ALTER TABLE notifications ADD COLUMN data TEXT');
    } else {
      console.log('✅ Data column already exists in notifications table');
    }

    if (!hasUpdatedAtColumn) {
      console.log('➕ Adding updated_at column to notifications table...');
      db.exec('ALTER TABLE notifications ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    } else {
      console.log('✅ Updated_at column already exists in notifications table');
    }

    // Atualizar tipos permitidos se necessário
    console.log('🔄 Ensuring notification types are up to date...');

    // Criar trigger para updated_at se não existir
    console.log('🔄 Creating trigger for updated_at...');
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at
      AFTER UPDATE ON notifications
      BEGIN
          UPDATE notifications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    console.log('✅ Notifications table migration completed successfully!');

  } catch (error) {
    console.error('❌ Error migrating notifications table:', error);
    throw error;
  }
}

// Executar migração se este arquivo for executado diretamente
if (require.main === module) {
  migrateNotifications();
}

export { migrateNotifications };