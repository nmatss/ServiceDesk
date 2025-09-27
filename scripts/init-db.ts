#!/usr/bin/env tsx

/**
 * Script para inicializar o banco de dados
 * Uso: npm run init-db
 */

import { initializeDatabase, seedDatabase, isDatabaseInitialized } from '../lib/db';

async function main() {
  console.log('🚀 Initializing ServiceDesk Database...\n');

  // Verificar se o banco já está inicializado
  if (isDatabaseInitialized()) {
    console.log('📊 Database already initialized');
  } else {
    // Inicializar o banco
    const initialized = initializeDatabase();
    if (!initialized) {
      console.error('❌ Failed to initialize database');
      process.exit(1);
    }
  }

  // Fazer seed dos dados iniciais
  const seeded = await seedDatabase();
  if (!seeded) {
    console.error('❌ Failed to seed database');
    process.exit(1);
  }

  console.log('\n✅ Database setup completed successfully!');
  console.log('📁 Database file location: ./data/servicedesk.db');
  console.log('\n🎉 You can now start the application with: npm run dev');
}

main().catch((error) => {
  console.error('❌ Error during database initialization:', error);
  process.exit(1);
});
