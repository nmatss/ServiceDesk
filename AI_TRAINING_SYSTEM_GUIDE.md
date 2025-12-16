# AI Training System & Feedback Loop - Complete Guide

## Overview

This ServiceDesk application includes a comprehensive AI training system with continuous learning capabilities, model performance tracking, A/B testing framework, and automated retraining triggers.

## Architecture

### Core Components

1. **Training System** (`lib/ai/training-system.ts`)
   - Continuous learning pipeline
   - Model performance tracking
   - Automated retraining triggers
   - Training data quality scoring
   - Export capabilities for external fine-tuning

2. **Model Manager** (`lib/ai/model-manager.ts`)
   - Model versioning system
   - Deployment management
   - Performance metrics tracking
   - Rollback capabilities
   - A/B testing framework
   - Health monitoring

3. **Feedback Loop** (`lib/ai/feedback-loop.ts`)
   - Collects user feedback on AI operations
   - Integrates feedback into training data
   - Tracks model accuracy over time

### API Routes

#### 1. Training API (`/api/ai/train`)

**POST - Trigger Training**
```bash
POST /api/ai/train
Authorization: Bearer <admin-token>

{
  "action": "train",
  "operationType": "classification",
  "organizationId": 1,
  "config": {
    "minDataPoints": 1000,
    "accuracyThreshold": 0.95,
    "batchSize": 100
  }
}
```

**Actions:**
- `train` - Train a new model version
- `auto-retrain-check` - Check if retraining is needed
- `auto-retrain` - Auto-retrain if conditions are met

**GET - Retrieve Training Metrics**
```bash
GET /api/ai/train?action=metrics&organizationId=1
GET /api/ai/train?action=history&limit=10
GET /api/ai/train?action=data-quality
GET /api/ai/train?action=export&operationType=classification&format=json
```

#### 2. Model Management API (`/api/ai/models`)

**POST - Manage Models**
```bash
POST /api/ai/models
Authorization: Bearer <admin-token>

# Register new model
{
  "action": "register",
  "version": "v1.2.0",
  "name": "Classification Model v1.2",
  "type": "classification",
  "provider": "openai",
  "modelId": "gpt-4o",
  "config": {
    "temperature": 0.1,
    "maxTokens": 500
  }
}

# Deploy model
{
  "action": "deploy",
  "deployVersion": "v1.2.0",
  "deploymentConfig": {
    "rolloutPercentage": 100,
    "maxConcurrency": 10,
    "timeoutMs": 30000,
    "abTestEnabled": false
  }
}

# Setup A/B test
{
  "action": "ab-test",
  "versionA": "v1.1.0",
  "versionB": "v1.2.0",
  "splitPercentage": 50
}
```

**GET - Query Models**
```bash
GET /api/ai/models?action=list&type=classification
GET /api/ai/models?action=active&type=classification
GET /api/ai/models?action=version&version=v1.2.0
GET /api/ai/models?action=compare&versions=v1.1.0,v1.2.0
GET /api/ai/models?action=ab-results&versionA=v1.1.0&versionB=v1.2.0
GET /api/ai/models?action=health&version=v1.2.0
GET /api/ai/models?action=deployments&limit=10
```

#### 3. Feedback API (`/api/ai/feedback`)

**POST - Submit Feedback**
```bash
POST /api/ai/feedback
Authorization: Bearer <token>

# Classification feedback
{
  "operationType": "classification",
  "operationId": 123,
  "feedback": "negative",
  "correctedCategory": "Technical Issue",
  "correctedPriority": "High"
}

# Suggestion feedback
{
  "operationType": "suggestion",
  "operationId": 456,
  "feedback": "positive",
  "wasHelpful": true,
  "wasUsed": true,
  "comment": "Great suggestion!"
}
```

**GET - Feedback Statistics**
```bash
GET /api/ai/feedback?operationType=classification&dateFrom=2024-01-01&dateTo=2024-12-31
GET /api/ai/feedback?operationType=suggestion&limit=100
```

#### 4. Metrics API (`/api/ai/metrics`)

**GET - Comprehensive Metrics**
```bash
GET /api/ai/metrics?period=day
GET /api/ai/metrics?period=week&modelVersion=v1.2.0
GET /api/ai/metrics?period=month&organizationId=1&includeDetails=true
```

**Periods:** `hour`, `day`, `week`, `month`, `all`

**Response Structure:**
```json
{
  "success": true,
  "period": {
    "type": "day",
    "start": "2024-12-04T00:00:00Z",
    "end": "2024-12-05T00:00:00Z"
  },
  "metrics": {
    "classification": {
      "totalClassifications": 1250,
      "accepted": 1100,
      "rejected": 150,
      "accuracy": 0.88,
      "avgConfidence": 0.85,
      "avgProcessingTime": 245,
      "categoryDistribution": [...],
      "priorityDistribution": [...]
    },
    "suggestions": {
      "totalSuggestions": 850,
      "used": 650,
      "helpful": 600,
      "usageRate": 0.76,
      "helpfulnessRate": 0.92,
      "typeDistribution": [...]
    },
    "performance": {
      "modelVersion": "current",
      "totalPredictions": 1250,
      "correctPredictions": 1100,
      "accuracy": 0.88,
      "avgConfidence": 0.85,
      "feedbackPositive": 1100,
      "feedbackNegative": 150
    },
    "cost": {
      "totalInputTokens": 125000,
      "totalOutputTokens": 45000,
      "totalTokens": 170000,
      "totalCostUSD": 0.045,
      "avgCostPerOperation": 0.000036,
      "avgProcessingTime": 245
    },
    "dataQuality": {
      "total": 5000,
      "validated": 4500,
      "highQuality": 4200,
      "avgQualityScore": 0.87
    }
  },
  "models": {
    "active": 3,
    "total": 8
  },
  "systemHealth": {
    "score": 88,
    "status": "healthy",
    "issues": [],
    "recommendations": []
  }
}
```

**POST - Export Metrics**
```bash
POST /api/ai/metrics
Authorization: Bearer <admin-token>

{
  "action": "export",
  "period": "month"
}
```

## Database Schema

### AI-Related Tables

```sql
-- AI Classifications
CREATE TABLE ai_classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    suggested_category_id INTEGER,
    suggested_priority_id INTEGER,
    confidence_score DECIMAL(5,4),
    reasoning TEXT,
    model_name TEXT NOT NULL DEFAULT 'gpt-4o',
    model_version TEXT DEFAULT '2024-08-06',
    input_tokens INTEGER,
    output_tokens INTEGER,
    processing_time_ms INTEGER,
    was_accepted BOOLEAN,
    corrected_category_id INTEGER,
    feedback_by INTEGER,
    feedback_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Suggestions
CREATE TABLE ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    suggestion_type TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(5,4),
    model_name TEXT DEFAULT 'gpt-4o',
    was_used BOOLEAN DEFAULT FALSE,
    was_helpful BOOLEAN,
    feedback_comment TEXT,
    used_by INTEGER,
    used_at DATETIME,
    feedback_by INTEGER,
    feedback_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Training Data
CREATE TABLE ai_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    feedback TEXT,
    model_version TEXT DEFAULT '1.0',
    data_type TEXT NOT NULL,
    quality_score DECIMAL(3,2) DEFAULT 1.00,
    source_entity_type TEXT,
    source_entity_id INTEGER,
    created_by INTEGER,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    is_validated BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Model Versions (created by model-manager)
CREATE TABLE ai_model_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    config TEXT,
    status TEXT DEFAULT 'training',
    accuracy REAL DEFAULT 0,
    total_inferences INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    avg_confidence REAL DEFAULT 0,
    success_rate REAL DEFAULT 0,
    error_rate REAL DEFAULT 0,
    cost_per_inference REAL DEFAULT 0,
    deployed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### 1. Training Flow

```typescript
import AITrainingSystem from '@/lib/ai/training-system';
import db from '@/lib/db/connection';

const trainingSystem = new AITrainingSystem(db, {
  minDataPoints: 1000,
  accuracyThreshold: 0.95,
  autoRetrain: true
});

// Add training data from user feedback
await trainingSystem.processFeedback(
  classificationId,
  'negative',
  'Technical Issue',
  'High',
  userId
);

// Check if retraining is needed
const shouldRetrain = await trainingSystem.shouldRetrain();

// Train new model
if (shouldRetrain) {
  const result = await trainingSystem.trainModel('classification');
  console.log(`New model accuracy: ${result.accuracy * 100}%`);
}
```

### 2. Model Management

```typescript
import AIModelManager from '@/lib/ai/model-manager';
import db from '@/lib/db/connection';

const modelManager = new AIModelManager(db);
await modelManager.initialize();

// Register new model
const model = await modelManager.registerModel(
  'v1.2.0',
  'Improved Classification Model',
  'classification',
  'openai',
  'gpt-4o',
  { temperature: 0.1, maxTokens: 500 }
);

// Deploy with gradual rollout
await modelManager.deployModel('v1.2.0', {
  rolloutPercentage: 25, // Start with 25%
  maxConcurrency: 10,
  timeoutMs: 30000,
  fallbackModel: 'v1.1.0'
});

// Monitor health
const health = await modelManager.getModelHealth('v1.2.0');
console.log(`Status: ${health.status}`);
console.log(`Issues: ${health.issues.join(', ')}`);
```

### 3. A/B Testing

```typescript
// Setup A/B test
await modelManager.setupABTest('v1.1.0', 'v1.2.0', 50);

// After collecting data...
const results = await modelManager.getABTestResults('v1.1.0', 'v1.2.0');

console.log('Version A Stats:', results.versionA);
console.log('Version B Stats:', results.versionB);
console.log('Winner:', results.winner);
console.log('Confidence:', results.confidenceLevel);
```

## Performance Tracking

### Key Metrics

1. **Accuracy Rate**: Percentage of correct classifications
2. **Feedback Rate**: Percentage of operations receiving feedback
3. **Correction Rate**: Percentage of operations requiring correction
4. **Usage Rate**: Percentage of suggestions actually used
5. **Helpfulness Rate**: Percentage of helpful suggestions
6. **Processing Time**: Average time to complete operations
7. **Cost per Operation**: Average cost in USD
8. **Confidence Score**: Model's confidence in predictions

### System Health Scoring

- **Healthy** (85-100): All systems operating optimally
- **Degraded** (60-84): Some issues detected, monitoring recommended
- **Unhealthy** (<60): Critical issues, immediate attention required

## Continuous Improvement

### Automatic Retraining Triggers

1. **Accuracy Threshold**: Retrains when accuracy drops below 95%
2. **New Data Volume**: Retrains when 1000+ new validated examples available
3. **Time-based**: Retrains every 24 hours (configurable)
4. **Manual Trigger**: Admin can trigger retraining via API

### Feedback Loop Integration

```typescript
// Frontend integration example
async function submitClassificationFeedback(
  classificationId: number,
  wasCorrect: boolean,
  corrections?: { category?: string; priority?: string }
) {
  const response = await fetch('/api/ai/feedback', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operationType: 'classification',
      operationId: classificationId,
      feedback: wasCorrect ? 'positive' : 'negative',
      correctedCategory: corrections?.category,
      correctedPriority: corrections?.priority
    })
  });

  return response.json();
}
```

## Best Practices

1. **Regular Monitoring**: Check `/api/ai/metrics` daily
2. **Quality Control**: Review training data quality regularly
3. **A/B Testing**: Test new models before full deployment
4. **Gradual Rollout**: Use partial rollouts for new versions
5. **Fallback Models**: Always configure fallback models
6. **Cost Monitoring**: Track token usage and costs
7. **User Feedback**: Encourage users to provide feedback
8. **Data Validation**: Validate training data before use

## Troubleshooting

### Low Accuracy

- Check data quality: `/api/ai/train?action=data-quality`
- Review recent corrections
- Analyze common failure patterns
- Retrain with more diverse examples

### High Processing Time

- Check model configuration
- Review concurrent request limits
- Consider using faster models
- Implement caching strategies

### Low Feedback Rate

- Make feedback UI more prominent
- Add incentives for feedback
- Simplify feedback process
- Automate feedback collection where possible

## Security Considerations

- All admin endpoints require authentication
- Feedback submission requires valid user token
- Model configurations are encrypted
- API rate limiting is enforced
- Audit logs track all changes

## Response Time Targets

- Classification: < 500ms (p95)
- Suggestion: < 1000ms (p95)
- Training: Depends on dataset size
- Metrics retrieval: < 200ms (p95)

## Cost Optimization

1. Use caching for repeated queries
2. Batch operations when possible
3. Set appropriate token limits
4. Monitor and adjust temperature settings
5. Use cheaper models for simpler tasks
6. Implement request throttling

---

## Next Steps

1. Monitor initial performance metrics
2. Collect baseline feedback data
3. Set up automated monitoring alerts
4. Configure A/B testing for new models
5. Establish retraining schedules
6. Document organization-specific workflows

For questions or issues, refer to the API documentation or contact the development team.
