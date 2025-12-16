/**
 * Unit Tests for AI Training System
 * Tests training data collection, feedback processing, and model performance calculation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AITrainingSystem, type TrainingConfig } from '@/lib/ai/training-system';
import type Database from '@/lib/db/connection';

// Mock database
const createMockDb = (): Database => {
  const store = new Map<string, any[]>();

  // Create mock for better-sqlite3's prepare() API
  const mockDb = {
    prepare: vi.fn((query: string) => {
      // Return a statement object with methods that can be called with params
      return {
        all: vi.fn((...params: any[]) => {
          // Try to find a match in the store
          for (const [key, value] of store.entries()) {
            const [storedPattern, storedParams] = key.split('|||');

            // Check if query matches the pattern
            if (query.includes(storedPattern)) {
              // Check if params match
              if (storedParams === JSON.stringify(params)) {
                return value;
              }
            }
          }

          return [];
        }),
        get: vi.fn((...params: any[]) => {
          // Try to find a match in the store
          for (const [key, value] of store.entries()) {
            const [storedPattern, storedParams] = key.split('|||');

            // Check if query matches the pattern
            if (query.includes(storedPattern)) {
              // Check if params match
              if (storedParams === JSON.stringify(params)) {
                return value[0] || null;
              }
            }
          }

          return null;
        }),
        run: vi.fn((..._params: any[]) => {
          const lastInsertRowid = Math.floor(Math.random() * 10000);
          return { lastInsertRowid, changes: 1 };
        }),
      };
    }),
    exec: vi.fn(),
    transaction: vi.fn((fn: any) => fn),
    setMockData: (queryPattern: string, params: any[], data: any[]) => {
      const key = `${queryPattern}|||${JSON.stringify(params)}`;
      store.set(key, data);
    },
    clearMockData: () => {
      store.clear();
    },
  };

  return mockDb as any;
};

describe('AITrainingSystem', () => {
  let db: Database;
  let trainingSystem: AITrainingSystem;

  beforeEach(() => {
    db = createMockDb();
    trainingSystem = new AITrainingSystem(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    (db as any).clearMockData();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default config', () => {
      const system = new AITrainingSystem(db);
      expect(system).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<TrainingConfig> = {
        minDataPoints: 500,
        accuracyThreshold: 0.92,
        retrainingInterval: 12,
        batchSize: 50,
        validationSplit: 0.3,
        autoRetrain: false,
      };

      const system = new AITrainingSystem(db, customConfig);
      expect(system).toBeDefined();
    });
  });

  describe('collectTrainingData', () => {
    it('should collect validated training data for classification', async () => {
      const mockData = [
        {
          id: 1,
          input_text: 'Password reset not working',
          expected_output: JSON.stringify({ category: 'Authentication', priority: 'high' }),
          actual_output: JSON.stringify({ category: 'Authentication', priority: 'high' }),
          data_type: 'classification',
          quality_score: 0.95,
          validated: 1,
          validation_source: 'user',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          input_text: 'Email not sending',
          expected_output: JSON.stringify({ category: 'Email', priority: 'medium' }),
          actual_output: JSON.stringify({ category: 'Email', priority: 'medium' }),
          data_type: 'classification',
          quality_score: 0.88,
          validated: 1,
          validation_source: 'expert',
          created_at: new Date().toISOString(),
        },
      ];

      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification'],
        mockData
      );

      const result = await trainingSystem.collectTrainingData('classification');

      expect(result).toHaveLength(2);
      expect(result[0]?.input_text).toBe('Password reset not working');
      expect(result[1]?.quality_score).toBe(0.88);
    });

    it('should filter by organization ID when provided', async () => {
      const mockData = [
        {
          id: 1,
          input_text: 'Test input',
          expected_output: '{}',
          actual_output: '{}',
          data_type: 'classification',
          quality_score: 0.9,
          validated: 1,
          validation_source: 'user',
          created_at: new Date().toISOString(),
        },
      ];

      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification', 123],
        mockData
      );

      const result = await trainingSystem.collectTrainingData('classification', 123);

      expect((db as any).prepare).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should only include validated high-quality data', async () => {
      // Mock should return empty array for low-quality or unvalidated data
      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification'],
        []
      );

      const result = await trainingSystem.collectTrainingData('classification');

      expect(result).toHaveLength(0);
    });
  });

  describe('addTrainingData', () => {
    it('should add new training data entry', async () => {
      const input = 'Cannot login to application';
      const expectedOutput = { category: 'Authentication', priority: 'high' };
      const actualOutput = { category: 'Authentication', priority: 'high' };

      const result = await trainingSystem.addTrainingData(
        input,
        expectedOutput,
        actualOutput,
        'classification',
        0.95,
        true,
        'user',
        123
      );

      expect((db as any).prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_training_data')
      );
      expect(result).toBeGreaterThan(0);
    });

    it('should handle unvalidated data', async () => {
      const result = await trainingSystem.addTrainingData(
        'Test input',
        { test: true },
        { test: true },
        'suggestion',
        0.75,
        false
      );

      expect((db as any).prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_training_data')
      );
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('processFeedback', () => {
    it('should process positive feedback', async () => {
      const mockClassification = {
        id: 1,
        ticket_id: 100,
        suggested_category: 'Hardware',
        suggested_priority: 'medium',
        confidence_score: 0.85,
        organization_id: 1,
      };

      (db as any).setMockData(
        'SELECT * FROM ai_classifications WHERE id = ?',
        [1],
        [mockClassification]
      );

      await trainingSystem.processFeedback(1, 'positive', undefined, undefined, 42);

      expect((db as any).prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_feedback')
      );
      expect((db as any).prepare).toHaveBeenCalledWith(
        'UPDATE ai_classifications SET feedback_received = 1 WHERE id = ?'
      );
    });

    it('should process negative feedback with corrections', async () => {
      const mockClassification = {
        id: 2,
        ticket_id: 200,
        suggested_category: 'Software',
        suggested_priority: 'low',
        confidence_score: 0.65,
        organization_id: 1,
      };

      const mockTicket = {
        title: 'Server is down',
        description: 'Production server crashed unexpectedly',
      };

      (db as any).setMockData(
        'SELECT * FROM ai_classifications WHERE id = ?',
        [2],
        [mockClassification]
      );

      (db as any).setMockData(
        'SELECT title, description FROM tickets WHERE id = ?',
        [200],
        [mockTicket]
      );

      await trainingSystem.processFeedback(
        2,
        'negative',
        'Infrastructure',
        'critical',
        42
      );

      expect((db as any).prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_feedback')
      );

      // Should add corrected data to training set
      expect((db as any).prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_training_data')
      );
    });

    it('should throw error for non-existent classification', async () => {
      (db as any).setMockData(
        'SELECT * FROM ai_classifications WHERE id = ?',
        [999],
        []
      );

      await expect(
        trainingSystem.processFeedback(999, 'positive')
      ).rejects.toThrow('Classification not found');
    });
  });

  describe('calculatePerformanceMetrics', () => {
    it('should calculate accurate performance metrics', async () => {
      (db as any).setMockData(
        'COUNT(*) as total FROM ai_classifications',
        [],
        [{ total: 150 }]
      );

      (db as any).setMockData(
        'COUNT(CASE WHEN af.feedback_type',
        [],
        [{ positive: 120, negative: 30 }]
      );

      (db as any).setMockData(
        'AVG(confidence_score)',
        [],
        [{ avg_confidence: 0.87 }]
      );

      const metrics = await trainingSystem.calculatePerformanceMetrics();

      expect(metrics.totalPredictions).toBe(150);
      expect(metrics.correctPredictions).toBe(120);
      expect(metrics.accuracy).toBe(0.8); // 120/150
      expect(metrics.avgConfidence).toBe(0.87);
      expect(metrics.feedbackPositive).toBe(120);
      expect(metrics.feedbackNegative).toBe(30);
      expect(metrics.modelVersion).toBe('current');
    });

    it('should handle zero feedback gracefully', async () => {
      (db as any).setMockData(
        'COUNT(*) as total FROM ai_classifications',
        [],
        [{ total: 50 }]
      );

      (db as any).setMockData(
        'COUNT(CASE WHEN af.feedback_type',
        [],
        [{ positive: 0, negative: 0 }]
      );

      (db as any).setMockData(
        'AVG(confidence_score)',
        [],
        [{ avg_confidence: 0.75 }]
      );

      const metrics = await trainingSystem.calculatePerformanceMetrics();

      expect(metrics.accuracy).toBe(0);
      expect(metrics.feedbackPositive).toBe(0);
      expect(metrics.feedbackNegative).toBe(0);
    });

    it('should filter by organization ID', async () => {
      (db as any).setMockData(
        'COUNT(*) as total FROM ai_classifications',
        [123],
        [{ total: 25 }]
      );

      (db as any).setMockData(
        'COUNT(CASE WHEN af.feedback_type',
        [123],
        [{ positive: 20, negative: 5 }]
      );

      (db as any).setMockData(
        'AVG(confidence_score)',
        [123],
        [{ avg_confidence: 0.92 }]
      );

      const metrics = await trainingSystem.calculatePerformanceMetrics('v1', 123);

      expect(metrics.totalPredictions).toBe(25);
      expect(metrics.accuracy).toBe(0.8);
    });
  });

  describe('shouldRetrain', () => {
    it('should return false when auto-retrain is disabled', async () => {
      const system = new AITrainingSystem(db, { autoRetrain: false });
      const result = await system.shouldRetrain();

      expect(result).toBe(false);
    });

    it('should return true when accuracy is below threshold', async () => {
      // Mock low accuracy
      (db as any).setMockData(
        'COUNT(*) as total FROM ai_classifications',
        [],
        [{ total: 200 }]
      );

      (db as any).setMockData(
        'COUNT(CASE WHEN af.feedback_type',
        [],
        [{ positive: 150, negative: 50 }]
      );

      (db as any).setMockData(
        'AVG(confidence_score)',
        [],
        [{ avg_confidence: 0.85 }]
      );

      (db as any).setMockData(
        'SELECT COUNT(*) as count',
        [],
        [{ count: 50 }]
      );

      const result = await trainingSystem.shouldRetrain();

      // Accuracy = 150/200 = 0.75, which is below default threshold of 0.95
      expect(result).toBe(true);
    });

    it('should return true when enough new training data exists', async () => {
      // Mock acceptable accuracy but lots of new data
      (db as any).setMockData(
        'COUNT(*) as total FROM ai_classifications',
        [],
        [{ total: 100 }]
      );

      (db as any).setMockData(
        'COUNT(CASE WHEN af.feedback_type',
        [],
        [{ positive: 96, negative: 4 }]
      );

      (db as any).setMockData(
        'AVG(confidence_score)',
        [],
        [{ avg_confidence: 0.93 }]
      );

      (db as any).setMockData(
        'SELECT COUNT(*) as count',
        [],
        [{ count: 1200 }] // Above default minDataPoints of 1000
      );

      const result = await trainingSystem.shouldRetrain();

      expect(result).toBe(true);
    });
  });

  describe('trainModel', () => {
    it('should throw error with insufficient training data', async () => {
      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification'],
        [] // Empty training data
      );

      await expect(
        trainingSystem.trainModel('classification')
      ).rejects.toThrow('Insufficient training data');
    });

    it('should successfully train model with sufficient data', async () => {
      // Create 1100 mock training examples
      const mockTrainingData = Array.from({ length: 1100 }, (_, i) => ({
        id: i + 1,
        input_text: `Test ticket ${i}`,
        expected_output: JSON.stringify({ category: 'Test', priority: 'medium' }),
        actual_output: JSON.stringify({ category: 'Test', priority: 'medium' }),
        data_type: 'classification',
        quality_score: 0.9,
        validated: 1,
        validation_source: 'user',
        created_at: new Date().toISOString(),
      }));

      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification'],
        mockTrainingData
      );

      const result = await trainingSystem.trainModel('classification');

      expect(result).toBeDefined();
      expect(result.modelVersion).toContain('v');
      expect(result.trainingDataSize).toBeGreaterThan(0);
      expect(result.validationDataSize).toBeGreaterThan(0);
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(result.trainingTime).toBeGreaterThan(0);
      expect(Array.isArray(result.improvements)).toBe(true);
    });
  });

  describe('getDataQualityStats', () => {
    it('should return comprehensive data quality statistics', async () => {
      (db as any).setMockData(
        'COUNT(*) as total',
        [],
        [{
          total: 5000,
          validated: 4200,
          high_quality: 3800,
          avg_quality: 0.87,
        }]
      );

      (db as any).setMockData(
        'GROUP BY data_type',
        [],
        [
          { data_type: 'classification', count: 3000 },
          { data_type: 'suggestion', count: 1500 },
          { data_type: 'sentiment', count: 500 },
        ]
      );

      const stats = await trainingSystem.getDataQualityStats();

      expect(stats.total).toBe(5000);
      expect(stats.validated).toBe(4200);
      expect(stats.highQuality).toBe(3800);
      expect(stats.avgQualityScore).toBe(0.87);
      expect(stats.byType).toEqual({
        classification: 3000,
        suggestion: 1500,
        sentiment: 500,
      });
    });

    it('should handle empty database gracefully', async () => {
      (db as any).setMockData(
        'COUNT(*) as total',
        [],
        [{
          total: 0,
          validated: 0,
          high_quality: 0,
          avg_quality: null,
        }]
      );

      (db as any).setMockData(
        'GROUP BY data_type',
        [],
        []
      );

      const stats = await trainingSystem.getDataQualityStats();

      expect(stats.total).toBe(0);
      expect(stats.validated).toBe(0);
      expect(stats.avgQualityScore).toBe(0);
      expect(stats.byType).toEqual({});
    });
  });

  describe('exportTrainingData', () => {
    it('should export training data in JSON format', async () => {
      const mockData = [
        {
          id: 1,
          input_text: 'Test input',
          expected_output: '{"test": true}',
          actual_output: '{"test": true}',
          data_type: 'classification',
          quality_score: 0.95,
          validated: 1,
          validation_source: 'user',
          created_at: new Date().toISOString(),
        },
      ];

      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification'],
        mockData
      );

      const result = await trainingSystem.exportTrainingData('classification', 'json');

      expect(result).toContain('"id": 1');
      expect(result).toContain('"input_text": "Test input"');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should export training data in CSV format', async () => {
      const mockData = [
        {
          id: 1,
          input_text: 'Test input',
          expected_output: '{"test": true}',
          actual_output: '{"test": true}',
          data_type: 'classification',
          quality_score: 0.95,
          validated: 1,
          validation_source: 'user',
          created_at: new Date().toISOString(),
        },
      ];

      (db as any).setMockData(
        'FROM ai_training_data',
        ['classification'],
        mockData
      );

      const result = await trainingSystem.exportTrainingData('classification', 'csv');

      expect(result).toContain('id,input_text,expected_output,actual_output,quality_score');
      expect(result).toContain('"Test input"');
      expect(result).toContain('0.95');
    });
  });
});
