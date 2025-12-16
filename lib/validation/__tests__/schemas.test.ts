/**
 * Unit Tests for Validation Schemas
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  commonSchemas,
  userSchemas,
  ticketSchemas,
  commentSchemas,
  categorySchemas,
  prioritySchemas,
  statusSchemas,
  attachmentSchemas,
  slaSchemas,
  organizationSchemas,
} from '../schemas'

describe('Common Schemas', () => {
  describe('id', () => {
    it('should accept positive integers', () => {
      expect(commonSchemas.id.parse(1)).toBe(1)
      expect(commonSchemas.id.parse(999)).toBe(999)
    })

    it('should reject zero and negative numbers', () => {
      expect(() => commonSchemas.id.parse(0)).toThrow()
      expect(() => commonSchemas.id.parse(-1)).toThrow()
    })

    it('should reject non-integers', () => {
      expect(() => commonSchemas.id.parse(1.5)).toThrow()
      expect(() => commonSchemas.id.parse('1')).toThrow()
    })
  })

  describe('email', () => {
    it('should accept valid emails', () => {
      expect(commonSchemas.email.parse('test@example.com')).toBe('test@example.com')
      expect(commonSchemas.email.parse('user.name+tag@domain.co.uk')).toBe('user.name+tag@domain.co.uk')
    })

    it('should reject invalid emails', () => {
      expect(() => commonSchemas.email.parse('invalid')).toThrow()
      expect(() => commonSchemas.email.parse('test@')).toThrow()
      expect(() => commonSchemas.email.parse('@domain.com')).toThrow()
    })
  })

  describe('slug', () => {
    it('should accept valid slugs', () => {
      expect(commonSchemas.slug.parse('test-slug')).toBe('test-slug')
      expect(commonSchemas.slug.parse('demo123')).toBe('demo123')
    })

    it('should reject invalid slugs', () => {
      expect(() => commonSchemas.slug.parse('Test_Slug')).toThrow() // uppercase
      expect(() => commonSchemas.slug.parse('test slug')).toThrow() // space
      expect(() => commonSchemas.slug.parse('test_slug')).toThrow() // underscore
    })
  })

  describe('password', () => {
    it('should accept strong passwords', () => {
      // Password requirements: 12+ chars, uppercase, lowercase, number, special char
      expect(commonSchemas.password.parse('SecurePass1!')).toBe('SecurePass1!')
      expect(commonSchemas.password.parse('MyPassword@123')).toBe('MyPassword@123')
      expect(commonSchemas.password.parse('Str0ng!Pass#2024')).toBe('Str0ng!Pass#2024')
    })

    it('should reject weak passwords', () => {
      expect(() => commonSchemas.password.parse('short')).toThrow() // too short
      expect(() => commonSchemas.password.parse('password')).toThrow() // no uppercase or number
      expect(() => commonSchemas.password.parse('PASSWORD123!')).toThrow() // no lowercase
      expect(() => commonSchemas.password.parse('Password123')).toThrow() // no special char
      expect(() => commonSchemas.password.parse('Pass!word')).toThrow() // no number + too short
    })
  })
})

describe('User Schemas', () => {
  describe('create', () => {
    it('should validate correct user creation data', () => {
      const validUser = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass@123',
        role: 'user',
        organization_id: 1,
      }

      const result = userSchemas.create.parse(validUser)
      expect(result).toEqual(validUser)
    })

    it('should reject invalid role', () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass@123',
        role: 'invalid_role',
        organization_id: 1,
      }

      expect(() => userSchemas.create.parse(invalidUser)).toThrow()
    })

    it('should reject missing required fields', () => {
      const incompleteUser = {
        name: 'John Doe',
        email: 'john@example.com',
        // missing password, role, organization_id
      }

      expect(() => userSchemas.create.parse(incompleteUser)).toThrow()
    })
  })

  describe('login', () => {
    it('should validate login credentials', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'SecurePass@123',
      }

      const result = userSchemas.login.parse(validLogin)
      expect(result).toEqual(validLogin)
    })

    it('should reject invalid email', () => {
      expect(() => userSchemas.login.parse({
        email: 'invalid-email',
        password: 'SecurePass@123',
      })).toThrow()
    })
  })
})

describe('Ticket Schemas', () => {
  describe('create', () => {
    it('should validate ticket creation', () => {
      const validTicket = {
        title: 'Test Ticket',
        description: 'This is a test ticket',
        category_id: 1,
        priority_id: 2,
        organization_id: 1,
        user_id: 1,
      }

      const result = ticketSchemas.create.parse(validTicket)
      expect(result).toEqual(validTicket)
    })

    it('should reject empty title', () => {
      expect(() => ticketSchemas.create.parse({
        title: '',
        description: 'Description',
        category_id: 1,
        priority_id: 2,
        organization_id: 1,
        user_id: 1,
      })).toThrow()
    })

    it('should reject title exceeding max length', () => {
      expect(() => ticketSchemas.create.parse({
        title: 'a'.repeat(501),
        description: 'Description',
        category_id: 1,
        priority_id: 2,
        organization_id: 1,
        user_id: 1,
      })).toThrow()
    })

    it('should validate optional tags array', () => {
      const ticketWithTags = {
        title: 'Test Ticket',
        description: 'Description',
        category_id: 1,
        priority_id: 2,
        organization_id: 1,
        user_id: 1,
        tags: ['bug', 'urgent'],
      }

      const result = ticketSchemas.create.parse(ticketWithTags)
      expect(result.tags).toEqual(['bug', 'urgent'])
    })

    it('should reject too many tags', () => {
      expect(() => ticketSchemas.create.parse({
        title: 'Test',
        description: 'Description',
        category_id: 1,
        priority_id: 2,
        organization_id: 1,
        user_id: 1,
        tags: Array(11).fill('tag'), // max is 10
      })).toThrow()
    })
  })

  describe('update', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        id: 1,
        title: 'Updated Title',
      }

      const result = ticketSchemas.update.parse(partialUpdate)
      expect(result).toEqual(partialUpdate)
    })

    it('should require id', () => {
      expect(() => ticketSchemas.update.parse({
        title: 'Updated Title',
      })).toThrow()
    })
  })

  describe('query', () => {
    it('should validate query parameters', () => {
      const query = {
        page: 1,
        limit: 25,
        status_id: 1,
        priority_id: 2,
      }

      const result = ticketSchemas.query.parse(query)
      expect(result).toEqual(query)
    })

    it('should use default values', () => {
      const emptyQuery = {}
      const result = ticketSchemas.query.parse(emptyQuery)

      expect(result.page).toBe(1)
      expect(result.limit).toBe(25)
    })

    it('should enforce limit bounds', () => {
      expect(() => ticketSchemas.query.parse({ limit: 0 })).toThrow()
      expect(() => ticketSchemas.query.parse({ limit: 101 })).toThrow()
    })
  })
})

describe('Comment Schemas', () => {
  describe('create', () => {
    it('should validate comment creation', () => {
      const validComment = {
        ticket_id: 1,
        user_id: 1,
        content: 'This is a comment',
        is_internal: false,
      }

      const result = commentSchemas.create.parse(validComment)
      expect(result).toEqual(validComment)
    })

    it('should reject empty content', () => {
      expect(() => commentSchemas.create.parse({
        ticket_id: 1,
        user_id: 1,
        content: '',
      })).toThrow()
    })

    it('should reject content exceeding max length', () => {
      expect(() => commentSchemas.create.parse({
        ticket_id: 1,
        user_id: 1,
        content: 'a'.repeat(10001),
      })).toThrow()
    })
  })
})

describe('Category Schemas', () => {
  describe('create', () => {
    it('should validate category creation', () => {
      const validCategory = {
        name: 'Technical Support',
        description: 'Technical issues',
        color: '#3B82F6',
        icon: 'wrench',
        organization_id: 1,
      }

      const result = categorySchemas.create.parse(validCategory)
      expect(result).toEqual(validCategory)
    })

    it('should validate hex color format', () => {
      expect(() => categorySchemas.create.parse({
        name: 'Category',
        color: 'invalid-color',
        organization_id: 1,
      })).toThrow()

      // Valid hex colors
      expect(categorySchemas.create.parse({
        name: 'Category',
        color: '#FF0000',
        organization_id: 1,
      })).toBeTruthy()

      expect(categorySchemas.create.parse({
        name: 'Category',
        color: '#f00',
        organization_id: 1,
      })).toBeTruthy()
    })
  })
})

describe('Organization Schemas', () => {
  describe('create', () => {
    it('should validate organization creation', () => {
      const validOrg = {
        name: 'Test Company',
        slug: 'test-company',
        domain: 'testcompany.com',
      }

      const result = organizationSchemas.create.parse(validOrg)
      expect(result).toEqual(validOrg)
    })

    it('should validate domain format', () => {
      expect(() => organizationSchemas.create.parse({
        name: 'Test',
        slug: 'test',
        domain: 'invalid domain',
      })).toThrow()

      // Valid domains
      expect(organizationSchemas.create.parse({
        name: 'Test',
        slug: 'test',
        domain: 'example.com',
      })).toBeTruthy()

      expect(organizationSchemas.create.parse({
        name: 'Test',
        slug: 'test',
        domain: 'sub.example.co.uk',
      })).toBeTruthy()
    })
  })
})

describe('SLA Schemas', () => {
  describe('create', () => {
    it('should validate SLA policy creation', () => {
      const validSLA = {
        name: 'Critical Issues SLA',
        priority_id: 1,
        response_time_hours: 1,
        resolution_time_hours: 4,
        organization_id: 1,
      }

      const result = slaSchemas.create.parse(validSLA)
      expect(result).toEqual(validSLA)
    })

    it('should enforce positive time values', () => {
      expect(() => slaSchemas.create.parse({
        name: 'SLA',
        priority_id: 1,
        response_time_hours: 0,
        resolution_time_hours: 4,
        organization_id: 1,
      })).toThrow()

      expect(() => slaSchemas.create.parse({
        name: 'SLA',
        priority_id: 1,
        response_time_hours: 1,
        resolution_time_hours: -1,
        organization_id: 1,
      })).toThrow()
    })
  })
})

describe('Attachment Schemas', () => {
  describe('create', () => {
    it('should validate attachment creation', () => {
      const validAttachment = {
        ticket_id: 1,
        filename: 'document.pdf',
        file_path: '/uploads/document.pdf',
        mime_type: 'application/pdf',
        file_size: 102400,
        uploaded_by: 1,
      }

      const result = attachmentSchemas.create.parse(validAttachment)
      expect(result).toEqual(validAttachment)
    })

    it('should enforce max file size (50MB)', () => {
      expect(() => attachmentSchemas.create.parse({
        ticket_id: 1,
        filename: 'large.pdf',
        file_path: '/uploads/large.pdf',
        mime_type: 'application/pdf',
        file_size: 52428801, // 50MB + 1 byte
        uploaded_by: 1,
      })).toThrow()
    })

    it('should accept files up to 50MB', () => {
      const attachment = attachmentSchemas.create.parse({
        ticket_id: 1,
        filename: 'large.pdf',
        file_path: '/uploads/large.pdf',
        mime_type: 'application/pdf',
        file_size: 52428800, // exactly 50MB
        uploaded_by: 1,
      })

      expect(attachment.file_size).toBe(52428800)
    })
  })
})
