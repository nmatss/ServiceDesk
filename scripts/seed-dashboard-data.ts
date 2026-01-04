#!/usr/bin/env ts-node

/**
 * Complete Database Seeding Script for Dashboard
 *
 * This script:
 * 1. Initializes the database schema
 * 2. Seeds base data (users, categories, statuses, etc.)
 * 3. Seeds enhanced demo data (50+ tickets with 30-day history)
 * 4. Populates analytics tables
 */

import { initializeDatabase } from '../lib/db/init';
import { seedDatabase } from '../lib/db/seed';
import { seedEnhancedData } from '../lib/db/seed-enhanced';
import logger from '../lib/monitoring/structured-logger';

async function main() {
  try {
    logger.info('🚀 Starting complete dashboard data seeding...\n');

    // Step 1: Initialize database schema
    logger.info('Step 1/3: Initializing database schema...');
    const schemaInit = initializeDatabase();
    if (!schemaInit) {
      throw new Error('Failed to initialize database schema');
    }
    logger.info('✅ Schema initialized\n');

    // Step 2: Seed base data
    logger.info('Step 2/3: Seeding base data (users, categories, basic tickets)...');
    const baseSeed = await seedDatabase();
    if (!baseSeed) {
      throw new Error('Failed to seed base data');
    }
    logger.info('✅ Base data seeded\n');

    // Step 3: Seed enhanced demo data
    logger.info('Step 3/3: Seeding enhanced demo data (50+ tickets, analytics)...');
    const enhancedSeed = await seedEnhancedData();
    if (!enhancedSeed) {
      throw new Error('Failed to seed enhanced data');
    }
    logger.info('✅ Enhanced data seeded\n');

    logger.info('\n🎉 DATABASE FULLY SEEDED! 🎉\n');
    logger.info('Dashboard is now ready with:');
    logger.info('  📊 Realistic data spanning last 30 days');
    logger.info('  🎫 50+ tickets with varied statuses and priorities');
    logger.info('  💬 Realistic comments and activity');
    logger.info('  📈 Daily analytics metrics');
    logger.info('  👥 Agent performance data');
    logger.info('  📁 Category distribution data\n');
    logger.info('Next steps:');
    logger.info('  1. Run: npm run dev');
    logger.info('  2. Visit: http://localhost:3000/admin');
    logger.info('  3. Login: admin@servicedesk.com / 123456\n');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
