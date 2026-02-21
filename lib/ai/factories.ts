/**
 * AI module factory functions
 * Encapsulates database dependency so API routes don't import getDatabase directly
 */

import { getDatabase } from '@/lib/db/adapter';
import AITrainingSystem, { type TrainingConfig } from './training-system';
import AIModelManager from './model-manager';

/**
 * Create an AITrainingSystem instance with the current database connection
 */
export function createTrainingSystem(config?: Partial<TrainingConfig>): AITrainingSystem {
  return new AITrainingSystem(getDatabase() as any, config);
}

/**
 * Create an AIModelManager instance with the current database connection
 */
export function createModelManager(): AIModelManager {
  return new AIModelManager(getDatabase() as any);
}
