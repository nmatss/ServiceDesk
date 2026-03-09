/**
 * AI module factory functions
 * Now that training-system and model-manager use the adapter pattern,
 * these factories simply re-export the singleton module objects.
 */

import aiTrainingSystem, { configure, type TrainingConfig } from './training-system';
import aiModelManager from './model-manager';

/**
 * Create / configure an AITrainingSystem instance
 */
export function createTrainingSystem(config?: Partial<TrainingConfig>): typeof aiTrainingSystem {
  if (config) {
    configure(config);
  }
  return aiTrainingSystem;
}

/**
 * Get the AIModelManager singleton
 */
export function createModelManager(): typeof aiModelManager {
  return aiModelManager;
}
