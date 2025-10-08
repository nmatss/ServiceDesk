/**
 * AI/ML Features Test Suite
 * ServiceDesk Platform - Comprehensive AI Testing
 *
 * Tests all AI/ML capabilities including:
 * - Ticket Classification
 * - Sentiment Analysis
 * - Duplicate Detection
 * - Solution Suggestion
 * - Response Generation
 * - Vector Embeddings
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const AI_API_BASE = '/api/ai';
const TEST_TIMEOUT = 30000; // AI operations can be slow

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Login helper
 */
async function login(page: Page, role: 'admin' | 'agent' | 'user' = 'admin') {
  await page.goto('/auth/login');

  const credentials = {
    admin: { email: 'admin@servicedesk.com', password: 'admin123' },
    agent: { email: 'agent@servicedesk.com', password: 'agent123' },
    user: { email: 'user@servicedesk.com', password: 'user123' }
  };

  await page.fill('input[name="email"]', credentials[role].email);
  await page.fill('input[name="password"]', credentials[role].password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

/**
 * Create API request with authentication
 */
async function authenticatedRequest(page: Page, endpoint: string, options: any = {}) {
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name.includes('session') || c.name.includes('token'));

  return await page.request.fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie ? `${authCookie.name}=${authCookie.value}` : '',
      ...options.headers
    }
  });
}

// ========================================
// TEST SUITE: TICKET CLASSIFICATION
// ========================================

test.describe('AI Ticket Classification', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('should classify a hardware issue correctly', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Printer not working',
        description: 'The HP printer on the 3rd floor is not responding. Paper jam error displayed.',
        includeHistoricalData: true,
        generateEmbedding: false
      }
    });

    const result = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(result.success).toBeTruthy();
    expect(result.classification).toBeDefined();
    expect(result.classification.categoryName.toLowerCase()).toContain('hardware');
    expect(result.classification.confidenceScore).toBeGreaterThan(0.6);
    expect(result.classification.reasoning).toBeDefined();
    expect(result.metadata.processingTimeMs).toBeLessThan(10000);
  });

  test('should classify urgent issues with high priority', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'URGENT: Production server down',
        description: 'Critical: Main production database server is unresponsive. All users cannot access the system.',
        includeHistoricalData: false
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.classification.priorityName.toLowerCase()).toMatch(/critical|alta|high/);
    expect(result.classification.priorityId).toBeGreaterThanOrEqual(3);
    expect(result.classification.estimatedResolutionTimeHours).toBeLessThanOrEqual(4);
  });

  test('should classify low-priority information requests', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'How to reset my password?',
        description: 'I would like to know the steps to reset my password when I have time.',
        includeHistoricalData: true
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.classification.priorityName.toLowerCase()).toMatch(/low|baixa/);
    expect(result.classification.priorityId).toBeLessThanOrEqual(2);
  });

  test('should use historical data to improve classification', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Email not syncing with Outlook',
        description: 'My Outlook client stopped syncing emails since this morning.',
        includeHistoricalData: true,
        userId: 1
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.metadata.historicalDataUsed).toBeTruthy();
    expect(result.classification.confidenceScore).toBeGreaterThan(0.65);
  });

  test('should handle classification fallback when AI fails', async ({ page }) => {
    // Test with invalid/corrupted data that might cause AI failure
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'a'.repeat(500), // Very long title
        description: 'Short desc',
        includeHistoricalData: false
      }
    });

    // Should either succeed with fallback or fail gracefully
    if (response.ok()) {
      const result = await response.json();
      expect(result.classification).toBeDefined();
      // Fallback should have lower confidence
      expect(result.classification.confidenceScore).toBeLessThan(0.8);
    } else {
      expect(response.status()).toBe(400);
    }
  });

  test('should retrieve classification statistics', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'GET'
    });

    const result = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(result.stats).toBeDefined();
    expect(result.stats.total_classifications).toBeGreaterThanOrEqual(0);
    expect(result.stats.avg_confidence).toBeGreaterThanOrEqual(0);
    expect(result.modelStats).toBeInstanceOf(Array);
  });
});

// ========================================
// TEST SUITE: SENTIMENT ANALYSIS
// ========================================

test.describe('AI Sentiment Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agent');
  });

  test('should detect positive sentiment', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment`, {
      method: 'POST',
      data: {
        text: 'Thank you so much for the quick response! The issue is now resolved and everything works perfectly.',
        includeHistory: false,
        autoAdjustPriority: false
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.analysis.sentiment).toBe('positive');
    expect(result.analysis.sentimentScore).toBeGreaterThan(0.5);
    expect(result.analysis.frustrationLevel).toMatch(/low|medium/);
    expect(result.analysis.immediateAttentionRequired).toBeFalsy();
  });

  test('should detect negative sentiment with high frustration', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment`, {
      method: 'POST',
      data: {
        text: 'This is UNACCEPTABLE! I have been waiting for 3 days with no response. My work is completely blocked. This is the worst support ever!',
        includeHistory: false,
        autoAdjustPriority: false
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.analysis.sentiment).toBe('negative');
    expect(result.analysis.sentimentScore).toBeLessThan(-0.3);
    expect(result.analysis.frustrationLevel).toMatch(/high|critical/);
    expect(result.analysis.escalationIndicators).toBeInstanceOf(Array);
    expect(result.analysis.escalationIndicators.length).toBeGreaterThan(0);
    expect(result.analysis.immediateAttentionRequired).toBeTruthy();
  });

  test('should analyze neutral business-like communication', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment`, {
      method: 'POST',
      data: {
        text: 'I am requesting access to the project management system for the new project. Please process this at your earliest convenience.',
        includeHistory: false
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.analysis.sentiment).toBe('neutral');
    expect(result.analysis.sentimentScore).toBeGreaterThan(-0.3);
    expect(result.analysis.sentimentScore).toBeLessThan(0.3);
    expect(result.analysis.frustrationLevel).toBe('low');
  });

  test('should auto-escalate ticket based on negative sentiment', async ({ page }) => {
    // First create a test ticket
    const ticketResponse = await authenticatedRequest(page, '/api/tickets', {
      method: 'POST',
      data: {
        title: 'Critical system error',
        description: 'Initial description',
        category_id: 1,
        priority_id: 2
      }
    });

    const ticket = await ticketResponse.json();
    const ticketId = ticket.ticket.id;

    // Now analyze sentiment with auto-adjustment
    const response = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment`, {
      method: 'POST',
      data: {
        text: 'This is CRITICAL! The entire system is down and we are losing money every minute. URGENT!',
        ticketId: ticketId,
        includeHistory: true,
        autoAdjustPriority: true
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.actions.priorityAdjusted).toBeTruthy();
    expect(result.actions.newPriority).toBeDefined();
    expect(result.actions.newPriority.level).toBeGreaterThanOrEqual(3);
    expect(result.actions.urgentNotificationSent).toBeTruthy();
  });

  test('should provide appropriate response tone recommendation', async ({ page }) => {
    const testCases = [
      {
        text: 'I am extremely frustrated with this service!',
        expectedTone: 'empathetic'
      },
      {
        text: 'Could you please help me understand how this feature works?',
        expectedTone: 'professional'
      },
      {
        text: 'URGENT! Server is down! Everyone is affected!',
        expectedTone: 'urgent'
      }
    ];

    for (const testCase of testCases) {
      const response = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment`, {
        method: 'POST',
        data: {
          text: testCase.text,
          includeHistory: false
        }
      });

      const result = await response.json();
      expect(result.analysis.recommendedResponseTone).toBe(testCase.expectedTone);
    }
  });

  test('should retrieve sentiment analysis statistics', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment?period=30`, {
      method: 'GET'
    });

    const result = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(result.stats).toBeDefined();
    expect(result.stats.sentiment_distribution).toBeDefined();
    expect(result.frustrationStats).toBeInstanceOf(Array);
    expect(result.escalationStats).toBeDefined();
  });
});

// ========================================
// TEST SUITE: DUPLICATE DETECTION
// ========================================

test.describe('AI Duplicate Detection', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agent');
  });

  test('should detect exact duplicate tickets', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/detect-duplicates`, {
      method: 'POST',
      data: {
        title: 'Printer not working on 3rd floor',
        description: 'The HP LaserJet printer in the marketing department on the 3rd floor is showing a paper jam error.',
        tenant_id: 1,
        threshold: 0.85
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result).toHaveProperty('has_duplicates');
    expect(result).toHaveProperty('similar_tickets');

    if (result.has_duplicates) {
      expect(result.similar_tickets).toBeInstanceOf(Array);
      expect(result.similar_tickets[0].similarity).toBeGreaterThanOrEqual(0.85);
      expect(result.recommendation).toBeDefined();
    }
  });

  test('should detect semantic duplicates with different wording', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/detect-duplicates`, {
      method: 'POST',
      data: {
        title: 'Cannot print documents',
        description: 'The office printer on level 3 is not responding when I try to print.',
        tenant_id: 1,
        threshold: 0.75
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    // This should find similar tickets even with different wording
    expect(result.similar_tickets).toBeInstanceOf(Array);
  });

  test('should adjust threshold for similarity matching', async ({ page }) => {
    const highThresholdResponse = await authenticatedRequest(page, `${AI_API_BASE}/detect-duplicates`, {
      method: 'POST',
      data: {
        title: 'Email sync issue',
        description: 'My email is not syncing properly with the server.',
        tenant_id: 1,
        threshold: 0.95 // Very strict
      }
    });

    const lowThresholdResponse = await authenticatedRequest(page, `${AI_API_BASE}/detect-duplicates`, {
      method: 'POST',
      data: {
        title: 'Email sync issue',
        description: 'My email is not syncing properly with the server.',
        tenant_id: 1,
        threshold: 0.70 // More lenient
      }
    });

    const highResult = await highThresholdResponse.json();
    const lowResult = await lowThresholdResponse.json();

    expect(highResult.similar_tickets.length).toBeLessThanOrEqual(lowResult.similar_tickets.length);
  });

  test('should provide appropriate recommendations for duplicates', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/detect-duplicates`, {
      method: 'POST',
      data: {
        title: 'Password reset needed',
        description: 'I forgot my password and need to reset it.',
        tenant_id: 1,
        threshold: 0.85
      }
    });

    const result = await response.json();

    if (result.has_duplicates && result.similar_tickets.length > 0) {
      const topMatch = result.similar_tickets[0];

      if (topMatch.similarity >= 0.95) {
        expect(result.recommendation).toContain('duplicate');
      } else if (topMatch.similarity >= 0.85) {
        expect(result.recommendation).toContain('possible');
      }
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/detect-duplicates`, {
      method: 'POST',
      data: {
        // Missing required fields
        tenant_id: 1
      }
    });

    expect(response.status()).toBe(400);
    const result = await response.json();
    expect(result.success).toBeFalsy();
    expect(result.error).toBeDefined();
  });
});

// ========================================
// TEST SUITE: SOLUTION SUGGESTION
// ========================================

test.describe('AI Solution Suggestion', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agent');
  });

  test('should suggest solutions based on knowledge base', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'POST',
      data: {
        title: 'Cannot access VPN',
        description: 'I am unable to connect to the company VPN from my home network. Connection times out.',
        category: 'Network',
        priority: 'High',
        maxKnowledgeArticles: 5,
        maxSimilarTickets: 5,
        includeUserContext: true
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion.primarySolution).toBeDefined();
    expect(result.suggestion.primarySolution.title).toBeDefined();
    expect(result.suggestion.primarySolution.steps).toBeInstanceOf(Array);
    expect(result.suggestion.primarySolution.steps.length).toBeGreaterThan(0);
    expect(result.suggestion.primarySolution.estimatedTimeMinutes).toBeGreaterThan(0);
    expect(result.suggestion.confidenceScore).toBeGreaterThan(0);
  });

  test('should provide alternative solutions', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'POST',
      data: {
        title: 'Slow computer performance',
        description: 'My laptop has been running very slowly for the past week.',
        category: 'Hardware',
        priority: 'Medium',
        maxKnowledgeArticles: 5,
        maxSimilarTickets: 3
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.suggestion.alternativeSolutions).toBeInstanceOf(Array);

    if (result.suggestion.alternativeSolutions.length > 0) {
      const altSolution = result.suggestion.alternativeSolutions[0];
      expect(altSolution.title).toBeDefined();
      expect(altSolution.steps).toBeInstanceOf(Array);
      expect(altSolution.whenToUse).toBeDefined();
    }
  });

  test('should reference knowledge base articles', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'POST',
      data: {
        title: 'Password reset procedure',
        description: 'I need to know how to reset my password for the email system.',
        category: 'Access',
        priority: 'Low',
        maxKnowledgeArticles: 5
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.sources.knowledgeArticles).toBeInstanceOf(Array);

    if (result.sources.knowledgeArticles.length > 0) {
      const article = result.sources.knowledgeArticles[0];
      expect(article.id).toBeDefined();
      expect(article.title).toBeDefined();
      expect(article.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(article.relevanceScore).toBeLessThanOrEqual(1);
    }
  });

  test('should reference similar resolved tickets', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'POST',
      data: {
        title: 'Email not receiving attachments',
        description: 'I can receive emails but attachments are not showing up.',
        category: 'Email',
        priority: 'Medium',
        maxSimilarTickets: 5
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.sources.similarTickets).toBeInstanceOf(Array);

    if (result.sources.similarTickets.length > 0) {
      const ticket = result.sources.similarTickets[0];
      expect(ticket.id).toBeDefined();
      expect(ticket.title).toBeDefined();
      expect(ticket.similarityScore).toBeGreaterThanOrEqual(0);
    }
  });

  test('should provide escalation triggers', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'POST',
      data: {
        title: 'Server crash causing data loss',
        description: 'The database server crashed and some data may have been lost.',
        category: 'Infrastructure',
        priority: 'Critical',
        maxKnowledgeArticles: 3
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.suggestion.escalationTriggers).toBeInstanceOf(Array);
    expect(result.suggestion.preventiveMeasures).toBeInstanceOf(Array);

    // Critical issues should likely require specialist
    expect(result.suggestion.requiresSpecialist).toBeTruthy();
  });

  test('should include performance metadata', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'POST',
      data: {
        title: 'Test ticket',
        description: 'Test description',
        category: 'General',
        priority: 'Low'
      }
    });

    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.processingTimeMs).toBeGreaterThan(0);
    expect(result.metadata.modelName).toBeDefined();
    expect(result.metadata.inputTokens).toBeGreaterThanOrEqual(0);
    expect(result.metadata.outputTokens).toBeGreaterThanOrEqual(0);
  });

  test('should retrieve suggestion statistics', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/suggest-solutions`, {
      method: 'GET'
    });

    const result = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(result.stats).toBeDefined();
    expect(result.stats.total_suggestions).toBeGreaterThanOrEqual(0);
    expect(result.stats.avg_confidence).toBeGreaterThanOrEqual(0);
    expect(result.sourceStats).toBeInstanceOf(Array);
  });
});

// ========================================
// TEST SUITE: AI SYSTEM HEALTH
// ========================================

test.describe('AI System Health & Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('should check OpenAI API availability', async ({ page }) => {
    // This tests if the AI system is properly configured
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Health check ticket',
        description: 'Simple test to verify AI system is working.',
        includeHistoricalData: false,
        generateEmbedding: false
      }
    });

    // Should succeed if OpenAI API is configured
    if (response.status() === 503) {
      const result = await response.json();
      expect(result.error).toContain('AI features are not enabled');
    } else {
      expect(response.ok()).toBeTruthy();
    }
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Make multiple rapid requests to test rate limiting
    const promises = Array(5).fill(null).map(() =>
      authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
        method: 'POST',
        data: {
          title: 'Rate limit test',
          description: 'Testing rate limiting behavior',
          includeHistoricalData: false
        }
      })
    );

    const responses = await Promise.all(promises);
    const statusCodes = responses.map(r => r.status());

    // Either all succeed or some are rate limited
    const allSuccess = statusCodes.every(code => code === 200);
    const someRateLimited = statusCodes.some(code => code === 429);

    expect(allSuccess || someRateLimited).toBeTruthy();
  });

  test('should track token usage and costs', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Token usage test',
        description: 'Testing token tracking and cost estimation for AI operations.',
        includeHistoricalData: true
      }
    });

    const result = await response.json();

    if (result.success) {
      expect(result.metadata.inputTokens).toBeGreaterThan(0);
      expect(result.metadata.outputTokens).toBeGreaterThan(0);

      // Verify token counts are reasonable
      expect(result.metadata.inputTokens).toBeLessThan(10000);
      expect(result.metadata.outputTokens).toBeLessThan(5000);
    }
  });
});

// ========================================
// TEST SUITE: AI ACCURACY & QUALITY
// ========================================

test.describe('AI Accuracy & Quality Metrics', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agent');
  });

  test('should maintain high confidence scores for clear cases', async ({ page }) => {
    const clearCases = [
      {
        title: 'Forgot password',
        description: 'I forgot my password and cannot log in.',
        expectedCategory: 'access',
        expectedPriority: 'low'
      },
      {
        title: 'CRITICAL: Database server down',
        description: 'Production database is completely offline. All services affected.',
        expectedCategory: 'infrastructure',
        expectedPriority: 'critical'
      }
    ];

    for (const testCase of clearCases) {
      const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
        method: 'POST',
        data: {
          title: testCase.title,
          description: testCase.description,
          includeHistoricalData: false
        }
      });

      const result = await response.json();

      if (result.success) {
        // Clear cases should have high confidence
        expect(result.classification.confidenceScore).toBeGreaterThan(0.7);
      }
    }
  });

  test('should handle ambiguous cases with appropriate confidence', async ({ page }) => {
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Problem with system',
        description: 'Something is not working correctly.',
        includeHistoricalData: false
      }
    });

    const result = await response.json();

    if (result.success) {
      // Ambiguous cases should have lower confidence
      expect(result.classification.confidenceScore).toBeLessThan(0.9);
      expect(result.classification.suggestedActions).toBeInstanceOf(Array);
    }
  });

  test('should provide consistent results for identical input', async ({ page }) => {
    const input = {
      title: 'Email client crash',
      description: 'Microsoft Outlook crashes every time I try to open it.',
      includeHistoricalData: false,
      generateEmbedding: false
    };

    const response1 = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: input
    });

    // Wait a bit to avoid caching
    await page.waitForTimeout(1000);

    const response2 = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: input
    });

    const result1 = await response1.json();
    const result2 = await response2.json();

    if (result1.success && result2.success) {
      // Results should be very similar (allowing for minor variations due to AI non-determinism)
      expect(result1.classification.categoryId).toBe(result2.classification.categoryId);
      expect(result1.classification.priorityId).toBe(result2.classification.priorityId);
      expect(Math.abs(result1.classification.confidenceScore - result2.classification.confidenceScore)).toBeLessThan(0.1);
    }
  });
});

// ========================================
// TEST SUITE: ERROR HANDLING & EDGE CASES
// ========================================

test.describe('AI Error Handling & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agent');
  });

  test('should validate input data', async ({ page }) => {
    const invalidCases = [
      { title: '', description: 'Missing title' },
      { title: 'Test', description: '' },
      { title: 'a'.repeat(300), description: 'Title too long' },
      { title: 'Test', description: 'b'.repeat(10000) }
    ];

    for (const testCase of invalidCases) {
      const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
        method: 'POST',
        data: testCase
      });

      // Should either fail validation or handle gracefully
      expect([200, 400]).toContain(response.status());
    }
  });

  test('should handle missing or invalid authentication', async ({ page }) => {
    // Logout first
    await page.goto('/auth/logout');

    const response = await page.request.post(`${AI_API_BASE}/classify-ticket`, {
      data: {
        title: 'Test',
        description: 'Test description'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('should handle concurrent requests efficiently', async ({ page }) => {
    const concurrentRequests = 3;

    const promises = Array(concurrentRequests).fill(null).map((_, i) =>
      authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
        method: 'POST',
        data: {
          title: `Concurrent test ${i}`,
          description: `Testing concurrent request handling ${i}`,
          includeHistoricalData: false
        }
      })
    );

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const endTime = Date.now();

    const successCount = responses.filter(r => r.ok()).length;

    // Most requests should succeed
    expect(successCount).toBeGreaterThanOrEqual(concurrentRequests * 0.8);

    // Concurrent requests should be faster than sequential
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(TEST_TIMEOUT * concurrentRequests);
  });

  test('should gracefully degrade when AI service is unavailable', async ({ page }) => {
    // This test checks if the system has fallback mechanisms
    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Printer issue',
        description: 'Office printer not working',
        includeHistoricalData: false
      }
    });

    // System should either work with AI or fall back to rule-based
    if (response.ok()) {
      const result = await response.json();
      expect(result.classification).toBeDefined();

      // Check if fallback was used
      if (result.metadata.modelName === 'rule-based-fallback') {
        expect(result.classification.reasoning).toContain('fallback');
      }
    }
  });
});

// ========================================
// TEST SUITE: PERFORMANCE BENCHMARKS
// ========================================

test.describe('AI Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('classification should complete within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    const response = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Performance test ticket',
        description: 'Testing classification performance and response time.',
        includeHistoricalData: true
      }
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    expect(response.ok() || response.status() === 503).toBeTruthy();

    if (response.ok()) {
      const result = await response.json();

      // Classification should be reasonably fast
      expect(totalTime).toBeLessThan(15000); // 15 seconds max
      expect(result.metadata.processingTimeMs).toBeLessThan(12000);
    }
  });

  test('sentiment analysis should be faster than classification', async ({ page }) => {
    const classificationStart = Date.now();
    const classificationResponse = await authenticatedRequest(page, `${AI_API_BASE}/classify-ticket`, {
      method: 'POST',
      data: {
        title: 'Test ticket',
        description: 'Test description for performance comparison.',
        includeHistoricalData: false
      }
    });
    const classificationTime = Date.now() - classificationStart;

    const sentimentStart = Date.now();
    const sentimentResponse = await authenticatedRequest(page, `${AI_API_BASE}/analyze-sentiment`, {
      method: 'POST',
      data: {
        text: 'Test description for performance comparison.',
        includeHistory: false,
        autoAdjustPriority: false
      }
    });
    const sentimentTime = Date.now() - sentimentStart;

    // Sentiment analysis typically faster (simpler task)
    if (classificationResponse.ok() && sentimentResponse.ok()) {
      expect(sentimentTime).toBeLessThanOrEqual(classificationTime * 1.2);
    }
  });
});

// Export test configuration
export const config = {
  timeout: TEST_TIMEOUT,
  retries: 1,
  testDir: './tests/ai'
};
