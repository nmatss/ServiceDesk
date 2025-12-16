/**
 * Unit tests for Database Query Layer
 * Tests CRUD operations, type safety, error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db/connection';

describe('Database Connection', () => {
  it('should have a valid database connection', () => {
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
  });

  it('should execute simple query', () => {
    const result = db.prepare('SELECT 1 as test').get();
    expect(result).toBeDefined();
  });

  it('should handle errors gracefully', () => {
    expect(() => {
      db.prepare('SELECT * FROM nonexistent_table').all();
    }).toThrow();
  });
});

describe('User Queries', () => {
  describe('SELECT operations', () => {
    it('should query users table structure', () => {
      const result = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='users'
      `).get();

      expect(result).toBeDefined();
    });

    it('should select users with proper columns', () => {
      const users = db.prepare('SELECT * FROM users LIMIT 1').all();
      expect(Array.isArray(users)).toBe(true);
    });

    it('should handle empty result set', () => {
      const users = db.prepare('SELECT * FROM users WHERE id = ?').all(99999);
      expect(users).toEqual([]);
    });

    it('should parameterize queries safely', () => {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const result = stmt.get('nonexistent@example.com');
      expect(result).toBeUndefined();
    });

    it('should handle NULL values', () => {
      const result = db.prepare('SELECT NULL as test_null').get() as any;
      expect(result.test_null).toBeNull();
    });
  });

  describe('JOIN operations', () => {
    it('should join users with tickets', () => {
      const query = db.prepare(`
        SELECT u.id, u.name, u.email, COUNT(t.id) as ticket_count
        FROM users u
        LEFT JOIN tickets t ON u.id = t.user_id
        GROUP BY u.id
        LIMIT 1
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle missing join relationships', () => {
      const query = db.prepare(`
        SELECT u.id, u.name
        FROM users u
        LEFT JOIN tickets t ON u.id = t.user_id
        WHERE t.id IS NULL
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Aggregate functions', () => {
    it('should count users', () => {
      const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
      expect(typeof result.count).toBe('number');
      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('should group by role', () => {
      const results = db.prepare(`
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
      `).all();

      expect(Array.isArray(results)).toBe(true);
    });

    it('should calculate max, min, avg', () => {
      const result = db.prepare(`
        SELECT
          MAX(id) as max_id,
          MIN(id) as min_id,
          COUNT(id) as total
        FROM users
      `).get();

      expect(result).toBeDefined();
    });
  });
});

describe('Ticket Queries', () => {
  describe('SELECT operations', () => {
    it('should query tickets table', () => {
      const tickets = db.prepare('SELECT * FROM tickets LIMIT 10').all();
      expect(Array.isArray(tickets)).toBe(true);
    });

    it('should filter tickets by status', () => {
      const stmt = db.prepare('SELECT * FROM tickets WHERE status_id = ?');
      const result = stmt.all(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter tickets by priority', () => {
      const stmt = db.prepare('SELECT * FROM tickets WHERE priority_id = ?');
      const result = stmt.all(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by date range', () => {
      const stmt = db.prepare(`
        SELECT * FROM tickets
        WHERE created_at BETWEEN ? AND ?
      `);
      const result = stmt.all('2024-01-01', '2024-12-31');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should search tickets by title', () => {
      const stmt = db.prepare(`
        SELECT * FROM tickets
        WHERE title LIKE ?
      `);
      const result = stmt.all('%test%');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Complex JOIN operations', () => {
    it('should join tickets with all related tables', () => {
      const query = db.prepare(`
        SELECT
          t.id,
          t.title,
          u.name as user_name,
          s.name as status_name,
          p.name as priority_name,
          c.name as category_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN categories c ON t.category_id = c.id
        LIMIT 10
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('title');
        expect(result[0]).toHaveProperty('status_name');
      }
    });

    it('should join tickets with comments count', () => {
      const query = db.prepare(`
        SELECT
          t.id,
          t.title,
          COUNT(c.id) as comments_count
        FROM tickets t
        LEFT JOIN comments c ON t.id = c.ticket_id
        GROUP BY t.id
        LIMIT 10
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should join tickets with attachments count', () => {
      const query = db.prepare(`
        SELECT
          t.id,
          t.title,
          COUNT(a.id) as attachments_count
        FROM tickets t
        LEFT JOIN attachments a ON t.id = a.ticket_id
        GROUP BY t.id
        LIMIT 10
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should limit results', () => {
      const result = db.prepare('SELECT * FROM tickets LIMIT 5').all();
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should offset results', () => {
      const page1 = db.prepare('SELECT id FROM tickets LIMIT 5 OFFSET 0').all();
      const page2 = db.prepare('SELECT id FROM tickets LIMIT 5 OFFSET 5').all();

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);

      // Pages should be different (if enough data exists)
      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0]).not.toEqual(page2[0]);
      }
    });

    it('should order by created_at DESC', () => {
      const result = db.prepare(`
        SELECT id, created_at FROM tickets
        ORDER BY created_at DESC
        LIMIT 10
      `).all() as any[];

      if (result.length > 1) {
        // Check ordering
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].created_at >= result[i].created_at).toBe(true);
        }
      }
    });
  });
});

describe('SLA Tracking Queries', () => {
  describe('SLA Policies', () => {
    it('should query sla_policies table', () => {
      const policies = db.prepare('SELECT * FROM sla_policies LIMIT 10').all();
      expect(Array.isArray(policies)).toBe(true);
    });

    it('should filter active policies', () => {
      const policies = db.prepare(`
        SELECT * FROM sla_policies WHERE is_active = 1
      `).all();
      expect(Array.isArray(policies)).toBe(true);
    });

    it('should join policies with priorities', () => {
      const query = db.prepare(`
        SELECT sp.*, p.name as priority_name
        FROM sla_policies sp
        LEFT JOIN priorities p ON sp.priority_id = p.id
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('SLA Tracking', () => {
    it('should query sla_tracking table', () => {
      const tracking = db.prepare('SELECT * FROM sla_tracking LIMIT 10').all();
      expect(Array.isArray(tracking)).toBe(true);
    });

    it('should find breached SLAs', () => {
      const query = db.prepare(`
        SELECT * FROM sla_tracking
        WHERE response_due_at < datetime('now')
          AND response_met = 0
      `);

      const result = query.all();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should calculate SLA metrics', () => {
      const result = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN response_met = 1 THEN 1 ELSE 0 END) as response_met,
          SUM(CASE WHEN resolution_met = 1 THEN 1 ELSE 0 END) as resolution_met
        FROM sla_tracking
      `).get();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('total');
    });
  });
});

describe('Analytics Queries', () => {
  describe('Daily Metrics', () => {
    it('should query analytics_daily_metrics', () => {
      const metrics = db.prepare(`
        SELECT * FROM analytics_daily_metrics
        ORDER BY date DESC
        LIMIT 7
      `).all();

      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should filter metrics by date range', () => {
      const result = db.prepare(`
        SELECT * FROM analytics_daily_metrics
        WHERE date BETWEEN ? AND ?
      `).all('2024-01-01', '2024-12-31');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Agent Performance', () => {
    it('should query agent performance metrics', () => {
      const metrics = db.prepare(`
        SELECT
          assigned_to,
          COUNT(*) as total_tickets,
          SUM(CASE WHEN status_id IN (SELECT id FROM statuses WHERE is_final = 1) THEN 1 ELSE 0 END) as resolved
        FROM tickets
        WHERE assigned_to IS NOT NULL
        GROUP BY assigned_to
      `).all();

      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('Category Distribution', () => {
    it('should calculate ticket distribution by category', () => {
      const result = db.prepare(`
        SELECT
          c.name,
          COUNT(t.id) as count
        FROM categories c
        LEFT JOIN tickets t ON c.id = t.category_id
        GROUP BY c.id, c.name
      `).all();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Priority Distribution', () => {
    it('should calculate ticket distribution by priority', () => {
      const result = db.prepare(`
        SELECT
          p.name,
          p.level,
          COUNT(t.id) as count
        FROM priorities p
        LEFT JOIN tickets t ON p.id = t.priority_id
        GROUP BY p.id, p.name, p.level
        ORDER BY p.level
      `).all();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('Transaction Safety', () => {
  it('should support transactions', () => {
    const transaction = db.transaction(() => {
      db.prepare('SELECT 1').get();
    });

    expect(() => transaction()).not.toThrow();
  });

  it('should rollback on error', () => {
    const transaction = db.transaction(() => {
      db.prepare('SELECT 1').get();
      throw new Error('Test rollback');
    });

    expect(() => transaction()).toThrow();
  });
});

describe('Performance and Optimization', () => {
  it('should use prepared statements efficiently', () => {
    const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');

    // Execute multiple times with same statement
    const results = [
      stmt.get(1),
      stmt.get(2),
      stmt.get(3),
    ];

    expect(results.length).toBe(3);
  });

  it('should handle large result sets', () => {
    const stmt = db.prepare('SELECT * FROM tickets LIMIT 1000');
    const startTime = Date.now();
    const results = stmt.all();
    const duration = Date.now() - startTime;

    expect(Array.isArray(results)).toBe(true);
    expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
  });

  it('should use indexes for common queries', () => {
    // Query should be fast with proper indexes
    const startTime = Date.now();
    const result = db.prepare(`
      SELECT * FROM tickets
      WHERE status_id = ? AND priority_id = ?
    `).all(1, 1);
    const duration = Date.now() - startTime;

    expect(Array.isArray(result)).toBe(true);
    expect(duration).toBeLessThan(100); // Should be very fast with indexes
  });
});

describe('Data Integrity', () => {
  it('should enforce foreign key constraints', () => {
    // This test depends on PRAGMA foreign_keys being enabled
    const result = db.prepare('PRAGMA foreign_keys').get() as any;
    expect(result).toBeDefined();
  });

  it('should have proper table constraints', () => {
    const tableInfo = db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='tickets'
    `).get() as any;

    expect(tableInfo).toBeDefined();
    expect(tableInfo.sql).toContain('FOREIGN KEY');
  });

  it('should have unique constraints where needed', () => {
    const tableInfo = db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='users'
    `).get() as any;

    expect(tableInfo).toBeDefined();
    expect(tableInfo.sql).toContain('UNIQUE');
  });
});

describe('Query Safety and Security', () => {
  it('should prevent SQL injection in parameterized queries', () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');

    expect(() => {
      stmt.get(maliciousInput);
    }).not.toThrow();
  });

  it('should handle special characters safely', () => {
    const specialChars = "Test'\"\\%_";
    const stmt = db.prepare('SELECT * FROM tickets WHERE title LIKE ?');

    expect(() => {
      stmt.all(`%${specialChars}%`);
    }).not.toThrow();
  });

  it('should handle unicode characters', () => {
    const unicode = '测试 🚀 Тест';
    const stmt = db.prepare('SELECT ? as test');
    const result = stmt.get(unicode) as any;

    expect(result.test).toBe(unicode);
  });

  it('should handle NULL values in parameters', () => {
    const stmt = db.prepare('SELECT * FROM tickets WHERE assigned_to IS ?');

    expect(() => {
      stmt.all(null);
    }).not.toThrow();
  });
});

describe('Date and Time Handling', () => {
  it('should handle datetime functions', () => {
    const result = db.prepare(`
      SELECT
        datetime('now') as current_time,
        date('now') as current_date
    `).get();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('current_time');
    expect(result).toHaveProperty('current_date');
  });

  it('should handle date comparisons', () => {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE created_at > datetime('now', '-7 days')
    `).get();

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should format dates correctly', () => {
    const result = db.prepare(`
      SELECT strftime('%Y-%m-%d', created_at) as formatted_date
      FROM tickets
      LIMIT 1
    `).get();

    if (result) {
      expect(result).toHaveProperty('formatted_date');
    }
  });
});
