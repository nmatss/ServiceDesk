/**
 * Migration Script: Add tenant_id to notifications table
 *
 * This script adds the tenant_id column to the existing notifications table
 * and updates the indexes.
 */

import db from '../lib/db/connection';
import { logger } from '../lib/monitoring/logger';

async function migrateNotificationsTenant() {
  try {
    console.log('🔄 Starting notifications table migration...\n');

    // Check if tenant_id column already exists
    const tableInfo = db.prepare("PRAGMA table_info(notifications)").all() as any[];
    const hasTenantId = tableInfo.some((col: any) => col.name === 'tenant_id');

    if (hasTenantId) {
      console.log('✅ tenant_id column already exists in notifications table');
      console.log('   Skipping migration\n');
      return;
    }

    console.log('📝 Adding tenant_id column to notifications table...');

    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Add tenant_id column with default value
      db.prepare(`
        ALTER TABLE notifications
        ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1
      `).run();

      console.log('   ✓ Added tenant_id column');

      // Update tenant_id based on user's tenant
      const updateResult = db.prepare(`
        UPDATE notifications
        SET tenant_id = (
          SELECT tenant_id FROM users WHERE users.id = notifications.user_id
        )
        WHERE EXISTS (
          SELECT 1 FROM users WHERE users.id = notifications.user_id
        )
      `).run();

      console.log(`   ✓ Updated ${updateResult.changes} notifications with correct tenant_id`);

      // Update CHECK constraint to include new notification types
      // Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints
      // We would need to recreate the table, which we'll skip for now
      // The schema.sql file has the updated constraint for new databases

      // Drop old indexes if they exist
      try {
        db.prepare('DROP INDEX IF EXISTS idx_notifications_user_status').run();
        db.prepare('DROP INDEX IF EXISTS idx_notifications_unread_only').run();
        console.log('   ✓ Dropped old indexes');
      } catch (e) {
        // Indexes might not exist, that's okay
      }

      // Create new indexes with tenant_id
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_status
        ON notifications(user_id, tenant_id, is_read, type, created_at DESC)
      `).run();

      console.log('   ✓ Created idx_notifications_user_status');

      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_notifications_unread_only
        ON notifications(user_id, tenant_id, created_at DESC)
        WHERE is_read = 0
      `).run();

      console.log('   ✓ Created idx_notifications_unread_only');

      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_notifications_tenant
        ON notifications(tenant_id, created_at DESC)
      `).run();

      console.log('   ✓ Created idx_notifications_tenant');

      // Commit transaction
      db.prepare('COMMIT').run();

      console.log('\n✅ Migration completed successfully!');

      // Show statistics
      const stats = db.prepare(`
        SELECT
          tenant_id,
          COUNT(*) as total,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
        FROM notifications
        GROUP BY tenant_id
      `).all();

      console.log('\n📊 Notifications by tenant:');
      console.table(stats);

    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  migrateNotificationsTenant()
    .then(() => {
      console.log('\n🎉 Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateNotificationsTenant;
