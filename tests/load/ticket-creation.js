/**
 * K6 Load Test: Ticket Creation
 *
 * Tests the ticket creation endpoint under various load conditions
 *
 * Run: k6 run tests/load/ticket-creation.js
 * Run with custom VUs: k6 run --vus 50 --duration 30s tests/load/ticket-creation.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginFailureRate = new Rate('login_failures');
const ticketCreationFailureRate = new Rate('ticket_creation_failures');
const ticketCreationDuration = new Trend('ticket_creation_duration');
const ticketsCreated = new Counter('tickets_created');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Warm up: ramp up to 20 users
    { duration: '1m', target: 50 },    // Normal load: 50 concurrent users
    { duration: '30s', target: 100 },  // Peak load: 100 concurrent users
    { duration: '1m', target: 100 },   // Sustained peak: hold at 100
    { duration: '30s', target: 200 },  // Stress test: spike to 200 users
    { duration: '1m', target: 200 },   // Sustained stress: hold at 200
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    // HTTP errors should be less than 1%
    http_req_failed: ['rate<0.01'],

    // 95% of requests should be below 500ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],

    // Specific endpoint thresholds
    'http_req_duration{name:login}': ['p(95)<300'],
    'http_req_duration{name:create_ticket}': ['p(95)<500'],

    // Custom metrics
    login_failures: ['rate<0.05'],
    ticket_creation_failures: ['rate<0.05'],
  },
  // Environment-specific settings
  noConnectionReuse: false,
  userAgent: 'K6LoadTest/1.0',
};

// Test data generators
function generateTicketData(userId) {
  const priorities = [1, 2, 3, 4]; // low, medium, high, critical
  const categories = [1, 2, 3, 4, 5];

  return {
    title: `Load Test Ticket - ${Date.now()} - VU${__VU}`,
    description: `This is a load test ticket created at ${new Date().toISOString()} by virtual user ${__VU} in iteration ${__ITER}`,
    priority_id: priorities[Math.floor(Math.random() * priorities.length)],
    category_id: categories[Math.floor(Math.random() * categories.length)],
    created_by: userId,
  };
}

// Base URL from environment or default
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test users for load testing
const TEST_USERS = [
  { email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { email: 'agent@example.com', password: 'agent123', role: 'agent' },
  { email: 'user@example.com', password: 'user123', role: 'user' },
];

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`Test users: ${TEST_USERS.length}`);

  // Verify the API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    'API is accessible': (r) => r.status === 200,
  });

  return { baseUrl: BASE_URL };
}

export default function (data) {
  // Select a test user (round-robin)
  const testUser = TEST_USERS[__VU % TEST_USERS.length];

  let authToken;
  let userId;

  // Group: Authentication
  group('Authentication', () => {
    const loginPayload = JSON.stringify({
      email: testUser.email,
      password: testUser.password,
    });

    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'login' },
    };

    const loginResponse = http.post(
      `${data.baseUrl}/api/auth/login`,
      loginPayload,
      loginParams
    );

    const loginSuccess = check(loginResponse, {
      'login status is 200': (r) => r.status === 200,
      'login response has token': (r) => {
        try {
          const json = JSON.parse(r.body);
          return json.token !== undefined;
        } catch {
          return false;
        }
      },
    });

    loginFailureRate.add(!loginSuccess);

    if (loginSuccess) {
      const loginData = JSON.parse(loginResponse.body);
      authToken = loginData.token;
      userId = loginData.user?.id || 1;
    } else {
      console.error(`Login failed for ${testUser.email}: ${loginResponse.status}`);
      return; // Skip rest of iteration if login fails
    }
  });

  // Small delay between requests
  sleep(0.5);

  // Group: Ticket Creation
  group('Ticket Creation', () => {
    const ticketData = generateTicketData(userId);
    const ticketPayload = JSON.stringify(ticketData);

    const ticketParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      tags: { name: 'create_ticket' },
    };

    const startTime = Date.now();
    const ticketResponse = http.post(
      `${data.baseUrl}/api/tickets/create`,
      ticketPayload,
      ticketParams
    );
    const endTime = Date.now();

    const ticketSuccess = check(ticketResponse, {
      'ticket creation status is 201': (r) => r.status === 201,
      'ticket creation response has id': (r) => {
        try {
          const json = JSON.parse(r.body);
          return json.id !== undefined || json.ticket?.id !== undefined;
        } catch {
          return false;
        }
      },
      'ticket creation under 500ms': (r) => (endTime - startTime) < 500,
      'ticket creation under 1s': (r) => (endTime - startTime) < 1000,
    });

    ticketCreationFailureRate.add(!ticketSuccess);
    ticketCreationDuration.add(endTime - startTime);

    if (ticketSuccess) {
      ticketsCreated.add(1);
    } else {
      console.error(`Ticket creation failed: ${ticketResponse.status} - ${ticketResponse.body}`);
    }
  });

  // Small delay between requests
  sleep(1);

  // Group: Ticket Retrieval (optional - test read performance)
  group('Ticket Retrieval', () => {
    const params = {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      tags: { name: 'get_tickets' },
    };

    const getResponse = http.get(
      `${data.baseUrl}/api/tickets/user/${userId}`,
      params
    );

    check(getResponse, {
      'ticket retrieval status is 200': (r) => r.status === 200,
      'ticket retrieval returns array': (r) => {
        try {
          const json = JSON.parse(r.body);
          return Array.isArray(json) || Array.isArray(json.tickets);
        } catch {
          return false;
        }
      },
    });
  });

  // Think time - simulate user reading/thinking
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total tickets created: ${ticketsCreated.value || 0}`);
}

// Handle test interruptions gracefully
export function handleSummary(data) {
  return {
    'reports/load/ticket-creation-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n';
  summary += `${indent}Checks............: ${data.metrics.checks.values.passes || 0} / ${data.metrics.checks.values.fails + data.metrics.checks.values.passes || 0}\n`;
  summary += `${indent}Requests..........: ${data.metrics.http_reqs.values.count || 0}\n`;
  summary += `${indent}Errors............: ${data.metrics.http_req_failed.values.fails || 0}\n`;

  if (data.metrics.http_req_duration) {
    summary += `${indent}Request Duration.:\n`;
    summary += `${indent}  avg: ${data.metrics.http_req_duration.values.avg?.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${data.metrics.http_req_duration.values['p(95)']?.toFixed(2)}ms\n`;
    summary += `${indent}  p99: ${data.metrics.http_req_duration.values['p(99)']?.toFixed(2)}ms\n`;
  }

  return summary;
}
