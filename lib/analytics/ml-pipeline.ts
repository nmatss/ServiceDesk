import { logger } from '../monitoring/logger';

// Enterprise Machine Learning Pipeline for ServiceDesk Analytics
// Provides core ML infrastructure for predictive analytics, feature engineering, and model management

export interface MLModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'anomaly_detection' | 'forecasting';
  version: string;
  status: 'training' | 'ready' | 'deprecated' | 'failed';
  performance_metrics: Record<string, number>;
  feature_config: FeatureConfig;
  training_data_size: number;
  last_trained_at: Date;
  last_evaluated_at: Date;
  model_artifact_path?: string;
  hyperparameters: Record<string, any>;
  training_logs: string[];
}

export interface FeatureConfig {
  numerical_features: string[];
  categorical_features: string[];
  text_features: string[];
  temporal_features: string[];
  derived_features: DerivedFeature[];
  preprocessing_steps: PreprocessingStep[];
}

export interface DerivedFeature {
  name: string;
  formula: string;
  dependencies: string[];
  description: string;
}

export interface PreprocessingStep {
  name: string;
  type: 'normalize' | 'scale' | 'encode' | 'impute' | 'transform';
  config: Record<string, any>;
  target_features?: string[];
}

export interface TrainingData {
  features: Record<string, any>;
  target: any;
  timestamp: Date;
  entity_id: string;
  entity_type: string;
  metadata?: Record<string, any>;
}

export interface PredictionRequest {
  model_id: string;
  features: Record<string, any>;
  confidence_threshold?: number;
  explain_prediction?: boolean;
}

export interface PredictionResult {
  model_id: string;
  prediction: any;
  confidence: number;
  probability_distribution?: Record<string, number>;
  feature_importance?: Record<string, number>;
  explanation?: string;
  processing_time_ms: number;
  timestamp: Date;
}

export interface ModelEvaluation {
  model_id: string;
  evaluation_date: Date;
  dataset_size: number;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    auc_roc?: number;
    rmse?: number;
    mae?: number;
    mape?: number;
    r2_score?: number;
  };
  confusion_matrix?: number[][];
  feature_importance: Record<string, number>;
  drift_score?: number;
  data_quality_score: number;
}

export class MLPipeline {
  private models: Map<string, MLModel> = new Map();
  private featureStore: FeatureStore;
  private modelRegistry: ModelRegistry;
  private trainingQueue: TrainingJob[] = [];

  constructor() {
    this.featureStore = new FeatureStore();
    this.modelRegistry = new ModelRegistry();
  }

  // ========================================
  // MODEL MANAGEMENT
  // ========================================

  async registerModel(model: Omit<MLModel, 'id' | 'last_trained_at' | 'last_evaluated_at'>): Promise<string> {
    const modelId = `${model.name}_${model.version}_${Date.now()}`;
    const fullModel: MLModel = {
      ...model,
      id: modelId,
      last_trained_at: new Date(),
      last_evaluated_at: new Date(),
      training_logs: []
    };

    await this.modelRegistry.save(fullModel);
    this.models.set(modelId, fullModel);

    logger.info(`[ML Pipeline] Model registered: ${modelId}`);
    return modelId;
  }

  async getModel(modelId: string): Promise<MLModel | null> {
    if (this.models.has(modelId)) {
      return this.models.get(modelId)!;
    }

    const model = await this.modelRegistry.load(modelId);
    if (model) {
      this.models.set(modelId, model);
    }

    return model;
  }

  async listModels(type?: MLModel['type'], status?: MLModel['status']): Promise<MLModel[]> {
    const allModels = await this.modelRegistry.list();

    return allModels.filter(model => {
      if (type && model.type !== type) return false;
      if (status && model.status !== status) return false;
      return true;
    });
  }

  // ========================================
  // FEATURE ENGINEERING
  // ========================================

  async extractFeatures(
    entityType: string,
    entityId: string,
    featureConfig: FeatureConfig
  ): Promise<Record<string, any>> {
    const features: Record<string, any> = {};

    // Extract base features from entity
    const entityData = await this.featureStore.getEntityData(entityType, entityId);

    // Numerical features
    for (const feature of featureConfig.numerical_features) {
      features[feature] = this.extractNumericalFeature(entityData, feature);
    }

    // Categorical features
    for (const feature of featureConfig.categorical_features) {
      features[feature] = this.extractCategoricalFeature(entityData, feature);
    }

    // Text features
    for (const feature of featureConfig.text_features) {
      const textFeatures = await this.extractTextFeatures(entityData, feature);
      Object.assign(features, textFeatures);
    }

    // Temporal features
    for (const feature of featureConfig.temporal_features) {
      const temporalFeatures = this.extractTemporalFeatures(entityData, feature);
      Object.assign(features, temporalFeatures);
    }

    // Derived features
    for (const derivedFeature of featureConfig.derived_features) {
      features[derivedFeature.name] = this.calculateDerivedFeature(features, derivedFeature);
    }

    // Apply preprocessing
    return this.applyPreprocessing(features, featureConfig.preprocessing_steps);
  }

  private extractNumericalFeature(data: any, feature: string): number {
    const value = this.getNestedValue(data, feature);
    return typeof value === 'number' ? value : 0;
  }

  private extractCategoricalFeature(data: any, feature: string): string {
    const value = this.getNestedValue(data, feature);
    return typeof value === 'string' ? value : 'unknown';
  }

  private async extractTextFeatures(data: any, feature: string): Promise<Record<string, any>> {
    const text = this.getNestedValue(data, feature) || '';

    return {
      [`${feature}_length`]: text.length,
      [`${feature}_word_count`]: text.split(/\s+/).length,
      [`${feature}_sentiment`]: await this.analyzeSentiment(text),
      [`${feature}_complexity`]: this.calculateTextComplexity(text),
      [`${feature}_has_urls`]: /https?:\/\//.test(text),
      [`${feature}_has_emails`]: /\S+@\S+\.\S+/.test(text),
      [`${feature}_urgency_keywords`]: this.countUrgencyKeywords(text)
    };
  }

  private extractTemporalFeatures(data: any, feature: string): Record<string, any> {
    const date = new Date(this.getNestedValue(data, feature));
    const now = new Date();

    return {
      [`${feature}_hour`]: date.getHours(),
      [`${feature}_day_of_week`]: date.getDay(),
      [`${feature}_is_weekend`]: date.getDay() === 0 || date.getDay() === 6,
      [`${feature}_is_business_hours`]: this.isBusinessHours(date),
      [`${feature}_age_hours`]: (now.getTime() - date.getTime()) / (1000 * 60 * 60),
      [`${feature}_age_days`]: (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    };
  }

  private calculateDerivedFeature(features: Record<string, any>, config: DerivedFeature): any {
    try {
      // Simple formula evaluation - in production, use a proper expression evaluator
      let formula = config.formula;

      for (const [key, value] of Object.entries(features)) {
        formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
      }

      // Basic mathematical operations
      formula = formula.replace(/\bmax\(([^)]+)\)/g, (_, args) => {
        const values = args.split(',').map((v: string) => parseFloat(v.trim()));
        return String(Math.max(...values));
      });

      formula = formula.replace(/\bmin\(([^)]+)\)/g, (_, args) => {
        const values = args.split(',').map((v: string) => parseFloat(v.trim()));
        return String(Math.min(...values));
      });

      return eval(formula);
    } catch (error) {
      logger.warn(`[ML Pipeline] Error calculating derived feature ${config.name}:`, error);
      return 0;
    }
  }

  private applyPreprocessing(
    features: Record<string, any>,
    steps: PreprocessingStep[]
  ): Record<string, any> {
    let processedFeatures = { ...features };

    for (const step of steps) {
      processedFeatures = this.applyPreprocessingStep(processedFeatures, step);
    }

    return processedFeatures;
  }

  private applyPreprocessingStep(
    features: Record<string, any>,
    step: PreprocessingStep
  ): Record<string, any> {
    const targetFeatures = step.target_features || Object.keys(features);

    switch (step.type) {
      case 'normalize':
        return this.normalizeFeatures(features, targetFeatures, step.config);
      case 'scale':
        return this.scaleFeatures(features, targetFeatures, step.config);
      case 'encode':
        return this.encodeFeatures(features, targetFeatures, step.config);
      case 'impute':
        return this.imputeFeatures(features, targetFeatures, step.config);
      case 'transform':
        return this.transformFeatures(features, targetFeatures, step.config);
      default:
        return features;
    }
  }

  // ========================================
  // PREDICTION ENGINE
  // ========================================

  async predict(request: PredictionRequest): Promise<PredictionResult> {
    const startTime = Date.now();
    const model = await this.getModel(request.model_id);

    if (!model || model.status !== 'ready') {
      throw new Error(`Model ${request.model_id} is not ready for predictions`);
    }

    // Extract and preprocess features
    const processedFeatures = await this.applyPreprocessing(
      request.features,
      model.feature_config.preprocessing_steps
    );

    // Make prediction (mock implementation - replace with actual ML model)
    const prediction = await this.runInference(model, processedFeatures);

    const confidence = this.calculateConfidence(prediction, model);
    const featureImportance = request.explain_prediction
      ? this.explainPrediction(processedFeatures, model)
      : undefined;

    const result: PredictionResult = {
      model_id: request.model_id,
      prediction: prediction.value,
      confidence,
      probability_distribution: prediction.probabilities,
      feature_importance: featureImportance,
      explanation: request.explain_prediction ? this.generateExplanation(prediction, featureImportance) : undefined,
      processing_time_ms: Date.now() - startTime,
      timestamp: new Date()
    };

    // Log prediction for monitoring and retraining
    await this.logPrediction(result, processedFeatures);

    return result;
  }

  private async runInference(model: MLModel, features: Record<string, any>): Promise<any> {
    // Mock inference - replace with actual model inference
    switch (model.type) {
      case 'classification':
        return {
          value: Math.random() > 0.5 ? 'high_risk' : 'low_risk',
          probabilities: {
            'high_risk': Math.random(),
            'low_risk': Math.random()
          }
        };
      case 'regression':
        return {
          value: Math.random() * 100,
          probabilities: undefined
        };
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  // ========================================
  // MODEL TRAINING
  // ========================================

  async trainModel(
    modelId: string,
    trainingData: TrainingData[],
    validationData?: TrainingData[]
  ): Promise<ModelEvaluation> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    logger.info(`[ML Pipeline] Starting training for model ${modelId}`);
    model.status = 'training';
    await this.modelRegistry.save(model);

    try {
      // Prepare training data
      const features = await this.prepareTrainingData(trainingData, model.feature_config);
      const targets = trainingData.map(d => d.target);

      // Train model (mock implementation)
      const trainedModel = await this.runTraining(model, features, targets);

      // Evaluate model
      const evaluation = validationData
        ? await this.evaluateModel(trainedModel, validationData)
        : await this.crossValidateModel(trainedModel, trainingData);

      // Update model status and metrics
      model.status = 'ready';
      model.performance_metrics = evaluation.metrics;
      model.last_trained_at = new Date();
      model.last_evaluated_at = new Date();
      model.training_data_size = trainingData.length;

      await this.modelRegistry.save(model);

      logger.info(`[ML Pipeline] Training completed for model ${modelId}`);
      return evaluation;

    } catch (error) {
      model.status = 'failed';
      model.training_logs.push(`Training failed: ${error.message}`);
      await this.modelRegistry.save(model);
      throw error;
    }
  }

  private async prepareTrainingData(
    data: TrainingData[],
    featureConfig: FeatureConfig
  ): Promise<Record<string, any>[]> {
    const preparedData = [];

    for (const sample of data) {
      const features = await this.extractFeatures(
        sample.entity_type,
        sample.entity_id,
        featureConfig
      );
      preparedData.push(features);
    }

    return preparedData;
  }

  // ========================================
  // MODEL EVALUATION
  // ========================================

  async evaluateModel(
    model: MLModel,
    testData: TrainingData[]
  ): Promise<ModelEvaluation> {
    const features = await this.prepareTrainingData(testData, model.feature_config);
    const actualTargets = testData.map(d => d.target);
    const predictions = [];

    // Generate predictions for test data
    for (const featureSet of features) {
      const prediction = await this.predict({
        model_id: model.id,
        features: featureSet
      });
      predictions.push(prediction.prediction);
    }

    // Calculate metrics based on model type
    const metrics = model.type === 'classification'
      ? this.calculateClassificationMetrics(actualTargets, predictions)
      : this.calculateRegressionMetrics(actualTargets, predictions);

    return {
      model_id: model.id,
      evaluation_date: new Date(),
      dataset_size: testData.length,
      metrics,
      feature_importance: this.calculateFeatureImportance(model, features),
      data_quality_score: this.calculateDataQualityScore(features)
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async analyzeSentiment(text: string): Promise<number> {
    // Mock sentiment analysis - replace with actual implementation
    const positiveWords = ['good', 'great', 'excellent', 'satisfied', 'happy'];
    const negativeWords = ['bad', 'terrible', 'awful', 'frustrated', 'angry'];

    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    return (positiveCount - negativeCount) / Math.max(words.length, 1);
  }

  private calculateTextComplexity(text: string): number {
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const avgWordsPerSentence = words / Math.max(sentences, 1);

    return avgWordsPerSentence;
  }

  private countUrgencyKeywords(text: string): number {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'immediate', 'help'];
    const words = text.toLowerCase().split(/\s+/);

    return words.filter(word => urgentKeywords.includes(word)).length;
  }

  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 17;
  }

  private normalizeFeatures(
    features: Record<string, any>,
    targetFeatures: string[],
    config: any
  ): Record<string, any> {
    // Z-score normalization
    const result = { ...features };

    for (const feature of targetFeatures) {
      if (typeof features[feature] === 'number') {
        const mean = config[`${feature}_mean`] || 0;
        const std = config[`${feature}_std`] || 1;
        result[feature] = (features[feature] - mean) / std;
      }
    }

    return result;
  }

  private scaleFeatures(
    features: Record<string, any>,
    targetFeatures: string[],
    config: any
  ): Record<string, any> {
    // Min-max scaling
    const result = { ...features };

    for (const feature of targetFeatures) {
      if (typeof features[feature] === 'number') {
        const min = config[`${feature}_min`] || 0;
        const max = config[`${feature}_max`] || 1;
        result[feature] = (features[feature] - min) / (max - min);
      }
    }

    return result;
  }

  private encodeFeatures(
    features: Record<string, any>,
    targetFeatures: string[],
    config: any
  ): Record<string, any> {
    const result = { ...features };

    for (const feature of targetFeatures) {
      if (typeof features[feature] === 'string') {
        const encoding = config[`${feature}_encoding`] || {};
        result[feature] = encoding[features[feature]] || 0;
      }
    }

    return result;
  }

  private imputeFeatures(
    features: Record<string, any>,
    targetFeatures: string[],
    config: any
  ): Record<string, any> {
    const result = { ...features };

    for (const feature of targetFeatures) {
      if (features[feature] === null || features[feature] === undefined) {
        result[feature] = config[`${feature}_default`] || 0;
      }
    }

    return result;
  }

  private transformFeatures(
    features: Record<string, any>,
    targetFeatures: string[],
    config: any
  ): Record<string, any> {
    const result = { ...features };

    for (const feature of targetFeatures) {
      const transform = config[`${feature}_transform`];

      if (transform === 'log' && typeof features[feature] === 'number') {
        result[feature] = Math.log(Math.max(features[feature], 1));
      } else if (transform === 'sqrt' && typeof features[feature] === 'number') {
        result[feature] = Math.sqrt(Math.max(features[feature], 0));
      }
    }

    return result;
  }

  private calculateConfidence(prediction: any, model: MLModel): number {
    // Mock confidence calculation
    return Math.random() * 0.4 + 0.6; // Between 0.6 and 1.0
  }

  private explainPrediction(
    features: Record<string, any>,
    model: MLModel
  ): Record<string, number> {
    // Mock feature importance for explanation
    const importance: Record<string, number> = {};
    const featureKeys = Object.keys(features);

    for (const key of featureKeys) {
      importance[key] = Math.random();
    }

    return importance;
  }

  private generateExplanation(prediction: any, featureImportance?: Record<string, number>): string {
    if (!featureImportance) return 'No explanation available';

    const topFeatures = Object.entries(featureImportance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([feature, importance]) => `${feature} (${(importance * 100).toFixed(1)}%)`)
      .join(', ');

    return `Prediction based on: ${topFeatures}`;
  }

  private async logPrediction(result: PredictionResult, features: Record<string, any>): Promise<void> {
    // Log prediction for monitoring and retraining
    logger.info(`[ML Pipeline] Prediction logged for model ${result.model_id}`);
  }

  private async runTraining(
    model: MLModel,
    features: Record<string, any>[],
    targets: any[]
  ): Promise<MLModel> {
    // Mock training - replace with actual ML training
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate training time
    return model;
  }

  private async crossValidateModel(
    model: MLModel,
    data: TrainingData[]
  ): Promise<ModelEvaluation> {
    // Mock cross-validation
    return {
      model_id: model.id,
      evaluation_date: new Date(),
      dataset_size: data.length,
      metrics: {
        accuracy: 0.85,
        precision: 0.83,
        recall: 0.87,
        f1_score: 0.85
      },
      feature_importance: {},
      data_quality_score: 0.9
    };
  }

  private calculateClassificationMetrics(actual: any[], predicted: any[]): any {
    // Mock classification metrics
    return {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1_score: 0.85,
      auc_roc: 0.92
    };
  }

  private calculateRegressionMetrics(actual: number[], predicted: number[]): any {
    // Mock regression metrics
    const errors = actual.map((a, i) => a - predicted[i]);
    const mse = errors.reduce((sum, e) => sum + e * e, 0) / errors.length;

    return {
      rmse: Math.sqrt(mse),
      mae: errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length,
      r2_score: 0.85
    };
  }

  private calculateFeatureImportance(
    model: MLModel,
    features: Record<string, any>[]
  ): Record<string, number> {
    // Mock feature importance calculation
    const importance: Record<string, number> = {};

    if (features.length > 0) {
      for (const key of Object.keys(features[0])) {
        importance[key] = Math.random();
      }
    }

    return importance;
  }

  private calculateDataQualityScore(features: Record<string, any>[]): number {
    // Mock data quality score
    return Math.random() * 0.2 + 0.8; // Between 0.8 and 1.0
  }
}

// ========================================
// SUPPORTING CLASSES
// ========================================

class FeatureStore {
  async getEntityData(entityType: string, entityId: string): Promise<any> {
    // Mock implementation - replace with actual data fetching
    return {
      id: entityId,
      type: entityType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

class ModelRegistry {
  private models: Map<string, MLModel> = new Map();

  async save(model: MLModel): Promise<void> {
    this.models.set(model.id, model);
  }

  async load(modelId: string): Promise<MLModel | null> {
    return this.models.get(modelId) || null;
  }

  async list(): Promise<MLModel[]> {
    return Array.from(this.models.values());
  }

  async delete(modelId: string): Promise<void> {
    this.models.delete(modelId);
  }
}

interface TrainingJob {
  id: string;
  model_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

// Export singleton instance
export const mlPipeline = new MLPipeline();