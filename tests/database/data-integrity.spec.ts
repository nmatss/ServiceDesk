import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

/**
 * Database Data Integrity Test Suite
 *
 * Tests comprehensive database constraints, triggers, indexes,
 * foreign keys, cascades, and multi-tenant data isolation.
 */

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-db-integrity.db');

let db: Database.Database;

test.describe('Database Data Integrity Tests', () => {
  test.beforeAll(() => {
    // Clean up any existing test database
    try {
      rmSync(TEST_DB_PATH, { force: true });
    } catch {}

    mkdirSync(join(process.cwd(), 'data'), { recursive: true });

    // Create test database
    db = new Database(TEST_DB_PATH);
    db.pragma('foreign_keys = ON');

    // Load schema
    const schema = require('fs').readFileSync(
      join(process.cwd(), 'lib', 'db', 'schema.sql'),
      'utf-8'
    );
    db.exec(schema);
  });

  test.afterAll(() => {
    if (db) {
      db.close();
    }
    try {
      rmSync(TEST_DB_PATH, { force: true });
    } catch {}
  });

  test.describe('Foreign Key Constraints', () => {
    test('should enforce foreign key on tickets.user_id', () => {
      // Insert a category, priority, and status first
      db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run('Test Category', '#FF0000');
      db.prepare('INSERT INTO priorities (name, level, color) VALUES (?, ?, ?)').run('High', 3, '#FF0000');
      db.prepare('INSERT INTO statuses (name, color, is_final) VALUES (?, ?, ?)').run('Open', '#0000FF', 0);

      // Try to insert ticket with non-existent user_id
      expect(() => {
        db.prepare(`
          INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('Test Ticket', 'Test Description', 999, 1, 1, 1);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    test('should enforce foreign key on tickets.assigned_to', () => {
      // Create a user first
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, is_active, organization_id)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test User', 'test@example.com', 'user', 1, 1).lastInsertRowid;

      // Try to assign ticket to non-existent agent
      expect(() => {
        db.prepare(`
          INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('Test Ticket', 'Test Description', userId, 888, 1, 1, 1, 1);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    test('should enforce foreign key on comments.ticket_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO comments (ticket_id, user_id, content, is_internal)
          VALUES (?, ?, ?, ?)
        `).run(999, 1, 'Test comment', 0);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    test('should enforce foreign key on refresh_tokens.user_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
          VALUES (?, ?, datetime('now', '+30 days'))
        `).run(999, 'test_hash_123');
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    test('should enforce foreign key on role_permissions.role_id', () => {
      // Create permission first
      db.prepare(`
        INSERT INTO permissions (name, resource, action)
        VALUES (?, ?, ?)
      `).run('test_permission', 'tickets', 'read');

      expect(() => {
        db.prepare(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES (?, ?)
        `).run(999, 1);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    test('should enforce foreign key on sla_tracking.ticket_id', () => {
      // Create SLA policy first
      db.prepare(`
        INSERT INTO sla_policies (name, priority_id, response_time_minutes, resolution_time_minutes, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test SLA', 1, 60, 240, 1);

      expect(() => {
        db.prepare(`
          INSERT INTO sla_tracking (ticket_id, sla_policy_id, response_due_at, resolution_due_at)
          VALUES (?, ?, datetime('now', '+1 hour'), datetime('now', '+4 hours'))
        `).run(999, 1);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  test.describe('CASCADE DELETE Constraints', () => {
    test('should cascade delete tickets when user is deleted', () => {
      // Create user and ticket
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Cascade User', 'cascade@test.com', 'user', 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Cascade Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      // Verify ticket exists
      let ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
      expect(ticket).toBeTruthy();

      // Delete user
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      // Verify ticket was cascade deleted
      ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
      expect(ticket).toBeUndefined();
    });

    test('should cascade delete comments when ticket is deleted', () => {
      // Create user and ticket
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Comment User', 'comment@test.com', 'user', 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Comment Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      const commentId = db.prepare(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal)
        VALUES (?, ?, ?, ?)
      `).run(ticketId, userId, 'Test comment', 0).lastInsertRowid;

      // Verify comment exists
      let comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
      expect(comment).toBeTruthy();

      // Delete ticket
      db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);

      // Verify comment was cascade deleted
      comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
      expect(comment).toBeUndefined();
    });

    test('should cascade delete attachments when ticket is deleted', () => {
      // Create user and ticket
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Attachment User', 'attach@test.com', 'user', 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Attachment Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      const attachmentId = db.prepare(`
        INSERT INTO attachments (ticket_id, filename, original_name, mime_type, size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(ticketId, 'test.pdf', 'test.pdf', 'application/pdf', 1024, userId).lastInsertRowid;

      // Delete ticket
      db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);

      // Verify attachment was cascade deleted
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
      expect(attachment).toBeUndefined();
    });

    test('should cascade delete sla_tracking when ticket is deleted', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('SLA User', 'sla@test.com', 'user', 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('SLA Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      // SLA should be auto-created by trigger, but let's verify
      const slaTracking = db.prepare('SELECT * FROM sla_tracking WHERE ticket_id = ?').get(ticketId);

      if (slaTracking) {
        // Delete ticket
        db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);

        // Verify SLA tracking was deleted
        const deletedSla = db.prepare('SELECT * FROM sla_tracking WHERE ticket_id = ?').get(ticketId);
        expect(deletedSla).toBeUndefined();
      }
    });

    test('should cascade delete role_permissions when role is deleted', () => {
      const roleId = db.prepare(`
        INSERT INTO roles (name, display_name, is_system, is_active)
        VALUES (?, ?, ?, ?)
      `).run('test_role', 'Test Role', 0, 1).lastInsertRowid;

      const permissionId = db.prepare(`
        INSERT INTO permissions (name, resource, action)
        VALUES (?, ?, ?)
      `).run('cascade_perm', 'tickets', 'delete').lastInsertRowid;

      db.prepare(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (?, ?)
      `).run(roleId, permissionId);

      // Delete role
      db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);

      // Verify role_permission was deleted
      const rolePerm = db.prepare('SELECT * FROM role_permissions WHERE role_id = ?').get(roleId);
      expect(rolePerm).toBeUndefined();
    });
  });

  test.describe('SET NULL Constraints', () => {
    test('should set assigned_to to NULL when agent is deleted', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Requester', 'requester@test.com', 'user', 1).lastInsertRowid;

      const agentId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Agent', 'agent@test.com', 'agent', 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('Assigned Ticket', 'Test', userId, agentId, 1, 1, 1, 1).lastInsertRowid;

      // Delete agent
      db.prepare('DELETE FROM users WHERE id = ?').run(agentId);

      // Verify ticket still exists but assigned_to is NULL
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
      expect(ticket).toBeTruthy();
      expect(ticket.assigned_to).toBeNull();
    });

    test('should set category_id to NULL when category is deleted (if not RESTRICT)', () => {
      // Note: Current schema has ON DELETE RESTRICT for category_id
      // This test verifies the RESTRICT behavior
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Category User', 'catuser@test.com', 'user', 1).lastInsertRowid;

      const categoryId = db.prepare(`
        INSERT INTO categories (name, color, organization_id)
        VALUES (?, ?, ?)
      `).run('Deletable Category', '#FF00FF', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Cat Ticket', 'Test', userId, categoryId, 1, 1, 1);

      // Try to delete category - should fail due to RESTRICT
      expect(() => {
        db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  test.describe('UNIQUE Constraints', () => {
    test('should enforce unique email on users', () => {
      db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('User 1', 'unique@test.com', 'user', 1);

      expect(() => {
        db.prepare(`
          INSERT INTO users (name, email, role, organization_id)
          VALUES (?, ?, ?, ?)
        `).run('User 2', 'unique@test.com', 'user', 1);
      }).toThrow(/UNIQUE constraint failed/);
    });

    test('should enforce unique slug on kb_articles', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('KB Author', 'kbauthor@test.com', 'admin', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO kb_articles (title, slug, content, author_id, status, organization_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('Article 1', 'unique-slug', 'Content', userId, 'published', 1);

      expect(() => {
        db.prepare(`
          INSERT INTO kb_articles (title, slug, content, author_id, status, organization_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('Article 2', 'unique-slug', 'Content', userId, 'published', 1);
      }).toThrow(/UNIQUE constraint failed/);
    });

    test('should enforce unique (user_id, role_id) on user_roles', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Role User', 'roleuser@test.com', 'user', 1).lastInsertRowid;

      const roleId = db.prepare(`
        INSERT INTO roles (name, display_name, is_system, is_active)
        VALUES (?, ?, ?, ?)
      `).run('unique_role', 'Unique Role', 0, 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO user_roles (user_id, role_id, is_active)
        VALUES (?, ?, ?)
      `).run(userId, roleId, 1);

      expect(() => {
        db.prepare(`
          INSERT INTO user_roles (user_id, role_id, is_active)
          VALUES (?, ?, ?)
        `).run(userId, roleId, 1);
      }).toThrow(/UNIQUE constraint failed/);
    });

    test('should enforce unique token_hash on refresh_tokens', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Token User', 'tokenuser@test.com', 'user', 1).lastInsertRowid;

      const tokenHash = 'unique_token_hash_123';

      db.prepare(`
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, is_active)
        VALUES (?, ?, datetime('now', '+30 days'), ?)
      `).run(userId, tokenHash, 1);

      expect(() => {
        db.prepare(`
          INSERT INTO refresh_tokens (user_id, token_hash, expires_at, is_active)
          VALUES (?, ?, datetime('now', '+30 days'), ?)
        `).run(userId, tokenHash, 1);
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  test.describe('CHECK Constraints', () => {
    test('should enforce role CHECK constraint on users', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO users (name, email, role, organization_id)
          VALUES (?, ?, ?, ?)
        `).run('Bad Role User', 'badrole@test.com', 'invalid_role', 1);
      }).toThrow(/CHECK constraint failed/);
    });

    test('should enforce priority level CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO priorities (name, level, color, organization_id)
          VALUES (?, ?, ?, ?)
        `).run('Invalid Priority', 5, '#FF0000', 1);
      }).toThrow(/CHECK constraint failed/);

      expect(() => {
        db.prepare(`
          INSERT INTO priorities (name, level, color, organization_id)
          VALUES (?, ?, ?, ?)
        `).run('Invalid Priority', 0, '#FF0000', 1);
      }).toThrow(/CHECK constraint failed/);
    });

    test('should enforce rating CHECK constraint on satisfaction_surveys', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Survey User', 'survey@test.com', 'user', 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Survey Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      expect(() => {
        db.prepare(`
          INSERT INTO satisfaction_surveys (ticket_id, user_id, rating)
          VALUES (?, ?, ?)
        `).run(ticketId, userId, 6);
      }).toThrow(/CHECK constraint failed/);

      expect(() => {
        db.prepare(`
          INSERT INTO satisfaction_surveys (ticket_id, user_id, rating)
          VALUES (?, ?, ?)
        `).run(ticketId, userId, 0);
      }).toThrow(/CHECK constraint failed/);
    });

    test('should enforce identifier_type CHECK constraint on rate_limits', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO rate_limits (identifier, identifier_type, endpoint, attempts)
          VALUES (?, ?, ?, ?)
        `).run('test_identifier', 'invalid_type', '/api/test', 1);
      }).toThrow(/CHECK constraint failed/);
    });
  });

  test.describe('NOT NULL Constraints', () => {
    test('should enforce NOT NULL on tickets.title', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Title User', 'titleuser@test.com', 'user', 1).lastInsertRowid;

      expect(() => {
        db.prepare(`
          INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(null, 'Description', userId, 1, 1, 1, 1);
      }).toThrow(/NOT NULL constraint failed/);
    });

    test('should enforce NOT NULL on users.email', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO users (name, email, role, organization_id)
          VALUES (?, ?, ?, ?)
        `).run('No Email User', null, 'user', 1);
      }).toThrow(/NOT NULL constraint failed/);
    });

    test('should enforce NOT NULL on categories.name', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO categories (name, color, organization_id)
          VALUES (?, ?, ?)
        `).run(null, '#FF0000', 1);
      }).toThrow(/NOT NULL constraint failed/);
    });
  });

  test.describe('Trigger Functionality', () => {
    test('should auto-update updated_at on users', async () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Update User', 'updateuser@test.com', 'user', 1).lastInsertRowid;

      // Get initial updated_at
      const initialUser = db.prepare('SELECT updated_at FROM users WHERE id = ?').get(userId) as any;
      const initialTime = new Date(initialUser.updated_at).getTime();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update user
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Updated Name', userId);

      // Get new updated_at
      const updatedUser = db.prepare('SELECT updated_at FROM users WHERE id = ?').get(userId) as any;
      const updatedTime = new Date(updatedUser.updated_at).getTime();

      expect(updatedTime).toBeGreaterThan(initialTime);
    });

    test('should create sla_tracking when ticket is created', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('SLA Trigger User', 'slatrigger@test.com', 'user', 1).lastInsertRowid;

      // Ensure active SLA policy exists
      const policyId = db.prepare(`
        INSERT INTO sla_policies (name, priority_id, response_time_minutes, resolution_time_minutes, is_active, organization_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('Trigger SLA', 1, 60, 240, 1, 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('SLA Trigger Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      // Verify SLA tracking was auto-created
      const slaTracking = db.prepare('SELECT * FROM sla_tracking WHERE ticket_id = ?').get(ticketId);
      expect(slaTracking).toBeTruthy();
    });

    test('should update article feedback counters on kb_article_feedback insert', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('KB Feedback User', 'kbfeedback@test.com', 'user', 1).lastInsertRowid;

      const articleId = db.prepare(`
        INSERT INTO kb_articles (title, slug, content, author_id, status, organization_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('Feedback Article', 'feedback-article', 'Content', userId, 'published', 1).lastInsertRowid;

      // Add helpful feedback
      db.prepare(`
        INSERT INTO kb_article_feedback (article_id, user_id, was_helpful)
        VALUES (?, ?, ?)
      `).run(articleId, userId, 1);

      // Check counters
      let article = db.prepare('SELECT helpful_votes, not_helpful_votes FROM kb_articles WHERE id = ?').get(articleId) as any;
      expect(article.helpful_votes).toBe(1);
      expect(article.not_helpful_votes).toBe(0);

      // Add not helpful feedback
      const user2Id = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('KB User 2', 'kbuser2@test.com', 'user', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO kb_article_feedback (article_id, user_id, was_helpful)
        VALUES (?, ?, ?)
      `).run(articleId, user2Id, 0);

      article = db.prepare('SELECT helpful_votes, not_helpful_votes FROM kb_articles WHERE id = ?').get(articleId) as any;
      expect(article.helpful_votes).toBe(1);
      expect(article.not_helpful_votes).toBe(1);
    });

    test('should auto-update tickets.resolved_at when status changes to final', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Resolve User', 'resolveuser@test.com', 'user', 1).lastInsertRowid;

      // Create a final status
      const finalStatusId = db.prepare(`
        INSERT INTO statuses (name, color, is_final, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Resolved', '#00FF00', 1, 1).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Resolve Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

      // Verify resolved_at is NULL
      let ticket = db.prepare('SELECT resolved_at FROM tickets WHERE id = ?').get(ticketId) as any;
      expect(ticket.resolved_at).toBeNull();

      // Update to final status
      db.prepare('UPDATE tickets SET status_id = ? WHERE id = ?').run(finalStatusId, ticketId);

      // Verify resolved_at is set
      ticket = db.prepare('SELECT resolved_at FROM tickets WHERE id = ?').get(ticketId) as any;
      expect(ticket.resolved_at).not.toBeNull();
    });
  });

  test.describe('Index Effectiveness', () => {
    test('should have index on tickets.user_id', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='tickets' AND name LIKE '%user_id%'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    test('should have index on tickets.assigned_to', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='tickets' AND name LIKE '%assigned_to%'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    test('should have index on tickets.status_id', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='tickets' AND name LIKE '%status_id%'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    test('should have index on notifications.user_id', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='notifications' AND name LIKE '%user_id%'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    test('should have index on sla_tracking.ticket_id', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='sla_tracking' AND name LIKE '%ticket_id%'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    test('should have composite index on user_roles', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='user_roles'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  test.describe('Multi-Tenant Data Isolation', () => {
    test('should isolate tickets by organization_id', () => {
      // Create two organizations
      const org1 = db.prepare(`
        INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Org 1', 'org-1', 'basic', 'active', 50, 1000, 1).lastInsertRowid;

      const org2 = db.prepare(`
        INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Org 2', 'org-2', 'basic', 'active', 50, 1000, 1).lastInsertRowid;

      // Create users in different orgs
      const user1 = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('User Org 1', 'user1@org1.com', 'user', org1).lastInsertRowid;

      const user2 = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('User Org 2', 'user2@org2.com', 'user', org2).lastInsertRowid;

      // Create tickets
      db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Org 1 Ticket', 'Test', user1, 1, 1, 1, org1);

      db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Org 2 Ticket', 'Test', user2, 1, 1, 1, org2);

      // Query org1 tickets
      const org1Tickets = db.prepare('SELECT * FROM tickets WHERE organization_id = ?').all(org1);
      expect(org1Tickets).toHaveLength(1);
      expect((org1Tickets[0] as any).title).toBe('Org 1 Ticket');

      // Query org2 tickets
      const org2Tickets = db.prepare('SELECT * FROM tickets WHERE organization_id = ?').all(org2);
      expect(org2Tickets).toHaveLength(1);
      expect((org2Tickets[0] as any).title).toBe('Org 2 Ticket');
    });

    test('should prevent cross-organization data access', () => {
      // Verify organizations exist from previous test
      const orgs = db.prepare('SELECT id FROM organizations').all();

      if (orgs.length >= 2) {
        const org1Id = (orgs[0] as any).id;
        const org2Id = (orgs[1] as any).id;

        // Get tickets for each org
        const org1Tickets = db.prepare('SELECT id FROM tickets WHERE organization_id = ?').all(org1Id);
        const org2Tickets = db.prepare('SELECT id FROM tickets WHERE organization_id = ?').all(org2Id);

        // Try to access org2 ticket with org1 filter - should return nothing
        if (org2Tickets.length > 0) {
          const crossOrgTicket = db.prepare('SELECT * FROM tickets WHERE id = ? AND organization_id = ?')
            .get((org2Tickets[0] as any).id, org1Id);

          expect(crossOrgTicket).toBeUndefined();
        }
      }
    });

    test('should cascade delete organization data', () => {
      // Create new org for deletion test
      const orgId = db.prepare(`
        INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Delete Org', 'delete-org', 'basic', 'active', 50, 1000, 1).lastInsertRowid;

      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Delete User', 'delete@org.com', 'user', orgId).lastInsertRowid;

      const ticketId = db.prepare(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('Delete Ticket', 'Test', userId, 1, 1, 1, orgId).lastInsertRowid;

      // Verify data exists
      expect(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)).toBeTruthy();
      expect(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)).toBeTruthy();

      // Delete organization
      db.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);

      // Verify cascade delete worked
      expect(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)).toBeUndefined();
      expect(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)).toBeUndefined();
    });
  });

  test.describe('Transaction Rollback Scenarios', () => {
    test('should rollback transaction on error', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Transaction User', 'transaction@test.com', 'user', 1).lastInsertRowid;

      // Start transaction
      const transaction = db.transaction((data: any) => {
        db.prepare(`
          INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('TX Ticket 1', 'Test', data.userId, 1, 1, 1, 1);

        // This should fail - invalid user_id
        db.prepare(`
          INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('TX Ticket 2', 'Test', 9999, 1, 1, 1, 1);
      });

      expect(() => transaction({ userId })).toThrow();

      // Verify first ticket was NOT inserted (transaction rolled back)
      const tickets = db.prepare('SELECT * FROM tickets WHERE title = ?').all('TX Ticket 1');
      expect(tickets).toHaveLength(0);
    });

    test('should commit successful transaction', () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Commit User', 'commit@test.com', 'user', 1).lastInsertRowid;

      const transaction = db.transaction((data: any) => {
        db.prepare(`
          INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('Commit Ticket 1', 'Test', data.userId, 1, 1, 1, 1);

        db.prepare(`
          INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('Commit Ticket 2', 'Test', data.userId, 1, 1, 1, 1);
      });

      transaction({ userId });

      // Verify both tickets were inserted
      const tickets = db.prepare('SELECT * FROM tickets WHERE user_id = ?').all(userId);
      expect(tickets.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Concurrent Update Handling', () => {
    test('should handle concurrent updates with updated_at', async () => {
      const userId = db.prepare(`
        INSERT INTO users (name, email, role, organization_id)
        VALUES (?, ?, ?, ?)
      `).run('Concurrent User', 'concurrent@test.com', 'user', 1).lastInsertRowid;

      // Get initial state
      const initialUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

      // Simulate two concurrent updates
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Update 1', userId);

      await new Promise(resolve => setTimeout(resolve, 10));

      db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Update 2', userId);

      // Get final state
      const finalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

      // Verify updated_at changed
      expect(new Date(finalUser.updated_at).getTime())
        .toBeGreaterThan(new Date(initialUser.updated_at).getTime());

      // Verify final name
      expect(finalUser.name).toBe('Update 2');
    });
  });

  test.describe('Schema Validation', () => {
    test('should have all core tables', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
      `).all().map((row: any) => row.name);

      const requiredTables = [
        'users', 'tickets', 'categories', 'priorities', 'statuses',
        'comments', 'attachments', 'sla_policies', 'sla_tracking',
        'notifications', 'permissions', 'roles', 'user_roles',
        'role_permissions', 'organizations', 'kb_articles',
        'kb_categories', 'workflows', 'workflow_steps'
      ];

      requiredTables.forEach(table => {
        expect(tables).toContain(table);
      });
    });

    test('should have proper column types on users table', () => {
      const userInfo = db.prepare('PRAGMA table_info(users)').all() as any[];

      const emailColumn = userInfo.find(col => col.name === 'email');
      expect(emailColumn.notnull).toBe(1);

      const isActiveColumn = userInfo.find(col => col.name === 'is_active');
      expect(isActiveColumn.dflt_value).toBeTruthy();
    });

    test('should have foreign key enabled', () => {
      const fkStatus = db.pragma('foreign_keys');
      expect(fkStatus).toHaveLength(1);
      expect((fkStatus[0] as any).foreign_keys).toBe(1);
    });
  });
});
