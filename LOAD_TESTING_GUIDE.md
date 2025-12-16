# Load Testing Guide

Comprehensive guide for load testing the ServiceDesk application using K6.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Test Suites](#test-suites)
- [Running Tests](#running-tests)
- [Interpreting Results](#interpreting-results)
- [Performance Benchmarks](#performance-benchmarks)
- [Optimization Tips](#optimization-tips)
- [CI/CD Integration](#cicd-integration)

## Overview

This project uses [K6](https://k6.io/) for load testing. K6 is a modern load testing tool built for developer productivity and reliability.

### What We Test

- **Ticket Creation** - Core CRUD operations under load
- **Search & Knowledge Base** - Read-heavy operations
- **Authentication** - Login/session management
- **API Endpoints** - Full API stress testing

### Performance Goals

| Metric | Target | Excellent | Acceptable | Poor |
|--------|--------|-----------|------------|------|
| P95 Response Time | < 200ms | < 200ms | < 500ms | > 500ms |
| P99 Response Time | < 500ms | < 500ms | < 1000ms | > 1000ms |
| Success Rate | > 99% | > 99% | > 95% | < 95% |
| Concurrent Users | 200+ | 500+ | 200+ | < 100 |
| Requests/sec | 1000+ | 2000+ | 1000+ | < 500 |

## Prerequisites

### Install K6

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```powershell
choco install k6
```

**Docker:**
```bash
docker pull grafana/k6
```

### Verify Installation

```bash
k6 version
# Should output: k6 v0.x.x (2024-xx-xx)
```

### Start the Application

```bash
# Start in development mode
npm run dev

# Or production mode
npm run build
npm start
```

Verify server is running:
```bash
curl http://localhost:3000/api/health
```

## Test Suites

### 1. Ticket Creation Load Test

**File:** `/tests/load/ticket-creation.js`

**What it tests:**
- User authentication
- Ticket creation endpoint
- Ticket retrieval
- Database write performance

**Load profile:**
```javascript
stages: [
  { duration: '30s', target: 20 },   // Warm up
  { duration: '1m', target: 50 },    // Normal load
  { duration: '30s', target: 100 },  // Peak load
  { duration: '1m', target: 100 },   // Sustained peak
  { duration: '30s', target: 200 },  // Stress spike
  { duration: '1m', target: 200 },   // Sustained stress
  { duration: '30s', target: 0 },    // Ramp down
]
```

**Run:**
```bash
k6 run tests/load/ticket-creation.js
```

**Expected Results:**
- P95 < 500ms
- Success rate > 95%
- No database errors

### 2. Search & Knowledge Base Test

**File:** `/tests/load/search-knowledge.js`

**What it tests:**
- Global search functionality
- Knowledge base article retrieval
- Semantic search (if available)
- Read-heavy operations

**Load profile:**
```javascript
stages: [
  { duration: '30s', target: 30 },   // Warm up
  { duration: '1m', target: 75 },    // Normal load
  { duration: '30s', target: 150 },  // Peak load
  { duration: '1m', target: 150 },   // Sustained peak
  { duration: '30s', target: 300 },  // Stress test
  { duration: '30s', target: 0 },    // Ramp down
]
```

**Run:**
```bash
k6 run tests/load/search-knowledge.js
```

**Expected Results:**
- P95 < 800ms for search
- P95 < 500ms for article retrieval
- Success rate > 95%

### 3. API Stress Test

**File:** `/tests/load/api-stress-test.js`

**What it tests:**
- All major API endpoints
- System behavior under extreme load
- Breaking point identification

**Load profile:**
```javascript
stages: [
  { duration: '1m', target: 100 },   // Ramp up
  { duration: '2m', target: 200 },   // Scale up
  { duration: '2m', target: 500 },   // Heavy load
  { duration: '1m', target: 1000 },  // Stress level
  { duration: '2m', target: 1000 },  // Hold stress
  { duration: '1m', target: 0 },     // Ramp down
]
```

**Run:**
```bash
k6 run tests/load/api-stress-test.js
```

**Expected Results:**
- System remains stable up to 500 concurrent users
- Graceful degradation beyond capacity
- Error rate < 10% under stress

## Running Tests

### Quick Start

```bash
# Run all tests sequentially
./scripts/load-testing/run-all-load-tests.sh
```

### Individual Tests

```bash
# Ticket creation test
k6 run tests/load/ticket-creation.js

# Search test
k6 run tests/load/search-knowledge.js

# Stress test
k6 run tests/load/api-stress-test.js
```

### Custom Load Profiles

**Short smoke test:**
```bash
k6 run --vus 10 --duration 30s tests/load/ticket-creation.js
```

**Specific VU count:**
```bash
k6 run --vus 50 --duration 2m tests/load/ticket-creation.js
```

**Different environment:**
```bash
k6 run -e BASE_URL=https://staging.example.com tests/load/ticket-creation.js
```

### Output Options

**JSON output:**
```bash
k6 run --out json=reports/load/results.json tests/load/ticket-creation.js
```

**InfluxDB output:**
```bash
k6 run --out influxdb=http://localhost:8086/k6 tests/load/ticket-creation.js
```

**Cloud output (k6 Cloud):**
```bash
k6 cloud tests/load/ticket-creation.js
```

## Interpreting Results

### Reading K6 Output

```
checks.........................: 98.50% ✓ 1970      ✗ 30
data_received..................: 4.2 MB 42 kB/s
data_sent......................: 1.1 MB 11 kB/s
http_req_blocked...............: avg=1.2ms    min=1µs      med=3µs      max=150ms   p(90)=5µs      p(95)=8µs
http_req_connecting............: avg=450µs    min=0s       med=0s       max=50ms    p(90)=0s       p(95)=0s
http_req_duration..............: avg=120ms    min=50ms     med=100ms    max=2s      p(90)=200ms    p(95)=350ms
  { expected_response:true }...: avg=115ms    min=50ms     med=98ms     max=1.5s    p(90)=190ms    p(95)=320ms
http_req_failed................: 1.50%  ✓ 30        ✗ 1970
http_req_receiving.............: avg=2ms      min=20µs     med=100µs    max=100ms   p(90)=500µs    p(95)=1ms
http_req_sending...............: avg=500µs    min=10µs     med=50µs     max=50ms    p(90)=100µs    p(95)=200µs
http_req_tls_handshaking.......: avg=0s       min=0s       med=0s       max=0s      p(90)=0s       p(95)=0s
http_req_waiting...............: avg=118ms    min=48ms     med=99ms     max=1.9s    p(90)=198ms    p(95)=345ms
http_reqs......................: 2000   20/s
iteration_duration.............: avg=1.5s     min=1s       med=1.4s     max=3s      p(90)=2s       p(95)=2.5s
iterations.....................: 500    5/s
vus............................: 100    min=0       max=100
vus_max........................: 100    min=100     max=100
```

### Key Metrics Explained

| Metric | Description | Good Value |
|--------|-------------|------------|
| `http_req_duration` | Total request time | P95 < 500ms |
| `http_req_failed` | Failed request percentage | < 1% |
| `http_reqs` | Requests per second | As high as possible |
| `checks` | Assertion pass rate | > 95% |
| `vus` | Virtual users (concurrent) | Matches target |
| `iterations` | Total test iterations | N/A |

### Performance Grades

**A+ (Excellent):**
- P95 < 200ms
- P99 < 500ms
- Success rate > 99%
- No errors under 500 concurrent users

**A (Good):**
- P95 < 500ms
- P99 < 1000ms
- Success rate > 95%
- Handles 200+ concurrent users

**B (Acceptable):**
- P95 < 1000ms
- P99 < 2000ms
- Success rate > 90%
- Handles 100+ concurrent users

**C (Needs Improvement):**
- P95 > 1000ms
- Success rate 80-90%
- Struggles with concurrent users

**F (Critical):**
- P95 > 2000ms
- Success rate < 80%
- System instability

### Analyzing Results

Use the provided analyzer:

```bash
node scripts/load-testing/analyze-results.js reports/load/results.json
```

Output includes:
- Performance rating (A+ to F)
- Response time statistics
- Success/failure rates
- Recommendations for optimization
- HTML report generation

## Performance Benchmarks

### Database Benchmarks

| Operation | Target | Typical | Max Acceptable |
|-----------|--------|---------|----------------|
| Insert ticket | < 50ms | 30ms | 100ms |
| Select ticket | < 20ms | 10ms | 50ms |
| Search tickets | < 100ms | 60ms | 200ms |
| Complex join | < 150ms | 100ms | 300ms |

### API Endpoint Benchmarks

| Endpoint | P95 Target | P99 Target | Throughput |
|----------|------------|------------|------------|
| `POST /api/tickets/create` | < 200ms | < 500ms | 100 req/s |
| `GET /api/tickets/:id` | < 100ms | < 200ms | 500 req/s |
| `GET /api/search` | < 300ms | < 600ms | 200 req/s |
| `POST /api/auth/login` | < 150ms | < 300ms | 50 req/s |
| `GET /api/knowledge/articles` | < 200ms | < 400ms | 300 req/s |

## Optimization Tips

### 1. Database Optimization

**Add indexes:**
```sql
-- For frequently queried fields
CREATE INDEX idx_tickets_status ON tickets(status_id);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX idx_tickets_created ON tickets(created_at);

-- For search
CREATE INDEX idx_tickets_title_search ON tickets(title);
CREATE VIRTUAL TABLE tickets_fts USING fts5(title, description);
```

**Use connection pooling:**
```typescript
const pool = new Pool({
  max: 20,
  min: 5,
  idle: 10000,
});
```

### 2. Caching Strategy

**Add Redis caching:**
```typescript
import Redis from 'ioredis';

const redis = new Redis();

// Cache frequently accessed data
async function getTicket(id: number) {
  const cached = await redis.get(`ticket:${id}`);
  if (cached) return JSON.parse(cached);

  const ticket = await db.getTicket(id);
  await redis.setex(`ticket:${id}`, 300, JSON.stringify(ticket));
  return ticket;
}
```

### 3. API Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

### 4. Response Compression

```typescript
import compression from 'compression';

app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
}));
```

### 5. Query Optimization

```typescript
// ❌ Bad: N+1 query problem
for (const ticket of tickets) {
  ticket.comments = await getComments(ticket.id);
}

// ✅ Good: Single query with JOIN
const ticketsWithComments = await db.prepare(`
  SELECT t.*, c.id as comment_id, c.content
  FROM tickets t
  LEFT JOIN comments c ON c.ticket_id = t.id
`).all();
```

### 6. Pagination

```typescript
// Always limit query results
const tickets = await db.prepare(`
  SELECT * FROM tickets
  WHERE status_id = ?
  LIMIT ? OFFSET ?
`).all(statusId, limit, offset);
```

### 7. Lazy Loading

```typescript
// Don't load all data upfront
// Load on-demand when user scrolls
const InfiniteTicketList = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTickets({ page, limit: 20 });

  return (
    <InfiniteScroll
      hasMore={data?.hasMore}
      loadMore={() => setPage(p => p + 1)}
    >
      {data?.tickets.map(ticket => <TicketCard key={ticket.id} {...ticket} />)}
    </InfiniteScroll>
  );
};
```

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/load-test.yml`:

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * 0' # Weekly on Sunday at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install K6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Start application
        run: |
          npm run build
          npm start &
          sleep 10

      - name: Run load tests
        run: ./scripts/load-testing/run-all-load-tests.sh

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-reports
          path: reports/load/
```

### Performance Monitoring

**Continuous monitoring with Grafana + InfluxDB:**

```bash
# Start InfluxDB
docker run -d -p 8086:8086 influxdb:1.8

# Run K6 with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 tests/load/ticket-creation.js

# View in Grafana
docker run -d -p 3000:3000 grafana/grafana
```

## Troubleshooting

### Common Issues

**Issue: Connection refused**
```
Error: dial tcp 127.0.0.1:3000: connect: connection refused
```
**Solution:** Ensure the application is running on port 3000

**Issue: High error rate**
```
http_req_failed................: 25.00%
```
**Solution:** Check application logs, database connections, and resource limits

**Issue: Timeout errors**
```
Error: request timeout exceeded
```
**Solution:** Increase timeouts or optimize slow endpoints

### Debugging

**Enable verbose output:**
```bash
k6 run --verbose tests/load/ticket-creation.js
```

**Run with single VU for debugging:**
```bash
k6 run --vus 1 --iterations 1 tests/load/ticket-creation.js
```

**Check application logs:**
```bash
# While test is running
tail -f logs/application.log
```

## Resources

- [K6 Documentation](https://k6.io/docs/)
- [K6 Examples](https://github.com/grafana/k6-examples)
- [Performance Testing Checklist](https://k6.io/docs/testing-guides/performance-testing-checklist/)
- [K6 Best Practices](https://k6.io/docs/misc/k6-best-practices/)

## Next Steps

1. **Baseline Testing** - Run tests to establish current performance
2. **Set SLOs** - Define Service Level Objectives based on baselines
3. **Regular Testing** - Schedule weekly/monthly load tests
4. **Monitor Production** - Compare test results with real-world metrics
5. **Optimize** - Iterate on improvements based on results

## Support

For load testing questions:
- Review K6 documentation
- Check application logs
- Contact DevOps team
- Open issue in GitHub
