/**
 * K6 Stress Test: Full API Endpoints
 *
 * Comprehensive stress test covering all major API endpoints
 *
 * Run: k6 run tests/load/api-stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

// Aggressive stress test configuration
export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 200 },   // Scale to 200 users
    { duration: '2m', target: 500 },   // Heavy load: 500 users
    { duration: '1m', target: 1000 },  // Stress: 1000 concurrent users
    { duration: '2m', target: 1000 },  // Hold stress level
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'], // Allow up to 10% failures under stress
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // Relaxed thresholds for stress
    errors: ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const TEST_USER = {
  email: 'loadtest@example.com',
  password: 'LoadTest123!',
};

export function setup() {
  console.log(`Starting stress test against ${BASE_URL}`);
  console.log(`Warning: This is an aggressive stress test!`);

  // Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'API accessible': (r) => r.status === 200 });

  // Try to create test user
  const registerPayload = JSON.stringify({
    name: 'Load Test User',
    email: TEST_USER.email,
    password: TEST_USER.password,
  });

  http.post(`${BASE_URL}/api/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  return { baseUrl: BASE_URL };
}

export default function (data) {
  let authToken;

  // Authentication
  group('Authentication', () => {
    const loginPayload = JSON.stringify(TEST_USER);
    const loginResponse = http.post(
      `${data.baseUrl}/api/auth/login`,
      loginPayload,
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
      }
    );

    const success = check(loginResponse, {
      'login successful': (r) => r.status === 200,
    });

    errorRate.add(!success);

    if (success) {
      authToken = JSON.parse(loginResponse.body).token;
    } else {
      return; // Skip iteration if login fails
    }
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  sleep(0.2);

  // Ticket Operations
  group('Ticket Operations', () => {
    // Create ticket
    const createPayload = JSON.stringify({
      title: `Stress Test - ${Date.now()}`,
      description: 'Created during stress testing',
      priority_id: Math.floor(Math.random() * 4) + 1,
      category_id: Math.floor(Math.random() * 5) + 1,
    });

    const createResponse = http.post(
      `${data.baseUrl}/api/tickets/create`,
      createPayload,
      { headers: authHeaders, tags: { name: 'create_ticket' } }
    );

    const created = check(createResponse, {
      'ticket created': (r) => r.status === 201,
    });

    errorRate.add(!created);

    if (created) {
      const ticket = JSON.parse(createResponse.body);
      const ticketId = ticket.id || ticket.ticket?.id;

      // Add comment
      if (ticketId && Math.random() > 0.5) {
        const commentPayload = JSON.stringify({
          content: 'Automated comment from stress test',
        });

        http.post(
          `${data.baseUrl}/api/tickets/${ticketId}/comments`,
          commentPayload,
          { headers: authHeaders, tags: { name: 'add_comment' } }
        );
      }
    }
  });

  sleep(0.2);

  // Dashboard and Analytics
  if (Math.random() > 0.7) {
    group('Dashboard', () => {
      const dashboardResponse = http.get(`${data.baseUrl}/api/dashboard`, {
        headers: authHeaders,
        tags: { name: 'dashboard' },
      });

      check(dashboardResponse, {
        'dashboard loaded': (r) => r.status === 200,
      });
    });
  }

  sleep(0.2);

  // Search Operations
  if (Math.random() > 0.5) {
    group('Search', () => {
      const searchResponse = http.get(
        `${data.baseUrl}/api/search?q=test`,
        { headers: authHeaders, tags: { name: 'search' } }
      );

      check(searchResponse, {
        'search completed': (r) => r.status === 200,
      });
    });
  }

  sleep(0.2);

  // Knowledge Base
  if (Math.random() > 0.6) {
    group('Knowledge Base', () => {
      const kbResponse = http.get(
        `${data.baseUrl}/api/knowledge/articles?limit=10`,
        { tags: { name: 'kb_list' } }
      );

      check(kbResponse, {
        'KB loaded': (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 0.5);
}

export function teardown(data) {
  console.log('Stress test completed');
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    requests: {
      total: data.metrics.http_reqs?.values.count || 0,
      failed: data.metrics.http_req_failed?.values.fails || 0,
      rate: data.metrics.http_reqs?.values.rate || 0,
    },
    latency: {
      avg: data.metrics.http_req_duration?.values.avg || 0,
      p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
      max: data.metrics.http_req_duration?.values.max || 0,
    },
    checks: {
      passed: data.metrics.checks?.values.passes || 0,
      failed: data.metrics.checks?.values.fails || 0,
    },
    vus: {
      max: data.metrics.vus?.values.max || 0,
    },
  };

  return {
    'reports/load/stress-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextReport(data),
  };
}

function generateTextReport(data) {
  let report = '\n';
  report += '╔════════════════════════════════════════════════════════════╗\n';
  report += '║          STRESS TEST RESULTS                               ║\n';
  report += '╠════════════════════════════════════════════════════════════╣\n';

  const totalReqs = data.metrics.http_reqs?.values.count || 0;
  const failedReqs = data.metrics.http_req_failed?.values.fails || 0;
  const successRate = totalReqs > 0 ? ((totalReqs - failedReqs) / totalReqs * 100).toFixed(2) : 0;

  report += `║ Total Requests: ${String(totalReqs).padEnd(44)} ║\n`;
  report += `║ Failed Requests: ${String(failedReqs).padEnd(43)} ║\n`;
  report += `║ Success Rate: ${String(successRate + '%').padEnd(46)} ║\n`;
  report += `║ Max VUs: ${String(data.metrics.vus?.values.max || 0).padEnd(51)} ║\n`;
  report += '╠════════════════════════════════════════════════════════════╣\n';

  const avgDuration = data.metrics.http_req_duration?.values.avg?.toFixed(2) || 0;
  const p95Duration = data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0;
  const p99Duration = data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 0;
  const maxDuration = data.metrics.http_req_duration?.values.max?.toFixed(2) || 0;

  report += `║ Avg Response Time: ${String(avgDuration + 'ms').padEnd(41)} ║\n`;
  report += `║ P95 Response Time: ${String(p95Duration + 'ms').padEnd(41)} ║\n`;
  report += `║ P99 Response Time: ${String(p99Duration + 'ms').padEnd(41)} ║\n`;
  report += `║ Max Response Time: ${String(maxDuration + 'ms').padEnd(41)} ║\n`;
  report += '╠════════════════════════════════════════════════════════════╣\n';

  const passedChecks = data.metrics.checks?.values.passes || 0;
  const failedChecks = data.metrics.checks?.values.fails || 0;
  const checkSuccessRate = (passedChecks + failedChecks) > 0
    ? ((passedChecks / (passedChecks + failedChecks)) * 100).toFixed(2)
    : 0;

  report += `║ Checks Passed: ${String(passedChecks).padEnd(45)} ║\n`;
  report += `║ Checks Failed: ${String(failedChecks).padEnd(45)} ║\n`;
  report += `║ Check Success Rate: ${String(checkSuccessRate + '%').padEnd(40)} ║\n`;
  report += '╚════════════════════════════════════════════════════════════╝\n';

  return report;
}
