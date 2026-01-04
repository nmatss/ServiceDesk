#!/usr/bin/env tsx
/**
 * Migration script to add ticket_access_tokens table
 * This enables secure token-based access for portal tickets
 */

import db from '../lib/db/connection';

console.log('🔄 Adding ticket_access_tokens table...\n');

try {
  // Create ticket_access_tokens table
  db.exec(`
    -- ========================================
    -- TICKET ACCESS TOKENS (PORTAL SECURITY)
    -- ========================================

    -- Tabela de tokens de acesso para portal público
    -- Permite que usuários não autenticados acessem tickets específicos via token UUID
    -- SECURITY: Implementa acesso seguro sem exigir autenticação completa
    CREATE TABLE IF NOT EXISTS ticket_access_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE, -- UUID v4
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL, -- Tokens expiram após 30 dias por padrão
        used_at DATETIME, -- Timestamp do primeiro acesso
        usage_count INTEGER DEFAULT 0, -- Quantas vezes o token foi usado
        last_used_at DATETIME, -- Timestamp do último acesso
        revoked_at DATETIME, -- Se o token foi revogado manualmente
        is_active BOOLEAN DEFAULT TRUE, -- Flag de controle rápido
        created_by INTEGER, -- Usuário que gerou o token (se aplicável)
        metadata TEXT, -- JSON para informações adicionais (IP, user-agent, etc.)
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  console.log('✅ Table ticket_access_tokens created successfully');

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_token ON ticket_access_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_ticket_id ON ticket_access_tokens(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_expires ON ticket_access_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_active ON ticket_access_tokens(is_active, expires_at);
  `);

  console.log('✅ Indexes created successfully');

  // Verify table exists
  const tableInfo = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='ticket_access_tokens'
  `).get();

  if (tableInfo) {
    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Table structure:');

    const columns = db.prepare('PRAGMA table_info(ticket_access_tokens)').all();
    console.table(columns);

    console.log('\n🔍 Indexes:');
    const indexes = db.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type='index' AND tbl_name='ticket_access_tokens'
    `).all();
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}`);
    });
  } else {
    throw new Error('Table was not created');
  }

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n✨ Done!');
