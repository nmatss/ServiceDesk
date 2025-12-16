/**
 * K6 Load Test: Search and Knowledge Base
 *
 * Tests search and knowledge base endpoints under load
 *
 * Run: k6 run tests/load/search-knowledge.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const searchFailureRate = new Rate('search_failures');
const kbRetrievalFailureRate = new Rate('kb_retrieval_failures');
const searchDuration = new Trend('search_duration');
const searchesPerformed = new Counter('searches_performed');
const kbArticlesViewed = new Counter('kb_articles_viewed');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 30 },   // Warm up
    { duration: '1m', target: 75 },    // Normal load
    { duration: '30s', target: 150 },  // Peak load
    { duration: '1m', target: 150 },   // Sustained peak
    { duration: '30s', target: 300 },  // Stress test
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    'http_req_duration{name:search}': ['p(95)<800'],
    'http_req_duration{name:kb_article}': ['p(95)<500'],
    search_failures: ['rate<0.05'],
    kb_retrieval_failures: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Search queries that simulate real usage
const SEARCH_QUERIES = [
  'password reset',
  'vpn connection',
  'email setup',
  'printer issue',
  'software installation',
  'network error',
  'login problem',
  'account locked',
  'access denied',
  'system slow',
  'error message',
  'file recovery',
  'backup restore',
  'security update',
  'license activation',
];

// Knowledge base categories
const KB_CATEGORIES = [
  'getting-started',
  'troubleshooting',
  'how-to',
  'faq',
  'policies',
];

export function setup() {
  console.log(`Starting search and KB load test against ${BASE_URL}`);

  // Verify API accessibility
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    'API is accessible': (r) => r.status === 200,
  });

  // Fetch some KB article IDs for testing
  const kbResponse = http.get(`${BASE_URL}/api/knowledge/articles?limit=10`);
  let articleIds = [];

  if (kbResponse.status === 200) {
    try {
      const articles = JSON.parse(kbResponse.body);
      articleIds = articles.map((a) => a.id || a.slug);
    } catch (e) {
      console.warn('Could not parse KB articles');
    }
  }

  return {
    baseUrl: BASE_URL,
    articleIds: articleIds.length > 0 ? articleIds : ['sample-1', 'sample-2'],
  };
}

export default function (data) {
  // Group: Global Search
  group('Global Search', () => {
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];

    const searchParams = {
      tags: { name: 'search' },
    };

    const startTime = Date.now();
    const searchResponse = http.get(
      `${data.baseUrl}/api/search?q=${encodeURIComponent(query)}`,
      searchParams
    );
    const endTime = Date.now();

    const searchSuccess = check(searchResponse, {
      'search status is 200': (r) => r.status === 200,
      'search returns results': (r) => {
        try {
          const json = JSON.parse(r.body);
          return json.results !== undefined || Array.isArray(json);
        } catch {
          return false;
        }
      },
      'search completes under 1s': (r) => (endTime - startTime) < 1000,
    });

    searchFailureRate.add(!searchSuccess);
    searchDuration.add(endTime - startTime);

    if (searchSuccess) {
      searchesPerformed.add(1);
    }
  });

  sleep(0.5);

  // Group: Knowledge Base Search
  group('Knowledge Base Search', () => {
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];

    const kbSearchParams = {
      tags: { name: 'kb_search' },
    };

    const kbSearchResponse = http.get(
      `${data.baseUrl}/api/knowledge/search?q=${encodeURIComponent(query)}`,
      kbSearchParams
    );

    check(kbSearchResponse, {
      'KB search status is 200': (r) => r.status === 200,
      'KB search returns articles': (r) => {
        try {
          const json = JSON.parse(r.body);
          return Array.isArray(json.articles) || Array.isArray(json);
        } catch {
          return false;
        }
      },
    });
  });

  sleep(0.5);

  // Group: Semantic Search (if available)
  group('Semantic Search', () => {
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];

    const semanticParams = {
      tags: { name: 'semantic_search' },
    };

    const semanticResponse = http.get(
      `${data.baseUrl}/api/search/semantic?q=${encodeURIComponent(query)}`,
      semanticParams
    );

    // Semantic search might not be implemented, so accept 404
    check(semanticResponse, {
      'semantic search status is 200 or 404': (r) => [200, 404].includes(r.status),
    });
  });

  sleep(0.5);

  // Group: Knowledge Base Article Retrieval
  group('KB Article Retrieval', () => {
    const articleId = data.articleIds[Math.floor(Math.random() * data.articleIds.length)];

    const articleParams = {
      tags: { name: 'kb_article' },
    };

    const articleResponse = http.get(
      `${data.baseUrl}/api/knowledge/articles/${articleId}`,
      articleParams
    );

    const kbSuccess = check(articleResponse, {
      'KB article status is 200 or 404': (r) => [200, 404].includes(r.status),
      'KB article response is valid': (r) => {
        if (r.status === 404) return true;
        try {
          const json = JSON.parse(r.body);
          return json.id !== undefined || json.title !== undefined;
        } catch {
          return false;
        }
      },
    });

    kbRetrievalFailureRate.add(!kbSuccess);

    if (articleResponse.status === 200) {
      kbArticlesViewed.add(1);
    }
  });

  sleep(0.5);

  // Group: KB Categories
  group('KB Categories', () => {
    const categoriesParams = {
      tags: { name: 'kb_categories' },
    };

    const categoriesResponse = http.get(
      `${data.baseUrl}/api/knowledge/categories`,
      categoriesParams
    );

    check(categoriesResponse, {
      'KB categories status is 200': (r) => r.status === 200,
      'KB categories returns array': (r) => {
        try {
          const json = JSON.parse(r.body);
          return Array.isArray(json) || Array.isArray(json.categories);
        } catch {
          return false;
        }
      },
    });
  });

  sleep(0.5);

  // Group: Advanced Search with Filters
  group('Advanced Search', () => {
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    const category = KB_CATEGORIES[Math.floor(Math.random() * KB_CATEGORIES.length)];

    const advancedParams = {
      tags: { name: 'advanced_search' },
    };

    const advancedResponse = http.get(
      `${data.baseUrl}/api/knowledge/search?q=${encodeURIComponent(query)}&category=${category}&limit=20`,
      advancedParams
    );

    check(advancedResponse, {
      'advanced search status is 200': (r) => r.status === 200,
    });
  });

  // Think time
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  console.log('Search and KB load test completed');
  console.log(`Total searches performed: ${searchesPerformed.value || 0}`);
  console.log(`Total KB articles viewed: ${kbArticlesViewed.value || 0}`);
}

export function handleSummary(data) {
  return {
    'reports/load/search-knowledge-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';

  let summary = '\n';
  summary += `${indent}=== Search & Knowledge Base Load Test Results ===\n\n`;
  summary += `${indent}Checks............: ${data.metrics.checks.values.passes || 0} / ${(data.metrics.checks.values.fails + data.metrics.checks.values.passes) || 0}\n`;
  summary += `${indent}Requests..........: ${data.metrics.http_reqs.values.count || 0}\n`;
  summary += `${indent}Errors............: ${data.metrics.http_req_failed.values.fails || 0}\n`;
  summary += `${indent}Searches..........: ${data.metrics.searches_performed?.values.count || 0}\n`;
  summary += `${indent}Articles Viewed...: ${data.metrics.kb_articles_viewed?.values.count || 0}\n`;

  if (data.metrics.search_duration) {
    summary += `${indent}Search Duration..:\n`;
    summary += `${indent}  avg: ${data.metrics.search_duration.values.avg?.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${data.metrics.search_duration.values['p(95)']?.toFixed(2)}ms\n`;
  }

  if (data.metrics.http_req_duration) {
    summary += `${indent}Request Duration.:\n`;
    summary += `${indent}  avg: ${data.metrics.http_req_duration.values.avg?.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${data.metrics.http_req_duration.values['p(95)']?.toFixed(2)}ms\n`;
    summary += `${indent}  p99: ${data.metrics.http_req_duration.values['p(99)']?.toFixed(2)}ms\n`;
  }

  return summary;
}
