#!/usr/bin/env tsx

/**
 * Script para inicializar o banco de dados
 * Uso: npm run init-db
 */

import { initializeDatabase, seedDatabase, isDatabaseInitialized } from '../lib/db';
import { logger } from '@/lib/monitoring/logger';

async function main() {
  logger.info('🚀 Initializing ServiceDesk Database...\n');

  // Verificar se o banco já está inicializado
  if (isDatabaseInitialized()) {
    logger.info('📊 Database already initialized');
  } else {
    // Inicializar o banco
    const initialized = initializeDatabase();
    if (!initialized) {
      logger.error('❌ Failed to initialize database');
      process.exit(1);
    }
  }

  // Fazer seed dos dados iniciais
  const seeded = await seedDatabase();
  if (!seeded) {
    logger.error('❌ Failed to seed database');
    process.exit(1);
  }

  logger.info('\n✅ Database setup completed successfully!');
  logger.info('📁 Database file location: ./data/servicedesk.db');
  logger.info('\n🎉 You can now start the application with: npm run dev');
}

main().catch((error) => {
  logger.error('❌ Error during database initialization', error);
  process.exit(1);
});
