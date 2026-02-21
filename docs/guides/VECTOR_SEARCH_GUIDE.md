# Vector Search System - Complete Implementation Guide

## Overview

This document describes the complete vector search system implementation for the ServiceDesk application. The system provides semantic search capabilities using OpenAI embeddings, combining vector similarity search with traditional keyword search for optimal results.

## Architecture

### Components

1. **VectorDatabase** (`lib/ai/vector-database.ts`)
   - Manages vector embeddings storage and retrieval
   - Implements cosine similarity search
   - Provides LRU caching for embeddings and search results
   - Supports batch processing with rate limiting

2. **Embedding Utilities** (`lib/ai/embedding-utils.ts`)
   - Text preprocessing for optimal embeddings
   - Quality analysis and validation
   - Incremental updates for changed content
   - Scheduled batch processing

3. **Hybrid Search Engine** (`lib/ai/hybrid-search.ts`)
   - Combines semantic and keyword search
   - Weighted scoring system
   - Faceted filtering
   - Auto-complete functionality

4. **API Endpoints**
   - `/api/search/semantic` - Semantic and hybrid search
   - `/api/embeddings/generate` - Embedding generation
   - `/api/search/suggest` - Auto-complete suggestions

## Features

### 1. Embedding Generation with Caching

```typescript
// Generate embedding for a ticket
const result = await vectorDb.generateAndStoreEmbedding(
  'ticket',
  ticketId,
  content,
  'text-embedding-3-small',
  true // useCache
);

// Result includes cache hit information
console.log(result.cached); // true if from cache
console.log(result.processingTimeMs); // Processing time
```

**Cache Features:**
- LRU cache with 1-hour TTL for embeddings
- 5-minute TTL for search results
- Automatic cache invalidation
- Cache statistics tracking

### 2. Batch Processing

```typescript
// Process multiple entities efficiently
const jobs = [
  { entityType: 'ticket', entityId: 1, content: '...', priority: 5 },
  { entityType: 'kb_article', entityId: 10, content: '...', priority: 7 }
];

const result = await vectorDb.batchGenerateEmbeddings(jobs);
// Returns: { total, successful, failed, skipped, errors, processingTimeMs }
```

**Batch Features:**
- Configurable batch size (default: 20)
- Priority-based processing
- Rate limiting (1s pause between batches)
- Skip recently updated embeddings (< 24 hours)
- Detailed error reporting

### 3. Semantic Search

```typescript
// Simple semantic search
const results = await vectorDb.searchSimilar(
  'How to reset password?',
  {
    entityTypes: ['ticket', 'kb_article'],
    maxResults: 10,
    threshold: 0.75,
    includeMetadata: true,
    useCache: true
  }
);

// Results include similarity scores and metadata
results.forEach(result => {
  console.log(`${result.entityType} #${result.entityId}`);
  console.log(`Similarity: ${result.similarityScore}`);
  console.log(`Content: ${result.content}`);
});
```

### 4. Hybrid Search

```typescript
// Combine semantic and keyword search
const hybridSearch = new HybridSearchEngine(vectorDb);

const results = await hybridSearch.search({
  query: 'email not working',
  entityTypes: ['ticket', 'kb_article'],
  semanticWeight: 0.7,  // 70% semantic
  keywordWeight: 0.3,   // 30% keyword
  maxResults: 20,
  threshold: 0.6,
  includeFacets: true
});

// Results include combined scores
results.results.forEach(r => {
  console.log(`Score: ${r.score.toFixed(3)}`);
  console.log(`  Semantic: ${r.semanticScore}`);
  console.log(`  Keyword: ${r.keywordScore}`);
});

// Facets for filtering
results.facets?.forEach(facet => {
  console.log(`${facet.field}:`);
  facet.values.forEach(v => {
    console.log(`  ${v.value}: ${v.count}`);
  });
});
```

### 5. Auto-Complete

```typescript
const suggestions = await hybridSearch.autoComplete({
  query: 'pas',
  limit: 5,
  entityTypes: ['ticket', 'kb_article'],
  includeHistory: true
});

// Returns suggestions and matching entities
console.log('Suggestions:', suggestions.suggestions);
console.log('Entities:', suggestions.entities);
```

## API Usage

### 1. Semantic Search Endpoint

**Request:**
```bash
POST /api/search/semantic
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "How to reset my password?",
  "entityTypes": ["ticket", "kb_article"],
  "searchType": "hybrid",
  "semanticWeight": 0.7,
  "keywordWeight": 0.3,
  "maxResults": 20,
  "threshold": 0.6,
  "includeFacets": true,
  "filters": {
    "categories": [1, 2],
    "priorities": [3, 4]
  }
}
```

**Response:**
```json
{
  "success": true,
  "searchType": "hybrid",
  "query": "How to reset my password?",
  "results": [
    {
      "id": 123,
      "type": "kb_article",
      "title": "Password Reset Guide",
      "content": "Step-by-step guide to reset your password...",
      "score": 0.89,
      "semanticScore": 0.92,
      "keywordScore": 0.81,
      "metadata": { ... }
    }
  ],
  "total": 15,
  "processingTimeMs": 145,
  "facets": [
    {
      "field": "category",
      "values": [
        { "value": "Account", "count": 8 },
        { "value": "Security", "count": 7 }
      ]
    }
  ],
  "suggestions": ["password reset", "forgot password"]
}
```

### 2. Generate Embeddings Endpoint

**Auto Mode (Bulk Generation):**
```bash
POST /api/embeddings/generate
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "mode": "auto",
  "entityTypes": ["ticket", "kb_article"],
  "olderThanHours": 24,
  "batchSize": 50,
  "priority": 5
}
```

**Single Entity:**
```bash
POST /api/embeddings/generate
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "mode": "single",
  "entityType": "ticket",
  "entityId": 123
}
```

**Response:**
```json
{
  "success": true,
  "mode": "auto",
  "total": 50,
  "successful": 48,
  "failed": 1,
  "skipped": 1,
  "errors": [
    {
      "entityId": 45,
      "error": "Content too short"
    }
  ],
  "processingTimeMs": 12450
}
```

### 3. Search Suggestions Endpoint

**Request:**
```bash
GET /api/search/suggest?q=passw&limit=5&entity_types=ticket,kb_article
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "query": "passw",
  "suggestions": [
    "password reset",
    "password change",
    "password requirements"
  ],
  "entities": [
    {
      "id": 123,
      "type": "kb_article",
      "title": "Password Reset Guide",
      "relevance": 0.95
    }
  ]
}
```

## Performance Optimization

### Caching Strategy

1. **Embedding Cache**
   - Stores generated embeddings for 1 hour
   - Reduces API calls to OpenAI
   - LRU eviction (max 1000 entries)
   - Average hit rate: 40-60%

2. **Search Cache**
   - Stores search results for 5 minutes
   - Perfect for repeated searches
   - LRU eviction (max 500 entries)
   - Average hit rate: 20-30%

### Batch Processing

- Process 20 entities per batch (configurable)
- 1-second pause between batches for rate limiting
- Skip recently updated embeddings (< 24 hours)
- Priority-based queue processing

### Query Optimization

- Pre-filter embeddings by entity type
- Use indexed lookups for entity IDs
- Limit vector comparisons with threshold
- Parallel execution of semantic and keyword searches

## Monitoring and Maintenance

### Get System Statistics

```bash
GET /api/search/semantic/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "embeddings": {
    "totalEmbeddings": 1542,
    "embeddingsByType": {
      "ticket": 890,
      "kb_article": 452,
      "comment": 200
    },
    "averageVectorDimension": 1536,
    "oldestEmbedding": "2024-01-15T10:30:00Z",
    "newestEmbedding": "2024-01-20T14:22:00Z"
  },
  "cache": {
    "embeddings": {
      "size": 450,
      "maxSize": 1000,
      "hitRate": 0.52
    },
    "searches": {
      "size": 120,
      "maxSize": 500,
      "hitRate": 0.28
    }
  }
}
```

### Clear Caches

```bash
DELETE /api/embeddings/generate/cache
Authorization: Bearer <admin-token>
```

### Scheduled Maintenance

Run periodic embedding updates (recommended: daily cron job):

```typescript
import { schedulePeriodicEmbeddingUpdates } from '@/lib/ai/embedding-utils';

// In your cron job or scheduled task
const vectorDb = await getVectorDb();
const result = await schedulePeriodicEmbeddingUpdates(vectorDb);
console.log(`Updated ${result.successful} embeddings`);
```

## Best Practices

### 1. Embedding Generation

- **Always preprocess text** before generating embeddings
- **Check quality** using `analyzeEmbeddingQuality()`
- **Use batch mode** for bulk operations
- **Set appropriate priorities** for different entity types
- **Monitor costs** - embeddings use OpenAI API

### 2. Search Configuration

- **Adjust weights** based on use case:
  - Technical support: 60% semantic, 40% keyword
  - General search: 70% semantic, 30% keyword
  - Exact matches needed: 30% semantic, 70% keyword

- **Set appropriate thresholds**:
  - High precision: threshold = 0.85
  - Balanced: threshold = 0.75
  - High recall: threshold = 0.60

### 3. Performance

- **Enable caching** for production (useCache: true)
- **Limit maxResults** to reasonable values (10-50)
- **Use facets** to help users refine searches
- **Implement pagination** for large result sets

### 4. Maintenance

- **Run auto-generation weekly** to catch new content
- **Monitor embedding quality** using the stats endpoint
- **Clear caches** if seeing stale results
- **Archive old embeddings** for deleted entities

## Troubleshooting

### Low Search Quality

1. Check embedding coverage:
   ```bash
   GET /api/search/semantic/stats
   ```

2. Generate missing embeddings:
   ```bash
   POST /api/embeddings/generate
   { "mode": "auto", "olderThanHours": 168 }
   ```

3. Adjust search weights and thresholds

### High Latency

1. Check cache hit rates in stats
2. Reduce maxResults if too high
3. Consider pre-warming caches
4. Optimize database indexes

### Poor Relevance

1. Verify text preprocessing
2. Check embedding quality scores
3. Adjust semantic/keyword weights
4. Review threshold settings
5. Combine with traditional filters

## Migration Guide

### From Keyword-Only Search

1. Generate embeddings for existing content:
   ```typescript
   await autoGenerateEmbeddings(vectorDb, {
     entityTypes: ['ticket', 'kb_article'],
     olderThanHours: 8760, // 1 year
     batchSize: 100
   });
   ```

2. Start with conservative hybrid search:
   ```typescript
   {
     semanticWeight: 0.3,
     keywordWeight: 0.7
   }
   ```

3. Gradually increase semantic weight as users adapt

4. Monitor search metrics and user feedback

5. Fine-tune weights based on analytics

## Cost Considerations

### OpenAI API Costs

- Model: `text-embedding-3-small`
- Price: ~$0.00002 per 1K tokens
- Average ticket: ~500 tokens = $0.00001
- 1000 tickets: ~$0.01
- Monthly (10K new tickets): ~$0.10

### Optimization Tips

1. **Use caching aggressively** - saves 40-60% of API calls
2. **Batch process** off-peak hours
3. **Skip unchanged content** (24-hour rule)
4. **Quality filter** - don't embed low-quality content
5. **Consider local models** for very high volume

## Next Steps

1. **Implement background jobs** for scheduled embedding generation
2. **Add semantic clustering** for ticket categorization
3. **Build recommendation engine** using embeddings
4. **Create analytics dashboard** for search metrics
5. **A/B test** different weight configurations
6. **Implement federated search** across multiple data sources

## Support

For issues or questions:
1. Check logs in monitoring system
2. Review stats endpoint for system health
3. Consult this documentation
4. File an issue with detailed reproduction steps
