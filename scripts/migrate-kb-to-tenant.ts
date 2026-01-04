#!/usr/bin/env tsx

import db from '../lib/db/connection';
import { logger } from '../lib/monitoring/logger';

/**
 * Migration script to add tenant_id to KB tables and migrate old data
 */
async function migrateKBTables() {
  try {
    logger.info('🔄 Starting KB tables migration to add tenant_id support...');

    // Check if kb_categories has tenant_id column
    const categoriesColumns = db.prepare(`PRAGMA table_info(kb_categories)`).all() as Array<{
      name: string;
    }>;
    const categoryHasTenantId = categoriesColumns.some(col => col.name === 'tenant_id');

    if (!categoryHasTenantId) {
      logger.info('Adding tenant_id to kb_categories...');

      // Add tenant_id column to kb_categories
      db.prepare(`
        ALTER TABLE kb_categories ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1
      `).run();

      // Create index for tenant isolation
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_kb_categories_tenant
        ON kb_categories(tenant_id, is_active, sort_order)
      `).run();

      logger.info('✅ Added tenant_id to kb_categories');
    } else {
      logger.info('✅ kb_categories already has tenant_id column');
    }

    // Check if kb_articles has tenant_id column
    const articlesColumns = db.prepare(`PRAGMA table_info(kb_articles)`).all() as Array<{
      name: string;
    }>;
    const articleHasTenantId = articlesColumns.some(col => col.name === 'tenant_id');

    if (!articleHasTenantId) {
      logger.info('Adding tenant_id to kb_articles...');

      // Add tenant_id column to kb_articles
      db.prepare(`
        ALTER TABLE kb_articles ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1
      `).run();

      // Create indexes for tenant isolation and performance
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant_status
        ON kb_articles(tenant_id, status, published_at DESC)
      `).run();

      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant_category
        ON kb_articles(tenant_id, category_id, status)
      `).run();

      logger.info('✅ Added tenant_id to kb_articles');
    } else {
      logger.info('✅ kb_articles already has tenant_id column');
    }

    // Check if old knowledge_articles table exists
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_articles'
    `).get() as { name: string } | undefined;

    if (tables) {
      logger.info('📦 Found old knowledge_articles table, migrating data...');

      // Migrate data from old table to new kb_articles
      const oldArticles = db.prepare(`SELECT * FROM knowledge_articles`).all();

      if (oldArticles.length > 0) {
        for (const article of oldArticles as Array<any>) {
          // Check if article already exists in new table
          const exists = db.prepare(`
            SELECT id FROM kb_articles WHERE title = ?
          `).get(article.title);

          if (!exists) {
            db.prepare(`
              INSERT INTO kb_articles (
                title, slug, summary, content, category_id, author_id,
                status, visibility, featured, view_count, helpful_votes, not_helpful_votes,
                published_at, created_at, updated_at, tenant_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).run(
              article.title,
              article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              article.summary || '',
              article.content,
              article.category_id,
              article.author_id,
              article.is_published ? 'published' : 'draft',
              'public',
              0,
              article.view_count || 0,
              article.helpful_count || 0,
              article.not_helpful_count || 0,
              article.is_published ? new Date().toISOString() : null,
              article.created_at || new Date().toISOString(),
              article.updated_at || new Date().toISOString()
            );
          }
        }
        logger.info(`✅ Migrated ${oldArticles.length} articles from old table`);
      }

      // Rename old table as backup
      db.prepare(`ALTER TABLE knowledge_articles RENAME TO knowledge_articles_backup`).run();
      logger.info('✅ Renamed old table to knowledge_articles_backup');
    }

    logger.info('✅ KB tables migration completed successfully!');

  } catch (error) {
    logger.error('❌ Error migrating KB tables', error);
    throw error;
  }
}

migrateKBTables();
