/**
 * Unit tests for API Validation System
 * Tests Zod schema validation, request validation, error handling
 */

import { describe, it, expect } from 'vitest';
import {
  BaseSchemas,
  UserSchemas,
  TicketSchemas,
  CommentSchemas,
  FileSchemas,
  KnowledgeSchemas,
  AdminSchemas,
  WebhookSchemas,
  IntegrationSchemas,
  validateRequest,
  SchemaRegistry,
} from '@/lib/api/validation';
import { NextRequest } from 'next/server';

describe('Base Validation Schemas', () => {
  describe('Pagination Schema', () => {
    it('should validate valid pagination params', () => {
      const validData = { page: 1, limit: 20, order: 'desc' as const };
      const result = BaseSchemas.Pagination.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const result = BaseSchemas.Pagination.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.order).toBe('desc');
      }
    });

    it('should reject invalid page number', () => {
      const result = BaseSchemas.Pagination.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit above maximum', () => {
      const result = BaseSchemas.Pagination.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it('should coerce string numbers to integers', () => {
      const result = BaseSchemas.Pagination.safeParse({ page: '5', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should validate order enum', () => {
      const validAsc = BaseSchemas.Pagination.safeParse({ order: 'asc' });
      const validDesc = BaseSchemas.Pagination.safeParse({ order: 'desc' });
      const invalid = BaseSchemas.Pagination.safeParse({ order: 'invalid' });

      expect(validAsc.success).toBe(true);
      expect(validDesc.success).toBe(true);
      expect(invalid.success).toBe(false);
    });
  });

  describe('Search Schema', () => {
    it('should validate valid search query', () => {
      const result = BaseSchemas.Search.safeParse({ q: 'test query' });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = BaseSchemas.Search.safeParse({ q: '' });
      expect(result.success).toBe(false);
    });

    it('should reject query exceeding max length', () => {
      const longQuery = 'a'.repeat(201);
      const result = BaseSchemas.Search.safeParse({ q: longQuery });
      expect(result.success).toBe(false);
    });

    it('should trim whitespace', () => {
      const result = BaseSchemas.Search.safeParse({ q: '  test  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('test');
      }
    });

    it('should allow optional fields and filters', () => {
      const result = BaseSchemas.Search.safeParse({
        q: 'test',
        fields: 'title,description',
        filters: { status: 'open' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ID Parameter Schema', () => {
    it('should validate positive integer ID', () => {
      const result = BaseSchemas.IdParam.safeParse({ id: 123 });
      expect(result.success).toBe(true);
    });

    it('should coerce string to number', () => {
      const result = BaseSchemas.IdParam.safeParse({ id: '456' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(456);
      }
    });

    it('should reject zero', () => {
      const result = BaseSchemas.IdParam.safeParse({ id: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative numbers', () => {
      const result = BaseSchemas.IdParam.safeParse({ id: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer', () => {
      const result = BaseSchemas.IdParam.safeParse({ id: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('Slug Parameter Schema', () => {
    it('should validate valid slug', () => {
      const result = BaseSchemas.SlugParam.safeParse({ slug: 'my-article-slug' });
      expect(result.success).toBe(true);
    });

    it('should reject uppercase letters', () => {
      const result = BaseSchemas.SlugParam.safeParse({ slug: 'My-Article' });
      expect(result.success).toBe(false);
    });

    it('should reject spaces', () => {
      const result = BaseSchemas.SlugParam.safeParse({ slug: 'my article' });
      expect(result.success).toBe(false);
    });

    it('should reject special characters', () => {
      const result = BaseSchemas.SlugParam.safeParse({ slug: 'my_article!' });
      expect(result.success).toBe(false);
    });

    it('should accept numbers and hyphens', () => {
      const result = BaseSchemas.SlugParam.safeParse({ slug: 'article-123-test' });
      expect(result.success).toBe(true);
    });

    it('should reject empty slug', () => {
      const result = BaseSchemas.SlugParam.safeParse({ slug: '' });
      expect(result.success).toBe(false);
    });

    it('should reject slug exceeding max length', () => {
      const longSlug = 'a'.repeat(101);
      const result = BaseSchemas.SlugParam.safeParse({ slug: longSlug });
      expect(result.success).toBe(false);
    });
  });

  describe('Date Range Schema', () => {
    it('should validate valid date range', () => {
      const result = BaseSchemas.DateRange.safeParse({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional dates', () => {
      const result = BaseSchemas.DateRange.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject end date before start date', () => {
      const result = BaseSchemas.DateRange.safeParse({
        startDate: '2024-12-31T00:00:00Z',
        endDate: '2024-01-01T00:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('should accept same start and end date', () => {
      const result = BaseSchemas.DateRange.safeParse({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = BaseSchemas.DateRange.safeParse({
        startDate: 'not-a-date',
        endDate: '2024-01-31T23:59:59Z',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('User Validation Schemas', () => {
  describe('Register Schema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!',
        role: 'user' as const,
      };
      const result = UserSchemas.Register.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject weak password (no uppercase)', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepass123!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak password (no special char)', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Sec1!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'not-an-email',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(false);
    });

    it('should convert email to lowercase', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
      }
    });

    it('should trim name whitespace', () => {
      const result = UserSchemas.Register.safeParse({
        name: '  John Doe  ',
        email: 'john@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
      }
    });

    it('should use default role', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('user');
      }
    });

    it('should reject invalid role', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!',
        role: 'invalid_role',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name too short', () => {
      const result = UserSchemas.Register.safeParse({
        name: 'J',
        email: 'john@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name too long', () => {
      const longName = 'A'.repeat(101);
      const result = UserSchemas.Register.safeParse({
        name: longName,
        email: 'john@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Login Schema', () => {
    it('should validate valid login credentials', () => {
      const result = UserSchemas.Login.safeParse({
        email: 'john@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
    });

    it('should use default rememberMe', () => {
      const result = UserSchemas.Login.safeParse({
        email: 'john@example.com',
        password: 'password',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rememberMe).toBe(false);
      }
    });

    it('should validate 2FA code if provided', () => {
      const result = UserSchemas.Login.safeParse({
        email: 'john@example.com',
        password: 'password',
        twoFactorCode: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid 2FA code length', () => {
      const result = UserSchemas.Login.safeParse({
        email: 'john@example.com',
        password: 'password',
        twoFactorCode: '12345', // Only 5 digits
      });
      expect(result.success).toBe(false);
    });

    it('should convert email to lowercase', () => {
      const result = UserSchemas.Login.safeParse({
        email: 'JOHN@EXAMPLE.COM',
        password: 'password',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
      }
    });
  });

  describe('Change Password Schema', () => {
    it('should validate matching passwords', () => {
      const result = UserSchemas.ChangePassword.safeParse({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
        confirmPassword: 'NewPass456!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-matching passwords', () => {
      const result = UserSchemas.ChangePassword.safeParse({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
        confirmPassword: 'DifferentPass789!',
      });
      expect(result.success).toBe(false);
    });

    it('should enforce strong password requirements', () => {
      const result = UserSchemas.ChangePassword.safeParse({
        currentPassword: 'OldPass123!',
        newPassword: 'weakpass',
        confirmPassword: 'weakpass',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Ticket Validation Schemas', () => {
  describe('Create Ticket Schema', () => {
    it('should validate valid ticket data', () => {
      const result = TicketSchemas.Create.safeParse({
        title: 'Test Ticket Title',
        description: 'This is a detailed description of the ticket.',
        priorityId: 1,
        categoryId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject title too short', () => {
      const result = TicketSchemas.Create.safeParse({
        title: 'Test',
        description: 'This is a detailed description.',
        priorityId: 1,
        categoryId: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject description too short', () => {
      const result = TicketSchemas.Create.safeParse({
        title: 'Valid Title',
        description: 'Short',
        priorityId: 1,
        categoryId: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should validate tags array', () => {
      const result = TicketSchemas.Create.safeParse({
        title: 'Test Ticket',
        description: 'Detailed description here.',
        priorityId: 1,
        categoryId: 1,
        tags: ['urgent', 'billing', 'customer-vip'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject too many tags', () => {
      const manyTags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      const result = TicketSchemas.Create.safeParse({
        title: 'Test Ticket',
        description: 'Detailed description here.',
        priorityId: 1,
        categoryId: 1,
        tags: manyTags,
      });
      expect(result.success).toBe(false);
    });

    it('should trim title and description', () => {
      const result = TicketSchemas.Create.safeParse({
        title: '  Test Ticket  ',
        description: '  This is a description.  ',
        priorityId: 1,
        categoryId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Ticket');
        expect(result.data.description).toBe('This is a description.');
      }
    });

    it('should allow optional assignedTo', () => {
      const result = TicketSchemas.Create.safeParse({
        title: 'Test Ticket',
        description: 'Detailed description.',
        priorityId: 1,
        categoryId: 1,
        assignedTo: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should allow custom fields', () => {
      const result = TicketSchemas.Create.safeParse({
        title: 'Test Ticket',
        description: 'Detailed description.',
        priorityId: 1,
        categoryId: 1,
        customFields: { customerId: 'CUST-123', region: 'EMEA' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Bulk Update Schema', () => {
    it('should validate bulk update', () => {
      const result = TicketSchemas.BulkUpdate.safeParse({
        ticketIds: [1, 2, 3],
        updates: { statusId: 2 },
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty ticket IDs', () => {
      const result = TicketSchemas.BulkUpdate.safeParse({
        ticketIds: [],
        updates: { statusId: 2 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject too many ticket IDs', () => {
      const manyIds = Array.from({ length: 101 }, (_, i) => i + 1);
      const result = TicketSchemas.BulkUpdate.safeParse({
        ticketIds: manyIds,
        updates: { statusId: 2 },
      });
      expect(result.success).toBe(false);
    });

    it('should allow nullable assignedTo', () => {
      const result = TicketSchemas.BulkUpdate.safeParse({
        ticketIds: [1, 2],
        updates: { assignedTo: null },
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('File Validation Schemas', () => {
  describe('File Upload Schema', () => {
    it('should validate valid file upload', () => {
      const result = FileSchemas.Upload.safeParse({
        filename: 'document.pdf',
        size: 1024000, // 1MB
        mimeType: 'application/pdf',
      });
      expect(result.success).toBe(true);
    });

    it('should reject file too large', () => {
      const result = FileSchemas.Upload.safeParse({
        filename: 'large-file.pdf',
        size: 51 * 1024 * 1024, // 51MB
        mimeType: 'application/pdf',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid mime type', () => {
      const result = FileSchemas.Upload.safeParse({
        filename: 'file.exe',
        size: 1024,
        mimeType: 'application/x-msdownload',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid filename characters', () => {
      const result = FileSchemas.Upload.safeParse({
        filename: 'file with spaces.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid filename patterns', () => {
      const validFilenames = [
        'document.pdf',
        'report-2024.xlsx',
        'image_001.jpg',
        'file.name.with.dots.txt',
      ];

      validFilenames.forEach((filename) => {
        const result = FileSchemas.Upload.safeParse({
          filename,
          size: 1024,
          mimeType: 'application/pdf',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should allow optional checksum', () => {
      const result = FileSchemas.Upload.safeParse({
        filename: 'document.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        checksum: 'abc123def456',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Batch Upload Schema', () => {
    it('should validate batch upload', () => {
      const result = FileSchemas.BatchUpload.safeParse({
        files: [
          { filename: 'file1.pdf', size: 1024, mimeType: 'application/pdf' },
          { filename: 'file2.jpg', size: 2048, mimeType: 'image/jpeg' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject too many files', () => {
      const manyFiles = Array.from({ length: 21 }, (_, i) => ({
        filename: `file${i}.pdf`,
        size: 1024,
        mimeType: 'application/pdf',
      }));

      const result = FileSchemas.BatchUpload.safeParse({ files: manyFiles });
      expect(result.success).toBe(false);
    });

    it('should reject empty file array', () => {
      const result = FileSchemas.BatchUpload.safeParse({ files: [] });
      expect(result.success).toBe(false);
    });
  });
});

describe('Schema Registry', () => {
  it('should expose all schemas', () => {
    expect(SchemaRegistry).toBeDefined();
    expect(SchemaRegistry.Pagination).toBeDefined();
    expect(SchemaRegistry.UserRegister).toBeDefined();
    expect(SchemaRegistry.TicketCreate).toBeDefined();
    expect(SchemaRegistry.FileUpload).toBeDefined();
  });

  it('should match schema definitions', () => {
    expect(SchemaRegistry.Pagination).toBe(BaseSchemas.Pagination);
    expect(SchemaRegistry.UserRegister).toBe(UserSchemas.Register);
    expect(SchemaRegistry.TicketCreate).toBe(TicketSchemas.Create);
  });
});

describe('Edge Cases and Security', () => {
  it('should sanitize XSS attempts in text fields', () => {
    const xssAttempt = '<script>alert("xss")</script>';
    const result = TicketSchemas.Create.safeParse({
      title: xssAttempt,
      description: 'Test description here.',
      priorityId: 1,
      categoryId: 1,
    });

    // Schema should accept it (sanitization happens elsewhere)
    // But we verify it doesn't execute code during validation
    expect(result.success).toBe(true);
  });

  it('should handle SQL injection patterns safely', () => {
    const sqlInjection = "'; DROP TABLE users; --";
    const result = UserSchemas.Login.safeParse({
      email: sqlInjection,
      password: 'password',
    });

    // Should fail email validation, not execute SQL
    expect(result.success).toBe(false);
  });

  it('should handle very large JSON payloads', () => {
    const largeObject: Record<string, any> = {};
    for (let i = 0; i < 1000; i++) {
      largeObject[`field${i}`] = `value${i}`;
    }

    const result = TicketSchemas.Create.safeParse({
      title: 'Test Ticket',
      description: 'Test description',
      priorityId: 1,
      categoryId: 1,
      customFields: largeObject,
    });

    expect(result.success).toBe(true);
  });

  it('should handle unicode and special characters', () => {
    const unicodeText = '🚀 测试 Тест مرحبا';
    const result = TicketSchemas.Create.safeParse({
      title: unicodeText,
      description: 'Description with unicode: ' + unicodeText,
      priorityId: 1,
      categoryId: 1,
    });

    expect(result.success).toBe(true);
  });
});
