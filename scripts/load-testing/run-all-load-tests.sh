#!/bin/bash

# Run All Load Tests Script
# This script runs all K6 load tests and generates a comprehensive report

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Create reports directory
REPORTS_DIR="reports/load"
mkdir -p "$REPORTS_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MASTER_REPORT="$REPORTS_DIR/load-test-report-$TIMESTAMP.txt"

echo "============================================" | tee "$MASTER_REPORT"
echo "Load Testing Report - $(date)" | tee -a "$MASTER_REPORT"
echo "============================================" | tee -a "$MASTER_REPORT"
echo "" | tee -a "$MASTER_REPORT"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}" | tee -a "$MASTER_REPORT"
    echo "" | tee -a "$MASTER_REPORT"
    echo "Please install k6:" | tee -a "$MASTER_REPORT"
    echo "  macOS:   brew install k6" | tee -a "$MASTER_REPORT"
    echo "  Linux:   Visit https://k6.io/docs/getting-started/installation/" | tee -a "$MASTER_REPORT"
    echo "  Windows: choco install k6" | tee -a "$MASTER_REPORT"
    echo "" | tee -a "$MASTER_REPORT"
    exit 1
fi

echo -e "${GREEN}✓ k6 is installed${NC}" | tee -a "$MASTER_REPORT"
K6_VERSION=$(k6 version | head -n 1)
echo "Version: $K6_VERSION" | tee -a "$MASTER_REPORT"
echo "" | tee -a "$MASTER_REPORT"

# Check if server is running
echo "Checking if server is running..." | tee -a "$MASTER_REPORT"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}" | tee -a "$MASTER_REPORT"
else
    echo -e "${RED}Error: Server is not running on http://localhost:3000${NC}" | tee -a "$MASTER_REPORT"
    echo "Please start the server with: npm run dev" | tee -a "$MASTER_REPORT"
    exit 1
fi
echo "" | tee -a "$MASTER_REPORT"

# Test 1: Ticket Creation Load Test
echo "=== Test 1: Ticket Creation Load Test ===" | tee -a "$MASTER_REPORT"
echo "" | tee -a "$MASTER_REPORT"
echo "Running ticket creation load test..." | tee -a "$MASTER_REPORT"

if k6 run tests/load/ticket-creation.js --out json="$REPORTS_DIR/ticket-creation-$TIMESTAMP.json" 2>&1 | tee -a "$MASTER_REPORT"; then
    echo -e "${GREEN}✓ Ticket creation test completed${NC}" | tee -a "$MASTER_REPORT"
else
    echo -e "${YELLOW}⚠ Ticket creation test completed with warnings${NC}" | tee -a "$MASTER_REPORT"
fi
echo "" | tee -a "$MASTER_REPORT"

sleep 5

# Test 2: Search and Knowledge Base Load Test
echo "=== Test 2: Search and Knowledge Base Load Test ===" | tee -a "$MASTER_REPORT"
echo "" | tee -a "$MASTER_REPORT"
echo "Running search and KB load test..." | tee -a "$MASTER_REPORT"

if k6 run tests/load/search-knowledge.js --out json="$REPORTS_DIR/search-knowledge-$TIMESTAMP.json" 2>&1 | tee -a "$MASTER_REPORT"; then
    echo -e "${GREEN}✓ Search and KB test completed${NC}" | tee -a "$MASTER_REPORT"
else
    echo -e "${YELLOW}⚠ Search and KB test completed with warnings${NC}" | tee -a "$MASTER_REPORT"
fi
echo "" | tee -a "$MASTER_REPORT"

sleep 5

# Test 3: Stress Test (Optional - Aggressive)
read -p "Run stress test? This is aggressive and may impact system (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "=== Test 3: Stress Test ===" | tee -a "$MASTER_REPORT"
    echo "" | tee -a "$MASTER_REPORT"
    echo -e "${YELLOW}Warning: Running aggressive stress test...${NC}" | tee -a "$MASTER_REPORT"

    if k6 run tests/load/api-stress-test.js --out json="$REPORTS_DIR/stress-test-$TIMESTAMP.json" 2>&1 | tee -a "$MASTER_REPORT"; then
        echo -e "${GREEN}✓ Stress test completed${NC}" | tee -a "$MASTER_REPORT"
    else
        echo -e "${YELLOW}⚠ Stress test completed with warnings (expected under high load)${NC}" | tee -a "$MASTER_REPORT"
    fi
    echo "" | tee -a "$MASTER_REPORT"
else
    echo "Skipping stress test" | tee -a "$MASTER_REPORT"
    echo "" | tee -a "$MASTER_REPORT"
fi

# Generate Summary
echo "============================================" | tee -a "$MASTER_REPORT"
echo "LOAD TESTING SUMMARY" | tee -a "$MASTER_REPORT"
echo "============================================" | tee -a "$MASTER_REPORT"
echo "" | tee -a "$MASTER_REPORT"

# Count test files generated
TEST_COUNT=$(ls -1 "$REPORTS_DIR"/*-$TIMESTAMP.json 2>/dev/null | wc -l || echo 0)
echo "Tests Completed: $TEST_COUNT" | tee -a "$MASTER_REPORT"
echo "Report Location: $MASTER_REPORT" | tee -a "$MASTER_REPORT"
echo "JSON Reports: $REPORTS_DIR/*-$TIMESTAMP.json" | tee -a "$MASTER_REPORT"
echo "" | tee -a "$MASTER_REPORT"

# Check for failures
if grep -q "✗" "$MASTER_REPORT"; then
    echo -e "${RED}Some tests had failures. Please review the report.${NC}"
    exit 1
else
    echo -e "${GREEN}All load tests completed successfully!${NC}"
fi

echo ""
echo "To analyze results in detail, use:"
echo "  cat $MASTER_REPORT"
echo "  or view JSON reports in: $REPORTS_DIR/"
