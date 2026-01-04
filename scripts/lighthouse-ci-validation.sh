#!/bin/bash
################################################################################
# Lighthouse CI Validation Script
# Validação contínua de performance com alertas automáticos
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Performance thresholds
PERF_THRESHOLD=90
A11Y_THRESHOLD=95
BP_THRESHOLD=90
SEO_THRESHOLD=90

echo "================================================================================"
echo "                    LIGHTHOUSE CI VALIDATION"
echo "================================================================================"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${RED}❌ Server not running on localhost:3000${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Create reports directory
mkdir -p reports/lighthouse-ci

# Pages to test
declare -a PAGES=(
    "http://localhost:3000/"
    "http://localhost:3000/portal"
    "http://localhost:3000/portal/knowledge"
    "http://localhost:3000/admin/dashboard/itil"
    "http://localhost:3000/analytics"
    "http://localhost:3000/portal/tickets"
)

declare -a PAGE_NAMES=(
    "Home"
    "Portal"
    "Knowledge"
    "Dashboard"
    "Analytics"
    "Tickets"
)

# Run Lighthouse tests
TOTAL_PERF=0
TOTAL_A11Y=0
TOTAL_BP=0
TOTAL_SEO=0
COUNT=0

echo "Running Lighthouse tests on ${#PAGES[@]} pages..."
echo ""

for i in "${!PAGES[@]}"; do
    URL="${PAGES[$i]}"
    NAME="${PAGE_NAMES[$i]}"

    echo -e "${BLUE}🔍 Testing: ${NAME}${NC}"

    # Run Lighthouse (suppress verbose output)
    lighthouse "$URL" \
        --output json \
        --output-path "./reports/lighthouse-ci/${NAME}.json" \
        --chrome-flags="--headless --no-sandbox" \
        --only-categories=performance,accessibility,best-practices,seo \
        --quiet > /dev/null 2>&1 || {
            echo -e "${RED}   ❌ Failed to test ${NAME}${NC}"
            continue
        }

    # Extract scores from JSON
    PERF=$(jq '.categories.performance.score * 100' "./reports/lighthouse-ci/${NAME}.json" 2>/dev/null || echo "0")
    A11Y=$(jq '.categories.accessibility.score * 100' "./reports/lighthouse-ci/${NAME}.json" 2>/dev/null || echo "0")
    BP=$(jq '.categories["best-practices"].score * 100' "./reports/lighthouse-ci/${NAME}.json" 2>/dev/null || echo "0")
    SEO=$(jq '.categories.seo.score * 100' "./reports/lighthouse-ci/${NAME}.json" 2>/dev/null || echo "0")

    # Print results
    PERF_INT=${PERF%.*}
    A11Y_INT=${A11Y%.*}
    BP_INT=${BP%.*}
    SEO_INT=${SEO%.*}

    if [ "$PERF_INT" -ge "$PERF_THRESHOLD" ]; then
        echo -e "   Performance: ${GREEN}${PERF_INT}/100 ✅${NC}"
    else
        echo -e "   Performance: ${YELLOW}${PERF_INT}/100 ⚠️${NC}"
    fi

    if [ "$A11Y_INT" -ge "$A11Y_THRESHOLD" ]; then
        echo -e "   Accessibility: ${GREEN}${A11Y_INT}/100 ✅${NC}"
    else
        echo -e "   Accessibility: ${YELLOW}${A11Y_INT}/100 ⚠️${NC}"
    fi

    if [ "$BP_INT" -ge "$BP_THRESHOLD" ]; then
        echo -e "   Best Practices: ${GREEN}${BP_INT}/100 ✅${NC}"
    else
        echo -e "   Best Practices: ${YELLOW}${BP_INT}/100 ⚠️${NC}"
    fi

    if [ "$SEO_INT" -ge "$SEO_THRESHOLD" ]; then
        echo -e "   SEO: ${GREEN}${SEO_INT}/100 ✅${NC}"
    else
        echo -e "   SEO: ${YELLOW}${SEO_INT}/100 ⚠️${NC}"
    fi

    echo ""

    # Accumulate totals
    TOTAL_PERF=$(echo "$TOTAL_PERF + $PERF" | bc)
    TOTAL_A11Y=$(echo "$TOTAL_A11Y + $A11Y" | bc)
    TOTAL_BP=$(echo "$TOTAL_BP + $BP" | bc)
    TOTAL_SEO=$(echo "$TOTAL_SEO + $SEO" | bc)
    COUNT=$((COUNT + 1))
done

# Calculate averages
if [ "$COUNT" -gt 0 ]; then
    AVG_PERF=$(echo "scale=0; $TOTAL_PERF / $COUNT" | bc)
    AVG_A11Y=$(echo "scale=0; $TOTAL_A11Y / $COUNT" | bc)
    AVG_BP=$(echo "scale=0; $TOTAL_BP / $COUNT" | bc)
    AVG_SEO=$(echo "scale=0; $TOTAL_SEO / $COUNT" | bc)

    echo "================================================================================"
    echo "                         SUMMARY RESULTS"
    echo "================================================================================"
    echo ""

    # Check if all thresholds met
    ALL_PASS=true

    echo -n "Average Performance: "
    if [ "$AVG_PERF" -ge "$PERF_THRESHOLD" ]; then
        echo -e "${GREEN}${AVG_PERF}/100 ✅${NC}"
    else
        echo -e "${YELLOW}${AVG_PERF}/100 ⚠️ (Threshold: ${PERF_THRESHOLD})${NC}"
        ALL_PASS=false
    fi

    echo -n "Average Accessibility: "
    if [ "$AVG_A11Y" -ge "$A11Y_THRESHOLD" ]; then
        echo -e "${GREEN}${AVG_A11Y}/100 ✅${NC}"
    else
        echo -e "${YELLOW}${AVG_A11Y}/100 ⚠️ (Threshold: ${A11Y_THRESHOLD})${NC}"
        ALL_PASS=false
    fi

    echo -n "Average Best Practices: "
    if [ "$AVG_BP" -ge "$BP_THRESHOLD" ]; then
        echo -e "${GREEN}${AVG_BP}/100 ✅${NC}"
    else
        echo -e "${YELLOW}${AVG_BP}/100 ⚠️ (Threshold: ${BP_THRESHOLD})${NC}"
        ALL_PASS=false
    fi

    echo -n "Average SEO: "
    if [ "$AVG_SEO" -ge "$SEO_THRESHOLD" ]; then
        echo -e "${GREEN}${AVG_SEO}/100 ✅${NC}"
    else
        echo -e "${YELLOW}${AVG_SEO}/100 ⚠️ (Threshold: ${SEO_THRESHOLD})${NC}"
        ALL_PASS=false
    fi

    echo ""
    echo "================================================================================"

    if [ "$ALL_PASS" = true ]; then
        echo -e "${GREEN}🎉 All performance thresholds met!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Some thresholds not met. Review the detailed report.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ No successful tests completed${NC}"
    exit 1
fi
