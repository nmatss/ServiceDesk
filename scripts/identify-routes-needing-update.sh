#!/bin/bash

# Script to identify API routes that still need authentication pattern updates
# This helps track progress and prioritize remaining work

echo "================================================"
echo "API Routes Needing Authentication Pattern Update"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
FIXED=0
NEEDS_UPDATE=0
TOTAL=0

echo "Scanning app/api/ directory..."
echo ""

# Find all route.ts files in app/api
find app/api -name "route.ts" -type f | sort | while read -r file; do
    TOTAL=$((TOTAL + 1))

    # Check if file uses verifyTokenFromCookies (CORRECT pattern)
    if grep -q "verifyTokenFromCookies" "$file"; then
        echo -e "${GREEN}✓${NC} $file"
        FIXED=$((FIXED + 1))
    # Check if file uses old Bearer pattern
    elif grep -q "request.headers.get('authorization')" "$file" || \
         grep -q 'request.headers.get("authorization")' "$file"; then
        echo -e "${RED}✗${NC} $file ${YELLOW}(uses Bearer auth)${NC}"
        NEEDS_UPDATE=$((NEEDS_UPDATE + 1))
    # Check if uses verifyToken (old pattern)
    elif grep -q "verifyToken(" "$file" && ! grep -q "verifyTokenFromCookies" "$file"; then
        echo -e "${RED}✗${NC} $file ${YELLOW}(uses verifyToken)${NC}"
        NEEDS_UPDATE=$((NEEDS_UPDATE + 1))
    else
        # File might not need auth (login, register, etc.)
        echo -e "  $file ${YELLOW}(no auth pattern detected)${NC}"
    fi
done

echo ""
echo "================================================"
echo "Summary by Priority"
echo "================================================"
echo ""

echo "HIGH PRIORITY - Admin Routes:"
echo "------------------------------"
find app/api/admin -name "route.ts" -type f | sort | while read -r file; do
    if ! grep -q "verifyTokenFromCookies" "$file"; then
        if grep -q "request.headers.get" "$file" || grep -q "verifyToken(" "$file"; then
            echo "  - $file"
        fi
    fi
done

echo ""
echo "MEDIUM PRIORITY - AI Routes:"
echo "----------------------------"
find app/api/ai -name "route.ts" -type f 2>/dev/null | sort | while read -r file; do
    if ! grep -q "verifyTokenFromCookies" "$file"; then
        if grep -q "request.headers.get" "$file" || grep -q "verifyToken(" "$file"; then
            echo "  - $file"
        fi
    fi
done

echo ""
echo "MEDIUM PRIORITY - Knowledge Routes:"
echo "-----------------------------------"
find app/api/knowledge -name "route.ts" -type f 2>/dev/null | sort | while read -r file; do
    if ! grep -q "verifyTokenFromCookies" "$file"; then
        if grep -q "request.headers.get" "$file" || grep -q "verifyToken(" "$file"; then
            echo "  - $file"
        fi
    fi
done

echo ""
echo "MEDIUM PRIORITY - Ticket Routes:"
echo "--------------------------------"
find app/api/tickets -name "route.ts" -type f 2>/dev/null | sort | while read -r file; do
    if ! grep -q "verifyTokenFromCookies" "$file"; then
        if grep -q "request.headers.get" "$file" || grep -q "verifyToken(" "$file"; then
            echo "  - $file"
        fi
    fi
done

echo ""
echo "================================================"
echo "Quick Stats"
echo "================================================"
echo ""
echo "Files already using cookie-based auth:"
find app/api -name "route.ts" -type f -exec grep -l "verifyTokenFromCookies" {} \; | wc -l

echo ""
echo "Files using old Bearer token pattern:"
find app/api -name "route.ts" -type f -exec grep -l "request.headers.get.*authorization" {} \; | wc -l

echo ""
echo "================================================"
echo "Next Steps"
echo "================================================"
echo ""
echo "1. Review API_ROUTE_CONSISTENCY_GUIDE.md for patterns"
echo "2. Start with HIGH PRIORITY admin routes"
echo "3. Use the standardized template from the guide"
echo "4. Test each route after updating"
echo "5. Update API_CONSISTENCY_FIX_REPORT.md progress"
echo ""
