#!/usr/bin/env tsx

/**
 * Script para migrar o banco de dados
 * Adiciona a coluna password_hash na tabela users
 */

import db from '../lib/db/connection'

async function migrateDatabase() {
  try {
    console.log('🔄 Migrating database...')

    // Verificar se a coluna password_hash já existe
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[]
    const hasPasswordHash = tableInfo.some(column => column.name === 'password_hash')

    if (!hasPasswordHash) {
      console.log('📝 Adding password_hash column to users table...')
      
      // Adicionar coluna password_hash
      db.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').run()
      
      console.log('✅ password_hash column added successfully')
    } else {
      console.log('✅ password_hash column already exists')
    }

    console.log('✅ Database migration completed successfully!')
    return true
  } catch (error) {
    console.error('❌ Error during database migration:', error)
    return false
  }
}

migrateDatabase().then((success) => {
  if (success) {
    process.exit(0)
  } else {
    process.exit(1)
  }
})

