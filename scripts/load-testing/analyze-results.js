#!/usr/bin/env node

/**
 * Load Test Results Analyzer
 *
 * Analyzes K6 JSON output and generates human-readable reports
 *
 * Usage: node scripts/load-testing/analyze-results.js reports/load/test-results.json
 */

const fs = require('fs');
const path = require('path');

// Color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function analyzeResults(jsonFile) {
  if (!fs.existsSync(jsonFile)) {
    console.error(colorize(`Error: File not found: ${jsonFile}`, 'red'));
    process.exit(1);
  }

  console.log(colorize('\n=== Load Test Results Analysis ===\n', 'cyan'));

  const rawData = fs.readFileSync(jsonFile, 'utf8');
  const lines = rawData.trim().split('\n');

  const metrics = {
    http_reqs: { count: 0, rate: 0 },
    http_req_duration: { values: [] },
    http_req_failed: { count: 0 },
    vus: { max: 0 },
    checks: { passed: 0, failed: 0 },
    iterations: { count: 0 },
  };

  // Parse K6 JSON output (newline-delimited JSON)
  lines.forEach(line => {
    try {
      const entry = JSON.parse(line);

      // Collect metric data
      if (entry.type === 'Point') {
        const metricName = entry.metric;
        const value = entry.data.value;

        switch (metricName) {
          case 'http_reqs':
            metrics.http_reqs.count++;
            break;
          case 'http_req_duration':
            metrics.http_req_duration.values.push(value);
            break;
          case 'http_req_failed':
            if (value === 1) metrics.http_req_failed.count++;
            break;
          case 'vus':
            metrics.vus.max = Math.max(metrics.vus.max, value);
            break;
          case 'checks':
            if (value === 1) {
              metrics.checks.passed++;
            } else {
              metrics.checks.failed++;
            }
            break;
          case 'iterations':
            metrics.iterations.count++;
            break;
        }
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  });

  // Calculate statistics
  const durations = metrics.http_req_duration.values.sort((a, b) => a - b);
  const stats = calculateStats(durations);

  const totalReqs = metrics.http_reqs.count;
  const failedReqs = metrics.http_req_failed.count;
  const successRate = totalReqs > 0 ? ((totalReqs - failedReqs) / totalReqs * 100).toFixed(2) : 0;

  const totalChecks = metrics.checks.passed + metrics.checks.failed;
  const checkPassRate = totalChecks > 0 ? ((metrics.checks.passed / totalChecks) * 100).toFixed(2) : 0;

  // Print report
  console.log(colorize('Overview:', 'blue'));
  console.log(`  Test File: ${path.basename(jsonFile)}`);
  console.log(`  Total Requests: ${totalReqs}`);
  console.log(`  Failed Requests: ${failedReqs}`);
  console.log(`  Success Rate: ${colorizeRate(successRate)}%`);
  console.log(`  Max Virtual Users: ${metrics.vus.max}`);
  console.log(`  Total Iterations: ${metrics.iterations.count}`);
  console.log();

  console.log(colorize('Response Times:', 'blue'));
  console.log(`  Min: ${stats.min.toFixed(2)}ms`);
  console.log(`  Max: ${stats.max.toFixed(2)}ms`);
  console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`  Median: ${stats.median.toFixed(2)}ms`);
  console.log(`  P90: ${stats.p90.toFixed(2)}ms`);
  console.log(`  P95: ${colorizeLatency(stats.p95)}ms`);
  console.log(`  P99: ${colorizeLatency(stats.p99)}ms`);
  console.log();

  console.log(colorize('Checks:', 'blue'));
  console.log(`  Passed: ${metrics.checks.passed}`);
  console.log(`  Failed: ${metrics.checks.failed}`);
  console.log(`  Pass Rate: ${colorizeRate(checkPassRate)}%`);
  console.log();

  // Performance rating
  console.log(colorize('Performance Rating:', 'blue'));
  const rating = getPerformanceRating(stats.p95, successRate, checkPassRate);
  console.log(`  ${rating.emoji} ${colorize(rating.grade, rating.color)}: ${rating.description}`);
  console.log();

  // Recommendations
  const recommendations = generateRecommendations(stats, successRate, checkPassRate);
  if (recommendations.length > 0) {
    console.log(colorize('Recommendations:', 'yellow'));
    recommendations.forEach(rec => console.log(`  - ${rec}`));
    console.log();
  }

  // Save HTML report
  const htmlReport = generateHTMLReport(jsonFile, metrics, stats, successRate, checkPassRate, rating);
  const htmlFile = jsonFile.replace('.json', '.html');
  fs.writeFileSync(htmlFile, htmlReport);
  console.log(colorize(`HTML report saved to: ${htmlFile}`, 'green'));
  console.log();
}

function calculateStats(values) {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const percentile = (p) => {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  };

  return {
    min: values[0],
    max: values[values.length - 1],
    mean,
    median: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}

function colorizeRate(rate) {
  const numRate = parseFloat(rate);
  if (numRate >= 95) return colorize(rate, 'green');
  if (numRate >= 85) return colorize(rate, 'yellow');
  return colorize(rate, 'red');
}

function colorizeLatency(latency) {
  const numLatency = parseFloat(latency);
  if (numLatency < 200) return colorize(latency.toFixed(2), 'green');
  if (numLatency < 500) return colorize(latency.toFixed(2), 'yellow');
  return colorize(latency.toFixed(2), 'red');
}

function getPerformanceRating(p95, successRate, checkPassRate) {
  const numP95 = parseFloat(p95);
  const numSuccess = parseFloat(successRate);
  const numCheck = parseFloat(checkPassRate);

  if (numP95 < 200 && numSuccess >= 99 && numCheck >= 95) {
    return { grade: 'Excellent', color: 'green', emoji: '🌟', description: 'Outstanding performance' };
  }
  if (numP95 < 500 && numSuccess >= 95 && numCheck >= 90) {
    return { grade: 'Good', color: 'green', emoji: '✅', description: 'Good performance, meets SLA' };
  }
  if (numP95 < 1000 && numSuccess >= 90 && numCheck >= 85) {
    return { grade: 'Acceptable', color: 'yellow', emoji: '⚠️', description: 'Acceptable, but improvements needed' };
  }
  if (numP95 < 2000 && numSuccess >= 80) {
    return { grade: 'Poor', color: 'yellow', emoji: '⚠️', description: 'Poor performance, optimization required' };
  }
  return { grade: 'Critical', color: 'red', emoji: '❌', description: 'Critical issues, immediate action required' };
}

function generateRecommendations(stats, successRate, checkPassRate) {
  const recommendations = [];

  if (stats.p95 > 1000) {
    recommendations.push('High P95 latency detected. Consider optimizing database queries and adding caching.');
  }
  if (stats.p99 > 2000) {
    recommendations.push('Very high P99 latency. Investigate slow queries and add database indexes.');
  }
  if (parseFloat(successRate) < 95) {
    recommendations.push('Low success rate. Check error logs and add error handling.');
  }
  if (parseFloat(checkPassRate) < 90) {
    recommendations.push('Many checks failing. Review test assertions and application logic.');
  }
  if (stats.max > 5000) {
    recommendations.push('Maximum response time is very high. Add timeout handling and circuit breakers.');
  }

  return recommendations;
}

function generateHTMLReport(jsonFile, metrics, stats, successRate, checkPassRate, rating) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report - ${path.basename(jsonFile)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .metric:last-child { border-bottom: none; }
    .metric-label { font-weight: 600; color: #555; }
    .metric-value { font-weight: bold; }
    .good { color: #10b981; }
    .warning { color: #f59e0b; }
    .bad { color: #ef4444; }
    .rating {
      text-align: center;
      font-size: 2em;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Load Test Report</h1>
    <p>Test File: ${path.basename(jsonFile)}</p>
    <p>Generated: ${new Date().toISOString()}</p>
  </div>

  <div class="card">
    <h2>Performance Rating</h2>
    <div class="rating">
      ${rating.emoji} ${rating.grade}
      <div style="font-size: 0.5em; color: #666;">${rating.description}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Overview</h2>
      <div class="metric">
        <span class="metric-label">Total Requests</span>
        <span class="metric-value">${metrics.http_reqs.count}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Failed Requests</span>
        <span class="metric-value ${metrics.http_req_failed.count > 0 ? 'warning' : 'good'}">${metrics.http_req_failed.count}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Success Rate</span>
        <span class="metric-value ${parseFloat(successRate) >= 95 ? 'good' : 'warning'}">${successRate}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">Max Virtual Users</span>
        <span class="metric-value">${metrics.vus.max}</span>
      </div>
    </div>

    <div class="card">
      <h2>Response Times</h2>
      <div class="metric">
        <span class="metric-label">Min</span>
        <span class="metric-value">${stats.min.toFixed(2)}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">Mean</span>
        <span class="metric-value">${stats.mean.toFixed(2)}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">Median</span>
        <span class="metric-value">${stats.median.toFixed(2)}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">P95</span>
        <span class="metric-value ${stats.p95 < 500 ? 'good' : stats.p95 < 1000 ? 'warning' : 'bad'}">${stats.p95.toFixed(2)}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">P99</span>
        <span class="metric-value ${stats.p99 < 1000 ? 'good' : stats.p99 < 2000 ? 'warning' : 'bad'}">${stats.p99.toFixed(2)}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">Max</span>
        <span class="metric-value">${stats.max.toFixed(2)}ms</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Checks</h2>
    <div class="metric">
      <span class="metric-label">Passed</span>
      <span class="metric-value good">${metrics.checks.passed}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Failed</span>
      <span class="metric-value ${metrics.checks.failed > 0 ? 'warning' : 'good'}">${metrics.checks.failed}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Pass Rate</span>
      <span class="metric-value ${parseFloat(checkPassRate) >= 90 ? 'good' : 'warning'}">${checkPassRate}%</span>
    </div>
  </div>
</body>
</html>`;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(colorize('Usage: node analyze-results.js <path-to-k6-json-output>', 'red'));
  console.error('Example: node analyze-results.js reports/load/test-results.json');
  process.exit(1);
}

analyzeResults(args[0]);
