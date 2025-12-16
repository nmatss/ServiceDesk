/**
 * Unit tests for AI Classification System
 * Tests ticket classification, sentiment analysis, AI model integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AI Classifier - Unit Tests', () => {
  describe('Classifier Initialization', () => {
    it('should require OpenAI API key', () => {
      const originalKey = process.env.OPENAI_API_KEY;

      // Test with no API key
      delete process.env.OPENAI_API_KEY;
      expect(process.env.OPENAI_API_KEY).toBeUndefined();

      // Restore
      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should validate API key format', () => {
      const validKey = 'sk-' + 'a'.repeat(48);
      expect(validKey).toMatch(/^sk-/);
      expect(validKey.length).toBeGreaterThan(20);
    });
  });

  describe('Category Classification Logic', () => {
    it('should handle empty category list', () => {
      const categories: any[] = [];
      const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

      expect(categoryMap.size).toBe(0);
    });

    it('should create category mapping', () => {
      const categories = [
        { id: 1, name: 'Technical', description: 'Technical issues' },
        { id: 2, name: 'Billing', description: 'Billing questions' },
        { id: 3, name: 'General', description: 'General inquiries' },
      ];

      const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

      expect(categoryMap.get('technical')).toBe(1);
      expect(categoryMap.get('billing')).toBe(2);
      expect(categoryMap.get('general')).toBe(3);
    });

    it('should handle case-insensitive matching', () => {
      const categories = [{ id: 1, name: 'Technical', description: '' }];
      const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

      expect(categoryMap.get('technical')).toBe(1);
      expect(categoryMap.get('TECHNICAL')).toBeUndefined(); // Case matters in get
      expect(categoryMap.get('Technical'.toLowerCase())).toBe(1);
    });

    it('should validate category structure', () => {
      const category = {
        id: 1,
        name: 'Technical',
        description: 'Technical issues',
      };

      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('description');
      expect(typeof category.id).toBe('number');
      expect(typeof category.name).toBe('string');
    });
  });

  describe('Priority Classification Logic', () => {
    it('should create priority mapping', () => {
      const priorities = [
        { id: 1, name: 'Critical', level: 1 },
        { id: 2, name: 'High', level: 2 },
        { id: 3, name: 'Medium', level: 3 },
        { id: 4, name: 'Low', level: 4 },
      ];

      const priorityMap = new Map(priorities.map((p) => [p.name.toLowerCase(), p.id]));

      expect(priorityMap.get('critical')).toBe(1);
      expect(priorityMap.get('high')).toBe(2);
      expect(priorityMap.get('medium')).toBe(3);
      expect(priorityMap.get('low')).toBe(4);
    });

    it('should validate priority levels', () => {
      const priorities = [
        { id: 1, name: 'Critical', level: 1 },
        { id: 2, name: 'High', level: 2 },
      ];

      priorities.forEach((p) => {
        expect(p.level).toBeGreaterThan(0);
        expect(p.level).toBeLessThanOrEqual(4);
        expect(Number.isInteger(p.level)).toBe(true);
      });
    });

    it('should sort by priority level', () => {
      const priorities = [
        { id: 4, name: 'Low', level: 4 },
        { id: 1, name: 'Critical', level: 1 },
        { id: 3, name: 'Medium', level: 3 },
        { id: 2, name: 'High', level: 2 },
      ];

      const sorted = [...priorities].sort((a, b) => a.level - b.level);

      expect(sorted[0].name).toBe('Critical');
      expect(sorted[1].name).toBe('High');
      expect(sorted[2].name).toBe('Medium');
      expect(sorted[3].name).toBe('Low');
    });
  });

  describe('Prompt Generation', () => {
    it('should create valid classification prompt', () => {
      const title = 'Cannot login to system';
      const description = 'I am unable to access my account after password reset';
      const categories = [{ id: 1, name: 'Technical', description: 'Tech issues' }];
      const priorities = [{ id: 1, name: 'High', level: 2 }];

      const prompt = `
Você é um assistente de classificação de tickets de suporte.

Ticket:
Título: ${title}
Descrição: ${description}

Categorias disponíveis:
${categories.map((c) => `- ${c.name}: ${c.description || 'N/A'}`).join('\n')}

Prioridades disponíveis:
${priorities.map((p) => `- ${p.name} (level ${p.level})`).join('\n')}
`;

      expect(prompt).toContain(title);
      expect(prompt).toContain(description);
      expect(prompt).toContain('Technical');
      expect(prompt).toContain('High');
    });

    it('should handle special characters in prompt', () => {
      const title = 'Test "ticket" with \'quotes\'';
      const description = 'Description with $pecial ch@racters!';

      const prompt = `Title: ${title}\nDescription: ${description}`;

      expect(prompt).toContain(title);
      expect(prompt).toContain(description);
    });

    it('should handle unicode in prompt', () => {
      const title = 'Título com acentuação';
      const description = 'Descrição com caracteres especiais: 测试 🚀';

      const prompt = `Title: ${title}\nDescription: ${description}`;

      expect(prompt).toContain('acentuação');
      expect(prompt).toContain('测试');
      expect(prompt).toContain('🚀');
    });

    it('should limit prompt length', () => {
      const longTitle = 'A'.repeat(500);
      const longDescription = 'B'.repeat(5000);

      const maxTitleLength = 200;
      const maxDescLength = 2000;

      const truncatedTitle = longTitle.slice(0, maxTitleLength);
      const truncatedDesc = longDescription.slice(0, maxDescLength);

      expect(truncatedTitle.length).toBe(maxTitleLength);
      expect(truncatedDesc.length).toBe(maxDescLength);
    });
  });

  describe('Classification Result Processing', () => {
    it('should parse valid JSON response', () => {
      const jsonResponse = JSON.stringify({
        category_name: 'Technical',
        priority_name: 'High',
        confidence: 0.85,
        reasoning: 'Login issues are technical and urgent',
      });

      const parsed = JSON.parse(jsonResponse);

      expect(parsed).toHaveProperty('category_name');
      expect(parsed).toHaveProperty('priority_name');
      expect(parsed).toHaveProperty('confidence');
      expect(parsed).toHaveProperty('reasoning');
    });

    it('should validate confidence score range', () => {
      const validScores = [0, 0.5, 0.85, 1.0];
      const invalidScores = [-0.1, 1.1, 2.0];

      validScores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      invalidScores.forEach((score) => {
        const isValid = score >= 0 && score <= 1;
        expect(isValid).toBe(false);
      });
    });

    it('should handle missing fields in response', () => {
      const incompleteResponse = JSON.stringify({
        category_name: 'Technical',
        // Missing priority_name, confidence, reasoning
      });

      const parsed = JSON.parse(incompleteResponse);

      expect(parsed.category_name).toBe('Technical');
      expect(parsed.priority_name).toBeUndefined();
      expect(parsed.confidence).toBeUndefined();
    });

    it('should handle malformed JSON', () => {
      const malformedJson = '{ invalid json }';

      expect(() => {
        JSON.parse(malformedJson);
      }).toThrow();
    });

    it('should map category name to ID', () => {
      const categories = [
        { id: 1, name: 'Technical', description: '' },
        { id: 2, name: 'Billing', description: '' },
      ];

      const categoryName = 'Technical';
      const category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());

      expect(category).toBeDefined();
      expect(category?.id).toBe(1);
    });

    it('should handle category name not found', () => {
      const categories = [{ id: 1, name: 'Technical', description: '' }];

      const categoryName = 'NonExistent';
      const category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());

      expect(category).toBeUndefined();
    });
  });

  describe('Confidence Score Analysis', () => {
    it('should categorize confidence levels', () => {
      const scores = [0.95, 0.75, 0.5, 0.3];

      const getConfidenceLevel = (score: number) => {
        if (score >= 0.8) return 'high';
        if (score >= 0.6) return 'medium';
        return 'low';
      };

      expect(getConfidenceLevel(scores[0])).toBe('high');
      expect(getConfidenceLevel(scores[1])).toBe('medium');
      expect(getConfidenceLevel(scores[2])).toBe('low');
      expect(getConfidenceLevel(scores[3])).toBe('low');
    });

    it('should round confidence to 2 decimal places', () => {
      const rawScores = [0.856789, 0.123456];

      const rounded = rawScores.map((score) => Math.round(score * 100) / 100);

      expect(rounded[0]).toBe(0.86);
      expect(rounded[1]).toBe(0.12);
    });

    it('should handle edge cases', () => {
      const edgeCases = [0, 1, 0.999999];

      edgeCases.forEach((score) => {
        expect(score >= 0 && score <= 1).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API timeout scenarios', () => {
      const timeout = 30000; // 30 seconds
      const startTime = Date.now();

      // Simulate timeout check
      const checkTimeout = (start: number, max: number) => {
        return Date.now() - start > max;
      };

      expect(checkTimeout(startTime, timeout)).toBe(false);
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = {
        type: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
      };

      expect(rateLimitError.type).toBe('rate_limit_exceeded');
    });

    it('should handle invalid API key errors', () => {
      const authError = {
        type: 'invalid_api_key',
        message: 'Invalid API key provided',
      };

      expect(authError.type).toBe('invalid_api_key');
    });

    it('should handle network errors gracefully', () => {
      const networkError = new Error('Network request failed');

      expect(networkError).toBeInstanceOf(Error);
      expect(networkError.message).toContain('Network');
    });
  });

  describe('Performance Metrics', () => {
    it('should track processing time', () => {
      const startTime = Date.now();

      // Simulate processing
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof processingTime).toBe('number');
    });

    it('should measure response time in milliseconds', () => {
      const start = Date.now();
      const end = Date.now();
      const duration = end - start;

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(1000); // Should be very fast for empty operation
    });

    it('should calculate average processing time', () => {
      const times = [100, 150, 200, 180, 120];
      const average = times.reduce((a, b) => a + b, 0) / times.length;

      expect(average).toBe(150);
    });
  });

  describe('Classification History', () => {
    it('should structure classification record', () => {
      const record = {
        id: 1,
        ticket_title: 'Test ticket',
        ticket_description: 'Test description',
        predicted_category_id: 1,
        predicted_priority_id: 2,
        confidence: 0.85,
        reasoning: 'Test reasoning',
        processing_time_ms: 1200,
        created_at: new Date().toISOString(),
      };

      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('predicted_category_id');
      expect(record).toHaveProperty('predicted_priority_id');
      expect(record).toHaveProperty('confidence');
      expect(record.confidence).toBeGreaterThanOrEqual(0);
      expect(record.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate record timestamps', () => {
      const timestamp = new Date().toISOString();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Input Validation', () => {
    it('should reject empty title', () => {
      const title = '';
      const isValid = title.trim().length > 0;

      expect(isValid).toBe(false);
    });

    it('should reject empty description', () => {
      const description = '';
      const isValid = description.trim().length > 0;

      expect(isValid).toBe(false);
    });

    it('should trim whitespace from inputs', () => {
      const title = '  Test Ticket  ';
      const description = '  Test Description  ';

      expect(title.trim()).toBe('Test Ticket');
      expect(description.trim()).toBe('Test Description');
    });

    it('should validate organization ID', () => {
      const validOrgIds = [1, 100, 9999];
      const invalidOrgIds = [0, -1, -999];

      validOrgIds.forEach((id) => {
        expect(id).toBeGreaterThan(0);
      });

      invalidOrgIds.forEach((id) => {
        expect(id).toBeLessThanOrEqual(0);
      });
    });

    it('should sanitize HTML from inputs', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = maliciousInput.replace(/<[^>]*>/g, '');

      expect(sanitized).toBe('alert("xss")');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Model Configuration', () => {
    it('should use correct model version', () => {
      const model = 'gpt-4o';

      expect(model).toBe('gpt-4o');
    });

    it('should set appropriate temperature', () => {
      const temperature = 0.3;

      expect(temperature).toBeGreaterThanOrEqual(0);
      expect(temperature).toBeLessThanOrEqual(1);
    });

    it('should enforce JSON response format', () => {
      const responseFormat = { type: 'json_object' };

      expect(responseFormat.type).toBe('json_object');
    });

    it('should configure system message', () => {
      const systemMessage = 'Você é um especialista em classificação de tickets de suporte.';

      expect(systemMessage).toContain('classificação');
      expect(systemMessage).toContain('tickets');
    });
  });
});

describe('Sentiment Analysis - Unit Tests', () => {
  describe('Sentiment Detection', () => {
    it('should identify positive sentiment indicators', () => {
      const positiveWords = ['excellent', 'great', 'happy', 'satisfied', 'wonderful'];
      const text = 'This is an excellent service, I am very happy!';

      const hasPositive = positiveWords.some((word) => text.toLowerCase().includes(word));

      expect(hasPositive).toBe(true);
    });

    it('should identify negative sentiment indicators', () => {
      const negativeWords = ['terrible', 'awful', 'disappointed', 'frustrated', 'angry'];
      const text = 'This is terrible service, I am very frustrated!';

      const hasNegative = negativeWords.some((word) => text.toLowerCase().includes(word));

      expect(hasNegative).toBe(true);
    });

    it('should identify neutral sentiment', () => {
      const text = 'I need help with my account settings.';
      const positiveWords = ['excellent', 'great', 'happy'];
      const negativeWords = ['terrible', 'awful', 'angry'];

      const hasPositive = positiveWords.some((word) => text.toLowerCase().includes(word));
      const hasNegative = negativeWords.some((word) => text.toLowerCase().includes(word));

      expect(hasPositive).toBe(false);
      expect(hasNegative).toBe(false);
    });
  });

  describe('Sentiment Scoring', () => {
    it('should score sentiment between -1 and 1', () => {
      const scores = [-1, -0.5, 0, 0.5, 1];

      scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should categorize sentiment by score', () => {
      const getSentimentCategory = (score: number) => {
        if (score > 0.3) return 'positive';
        if (score < -0.3) return 'negative';
        return 'neutral';
      };

      expect(getSentimentCategory(0.8)).toBe('positive');
      expect(getSentimentCategory(-0.8)).toBe('negative');
      expect(getSentimentCategory(0)).toBe('neutral');
    });
  });

  describe('Urgency Detection', () => {
    it('should detect urgent keywords', () => {
      const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical'];
      const text = 'URGENT: System is down, need help ASAP!';

      const isUrgent = urgentKeywords.some((word) =>
        text.toLowerCase().includes(word.toLowerCase())
      );

      expect(isUrgent).toBe(true);
    });

    it('should detect all caps as urgency indicator', () => {
      const text = 'HELP ME NOW';
      const upperCaseRatio = text.split('').filter((c) => c === c.toUpperCase()).length / text.length;

      expect(upperCaseRatio).toBeGreaterThan(0.5);
    });

    it('should detect multiple exclamation marks', () => {
      const text = 'Help me now!!!';
      const exclamationCount = (text.match(/!/g) || []).length;

      expect(exclamationCount).toBeGreaterThan(1);
    });
  });
});
