# AI APIs Quick Reference Guide

## Quick Start

All AI endpoints require:
1. **Authentication**: JWT token in `Authorization: Bearer <token>` header
2. **Content-Type**: `application/json`
3. **Rate Limits**: Check response headers for remaining quota

## Endpoints Overview

| Endpoint | Method | Rate Limit | Purpose |
|----------|--------|------------|---------|
| `/api/ai/classify-ticket` | POST | 100/15min | Auto-classify tickets |
| `/api/ai/suggest-solutions` | POST | 60/15min | Get solution suggestions |
| `/api/ai/detect-duplicates` | POST | 50/15min | Find duplicate tickets |
| `/api/ai/analyze-sentiment` | POST | 80/15min | Analyze sentiment |
| `/api/ai/generate-response` | POST | 50/15min | Generate agent responses |

## 1. Classify Ticket

**Use Case**: Automatically categorize and prioritize new tickets

```bash
curl -X POST https://your-domain.com/api/ai/classify-ticket \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cannot login to email",
    "description": "Getting authentication error when trying to access Outlook",
    "userId": 123
  }'
```

**Minimal Request**:
```json
{
  "title": "string (required, max 200)",
  "description": "string (required, max 5000)"
}
```

**Optional Fields**:
```json
{
  "userId": "number",
  "includeHistoricalData": "boolean (default: true)",
  "generateEmbedding": "boolean (default: true)"
}
```

**Response**:
```json
{
  "success": true,
  "classification": {
    "categoryId": 5,
    "categoryName": "Email & Communication",
    "priorityId": 2,
    "priorityName": "Medium",
    "confidenceScore": 0.92,
    "reasoning": "...",
    "suggestedActions": ["...", "..."],
    "estimatedResolutionTimeHours": 2
  }
}
```

---

## 2. Suggest Solutions

**Use Case**: Get AI-powered solution recommendations

```bash
curl -X POST https://your-domain.com/api/ai/suggest-solutions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "VPN connection drops frequently",
    "description": "VPN disconnects every 10-15 minutes",
    "category": "Network",
    "priority": "High"
  }'
```

**Required Fields**:
```json
{
  "title": "string (required)",
  "description": "string (required)",
  "category": "string (required)",
  "priority": "string (required)"
}
```

**Optional Fields**:
```json
{
  "ticketId": "number",
  "maxKnowledgeArticles": "number (1-10, default: 5)",
  "maxSimilarTickets": "number (1-10, default: 5)",
  "includeUserContext": "boolean (default: true)"
}
```

**Response**:
```json
{
  "success": true,
  "suggestion": {
    "primarySolution": {
      "title": "...",
      "steps": ["step1", "step2"],
      "estimatedTimeMinutes": 30,
      "difficultyLevel": "medium",
      "successProbability": 0.85
    },
    "alternativeSolutions": [...],
    "confidenceScore": 0.88
  }
}
```

---

## 3. Detect Duplicates

**Use Case**: Find duplicate or similar tickets before creation

```bash
curl -X POST https://your-domain.com/api/ai/detect-duplicates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Printer not working",
    "description": "HP printer in Conference Room A not responding"
  }'
```

**Required Fields**:
```json
{
  "title": "string (required, max 200)",
  "description": "string (required, max 5000)"
}
```

**Optional Fields**:
```json
{
  "userId": "number",
  "timeWindowHours": "number (1-720, default: 72)",
  "threshold": "number (0-1, default: 0.75)",
  "autoHandle": "boolean (default: false)"
}
```

**Response**:
```json
{
  "success": true,
  "detection": {
    "isDuplicate": true,
    "confidence": 0.92,
    "duplicateCount": 2,
    "recommendedAction": "review_duplicates"
  },
  "duplicates": [
    {
      "ticketId": 456,
      "similarity": 0.94,
      "duplicateType": "exact",
      "recommendedAction": "merge"
    }
  ]
}
```

---

## 4. Analyze Sentiment

**Use Case**: Detect customer emotion and urgency

```bash
curl -X POST https://your-domain.com/api/ai/analyze-sentiment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is urgent! System is down and affecting production!",
    "ticketId": 567,
    "autoAdjustPriority": true
  }'
```

**Required Fields**:
```json
{
  "text": "string (required, max 5000)"
}
```

**Optional Fields**:
```json
{
  "ticketId": "number",
  "includeHistory": "boolean (default: true)",
  "autoAdjustPriority": "boolean (default: false)"
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "sentiment": "negative",
    "sentimentScore": -0.75,
    "frustrationLevel": "high",
    "emotionalUrgency": "high",
    "recommendedResponseTone": "empathetic",
    "immediateAttentionRequired": true
  },
  "actions": {
    "priorityAdjusted": true,
    "newPriority": {"id": 4, "name": "Critical"}
  }
}
```

---

## 5. Generate Response

**Use Case**: AI-assisted response drafting for agents

```bash
curl -X POST https://your-domain.com/api/ai/generate-response \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": 890,
    "responseType": "initial_response",
    "tone": "professional"
  }'
```

**Required Fields**:
```json
{
  "ticketId": "number (required)"
}
```

**Optional Fields**:
```json
{
  "responseType": "enum: initial_response|follow_up|resolution|escalation (default: initial_response)",
  "tone": "enum: professional|friendly|technical|formal (default: professional)",
  "includeKnowledgeBase": "boolean (default: true)",
  "maxKnowledgeArticles": "number (1-5, default: 3)",
  "customContext": "string"
}
```

**Response**:
```json
{
  "success": true,
  "response": {
    "text": "Dear [User],\n\n...",
    "type": "initial_response",
    "tone": "professional",
    "nextActions": ["Send response", "Set follow-up"],
    "escalationNeeded": false
  }
}
```

**Note**: This endpoint requires `agent`, `admin`, or `manager` role.

---

## Error Responses

All endpoints return consistent error format:

**400 Bad Request** (Validation Error):
```json
{
  "error": "Invalid input",
  "details": [
    {
      "path": ["title"],
      "message": "Title is required"
    }
  ]
}
```

**401 Unauthorized**:
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden**:
```json
{
  "error": "Insufficient permissions"
}
```

**429 Too Many Requests**:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 300
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Rate Limit Headers

Check these headers in every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2025-12-05T15:30:00Z
Retry-After: 300 (only when rate limited)
```

---

## Best Practices

### 1. Always Check Rate Limits
```javascript
const response = await fetch('/api/ai/classify-ticket', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Rate limit almost exceeded!');
}
```

### 2. Handle Errors Gracefully
```javascript
try {
  const data = await response.json();
  if (!data.success) {
    // Handle AI error with fallback
    return fallbackClassification(ticket);
  }
  return data;
} catch (error) {
  console.error('AI API error:', error);
  return fallbackClassification(ticket);
}
```

### 3. Use TypeScript Types
```typescript
interface ClassificationRequest {
  title: string;
  description: string;
  userId?: number;
  includeHistoricalData?: boolean;
  generateEmbedding?: boolean;
}

interface ClassificationResponse {
  success: boolean;
  classification: {
    categoryId: number;
    categoryName: string;
    priorityId: number;
    priorityName: string;
    confidenceScore: number;
    reasoning: string;
    suggestedActions: string[];
    estimatedResolutionTimeHours: number;
  };
  metadata: {
    processingTimeMs: number;
    modelName: string;
    // ...
  };
  rateLimit: {
    limit: number;
    remaining: number;
    reset: string;
  };
}
```

### 4. Cache Results When Appropriate
```javascript
const cacheKey = `ai-classification-${hash(title, description)}`;
const cached = cache.get(cacheKey);
if (cached) return cached;

const result = await classifyTicket(data);
cache.set(cacheKey, result, 300); // 5 minutes
return result;
```

### 5. Monitor Performance
```javascript
const startTime = Date.now();
const result = await fetch('/api/ai/classify-ticket', {...});
const duration = Date.now() - startTime;

if (duration > 1000) {
  console.warn(`Slow AI response: ${duration}ms`);
}
```

---

## Common Use Cases

### Use Case 1: Smart Ticket Creation
```javascript
async function createSmartTicket(ticketData) {
  // 1. Check for duplicates
  const duplicates = await detectDuplicates({
    title: ticketData.title,
    description: ticketData.description
  });

  if (duplicates.detection.isDuplicate) {
    return { warning: 'Possible duplicate', duplicates };
  }

  // 2. Classify ticket
  const classification = await classifyTicket({
    title: ticketData.title,
    description: ticketData.description,
    userId: ticketData.userId
  });

  // 3. Create ticket with AI suggestions
  return createTicket({
    ...ticketData,
    categoryId: classification.classification.categoryId,
    priorityId: classification.classification.priorityId,
    aiSuggestions: classification.classification.suggestedActions
  });
}
```

### Use Case 2: Intelligent Agent Workflow
```javascript
async function handleTicket(ticketId) {
  // 1. Get solution suggestions
  const suggestions = await getSuggestions({
    ticketId,
    // ... ticket data
  });

  // 2. Generate initial response
  const response = await generateResponse({
    ticketId,
    responseType: 'initial_response',
    tone: 'professional'
  });

  // 3. Present to agent
  return {
    suggestedSolutions: suggestions.suggestion.primarySolution,
    draftResponse: response.response.text,
    nextActions: response.response.nextActions
  };
}
```

### Use Case 3: Real-time Sentiment Monitoring
```javascript
async function onNewComment(comment) {
  // Analyze sentiment
  const sentiment = await analyzeSentiment({
    text: comment.content,
    ticketId: comment.ticketId,
    autoAdjustPriority: true
  });

  // Alert if urgent attention needed
  if (sentiment.analysis.immediateAttentionRequired) {
    await notifyManagers({
      ticketId: comment.ticketId,
      reason: 'High frustration detected',
      sentiment: sentiment.analysis
    });
  }

  return sentiment;
}
```

---

## Environment Setup

Required environment variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Optional AI Configuration
AI_MODEL_NAME=gpt-4o-mini  # Default model
AI_CACHE_TTL=300           # Cache duration in seconds
AI_MAX_RETRIES=3           # Number of retries on failure
AI_TIMEOUT=30000           # Request timeout in ms
```

---

## Testing

### Example Test Cases

```javascript
// Test classification
describe('AI Classification', () => {
  it('should classify ticket correctly', async () => {
    const result = await classifyTicket({
      title: 'Cannot access email',
      description: 'Outlook login fails'
    });

    expect(result.success).toBe(true);
    expect(result.classification.confidenceScore).toBeGreaterThan(0.8);
    expect(result.classification.categoryName).toBeDefined();
  });

  it('should handle rate limiting', async () => {
    // Make 101 requests (exceeds limit of 100)
    for (let i = 0; i < 101; i++) {
      await classifyTicket({...});
    }

    const response = await classifyTicket({...});
    expect(response.status).toBe(429);
  });
});
```

---

## Troubleshooting

### Problem: Rate Limited
**Solution**: Check `X-RateLimit-Reset` header and wait, or implement request queuing

### Problem: Low Confidence Scores
**Solution**: Provide more detailed descriptions, include historical data

### Problem: Slow Response Times
**Solution**: Check if caching is enabled, reduce `maxKnowledgeArticles`/`maxSimilarTickets`

### Problem: Authentication Errors
**Solution**: Verify JWT token is valid and not expired

### Problem: AI Returns Fallback Results
**Solution**: Check OpenAI API key is set, verify API quota, check logs for errors

---

## Support

- **Documentation**: See `AI_APIS_INTEGRATION_REPORT.md` for detailed documentation
- **Logs**: Check application logs for detailed error messages
- **Monitoring**: Review rate limit headers and processing times
- **Database**: Query `ai_classifications` and `ai_suggestions` tables for history

---

**Last Updated**: 2025-12-05
**Version**: 1.0
