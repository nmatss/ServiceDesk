#!/bin/bash

###############################################################################
# Comprehensive Security Report Generator
#
# Runs all security tests and generates a consolidated report.
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🔒 COMPREHENSIVE SECURITY AUDIT REPORT 🔒            ║
║                                                           ║
║              ServiceDesk Application                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

REPORT_DIR="security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/security-audit-$TIMESTAMP.html"

mkdir -p "$REPORT_DIR"

# Track overall status
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

print_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

run_test() {
    local test_name="$1"
    local test_command="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${YELLOW}Running: $test_name${NC}"

    if eval "$test_command" > "$REPORT_DIR/${test_name// /_}.log" 2>&1; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Start HTML report
cat > "$REPORT_FILE" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Audit Report</title>
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
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .summary-card .value {
            font-size: 36px;
            font-weight: bold;
            margin: 0;
        }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .warning { color: #f59e0b; }
        .info { color: #3b82f6; }
        .section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin-top: 0;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .test-result {
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid;
            background: #f9fafb;
        }
        .test-result.passed { border-color: #10b981; }
        .test-result.failed { border-color: #ef4444; }
        .test-result.warning { border-color: #f59e0b; }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        .badge.passed { background: #d1fae5; color: #065f46; }
        .badge.failed { background: #fee2e2; color: #991b1b; }
        .badge.warning { background: #fef3c7; color: #92400e; }
        pre {
            background: #1f2937;
            color: #e5e7eb;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .recommendations {
            background: #fffbeb;
            border: 1px solid #fbbf24;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Audit Report</h1>
        <p>ServiceDesk Application</p>
        <p>Generated:
EOF

echo "$(date)" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'
</p>
    </div>
EOF

# Run all security checks
print_section "1. Dependency Security Scan"
run_test "Dependency Scan" "./scripts/security/scan-dependencies.sh" || true

print_section "2. Secrets Scan"
run_test "Secrets Scan" "./scripts/security/scan-secrets.sh" || true

print_section "3. Unit Security Tests"
run_test "OWASP SQL Injection Tests" "npm run test:unit -- tests/security/owasp/sql-injection.test.ts" || true
run_test "OWASP XSS Tests" "npm run test:unit -- tests/security/owasp/xss.test.ts" || true
run_test "OWASP CSRF Tests" "npm run test:unit -- tests/security/owasp/csrf.test.ts" || true
run_test "Authentication Bypass Tests" "npm run test:unit -- tests/security/owasp/auth-bypass.test.ts" || true
run_test "Authorization Bypass Tests" "npm run test:unit -- tests/security/owasp/authz-bypass.test.ts" || true

print_section "4. Security Headers Tests"
run_test "Security Headers" "npm run test:unit -- tests/security/headers.test.ts" || true

print_section "5. JWT Security Tests"
run_test "JWT Security" "npm run test:unit -- tests/security/jwt.test.ts" || true

print_section "6. Rate Limiting Tests"
run_test "Rate Limiting" "npm run test:unit -- tests/security/rate-limit.test.ts" || true

print_section "7. Input Validation Tests"
run_test "Input Validation" "npm run test:unit -- tests/security/input-validation.test.ts" || true

# Generate summary
print_section "SECURITY AUDIT SUMMARY"

echo ""
echo "Total Tests Run: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
    PASS_RATE=0
fi

echo "Pass Rate: $PASS_RATE%"

# Complete HTML report
cat >> "$REPORT_FILE" << EOF
    <div class="summary">
        <div class="summary-card">
            <h3>Total Tests</h3>
            <p class="value info">$TOTAL_TESTS</p>
        </div>
        <div class="summary-card">
            <h3>Passed</h3>
            <p class="value passed">$PASSED_TESTS</p>
        </div>
        <div class="summary-card">
            <h3>Failed</h3>
            <p class="value failed">$FAILED_TESTS</p>
        </div>
        <div class="summary-card">
            <h3>Pass Rate</h3>
            <p class="value info">$PASS_RATE%</p>
        </div>
    </div>

    <div class="section">
        <h2>📋 Test Results</h2>
EOF

# Add test results to HTML
for log in "$REPORT_DIR"/*.log; do
    if [ -f "$log" ]; then
        test_name=$(basename "$log" .log)
        # Simple pass/fail detection
        if grep -q "PASSED\|✅\|All tests passed" "$log" 2>/dev/null; then
            status="passed"
            badge="PASSED"
        else
            status="failed"
            badge="FAILED"
        fi

        cat >> "$REPORT_FILE" << EOF
        <div class="test-result $status">
            <strong>$test_name</strong>
            <span class="badge $status">$badge</span>
        </div>
EOF
    fi
done

cat >> "$REPORT_FILE" << 'EOF'
    </div>

    <div class="recommendations">
        <h2>🔍 Recommendations</h2>
        <ul>
            <li><strong>Critical:</strong> Fix all HIGH and CRITICAL vulnerabilities immediately</li>
            <li><strong>Dependencies:</strong> Keep all dependencies up to date</li>
            <li><strong>Secrets:</strong> Ensure no secrets are committed to repository</li>
            <li><strong>Headers:</strong> Verify all security headers are properly configured</li>
            <li><strong>Authentication:</strong> Implement MFA for admin accounts</li>
            <li><strong>Rate Limiting:</strong> Ensure rate limiting on all public endpoints</li>
            <li><strong>Monitoring:</strong> Set up continuous security monitoring</li>
            <li><strong>Training:</strong> Provide security awareness training to developers</li>
        </ul>
    </div>

    <div class="footer">
        <p>Generated by ServiceDesk Security Audit Tool</p>
        <p>For questions or concerns, contact the security team</p>
    </div>
</body>
</html>
EOF

echo ""
echo -e "${GREEN}📄 HTML Report generated: $REPORT_FILE${NC}"
echo ""

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}❌ SECURITY AUDIT FAILED${NC}"
    echo -e "${RED}   $FAILED_TESTS test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ SECURITY AUDIT PASSED${NC}"
    echo -e "${GREEN}   All $PASSED_TESTS tests passed${NC}"
    exit 0
fi
