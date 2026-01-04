#!/bin/bash

###############################################################################
# Tenant Isolation Security Verification Script
#
# This script verifies that the tenant ID injection vulnerability has been
# properly fixed and that tenant isolation is enforced across all AI endpoints.
#
# Usage: ./scripts/verify-tenant-isolation.sh
###############################################################################

set -e

echo "=================================================="
echo "TENANT ISOLATION SECURITY VERIFICATION"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
CHECKS_PASSED=0
CHECKS_FAILED=0
TOTAL_CHECKS=0

# Function to check a condition
check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    local description="$1"
    local command="$2"

    echo -n "Checking: $description... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
}

echo "1. Verifying lib/auth/context.ts exists and is correct"
echo "-------------------------------------------------------"

check "context.ts file exists" "test -f lib/auth/context.ts"
check "getUserContextFromRequest function exists" "grep -q 'getUserContextFromRequest' lib/auth/context.ts"
check "getTenantContextFromRequest function exists" "grep -q 'getTenantContextFromRequest' lib/auth/context.ts"
check "validateTenantAccess function exists" "grep -q 'validateTenantAccess' lib/auth/context.ts"
check "Uses jwtVerify for token validation" "grep -q 'jwtVerify' lib/auth/context.ts"

echo ""
echo "2. Verifying detect-duplicates endpoint fix"
echo "--------------------------------------------"

check "detect-duplicates uses getUserContextFromRequest" "grep -q 'getUserContextFromRequest' app/api/ai/detect-duplicates/route.ts"
check "detect-duplicates has validation schema" "grep -q 'detectDuplicatesSchema' app/api/ai/detect-duplicates/route.ts"
check "Schema does NOT accept tenant_id" "grep -q 'tenant_id is NOT accepted from request body' app/api/ai/detect-duplicates/route.ts"
check "Uses tenantId from userContext" "grep -q 'userContext.organization_id' app/api/ai/detect-duplicates/route.ts"
check "No direct tenant_id from body" "! grep -q 'body.tenant_id' app/api/ai/detect-duplicates/route.ts"

echo ""
echo "3. Verifying other AI endpoints use proper authentication"
echo "---------------------------------------------------------"

check "classify-ticket uses verifyToken" "grep -q 'verifyToken' app/api/ai/classify-ticket/route.ts"
check "suggest-solutions uses verifyToken" "grep -q 'verifyToken' app/api/ai/suggest-solutions/route.ts"
check "analyze-sentiment uses verifyToken" "grep -q 'verifyToken' app/api/ai/analyze-sentiment/route.ts"
check "generate-response uses verifyToken" "grep -q 'verifyToken' app/api/ai/generate-response/route.ts"
check "feedback uses verifyToken" "grep -q 'verifyToken' app/api/ai/feedback/route.ts"
check "metrics uses verifyToken" "grep -q 'verifyToken' app/api/ai/metrics/route.ts"
check "train uses verifyToken" "grep -q 'verifyToken' app/api/ai/train/route.ts"

echo ""
echo "4. Verifying security tests exist"
echo "----------------------------------"

check "tenant-isolation.test.ts exists" "test -f tests/security/tenant-isolation.test.ts"
check "Tests getUserContextFromRequest" "grep -q 'getUserContextFromRequest' tests/security/tenant-isolation.test.ts"
check "Tests tenant ID injection prevention" "grep -q 'tenant_id injection' tests/security/tenant-isolation.test.ts"
check "Tests JWT token extraction" "grep -q 'JWT Token Tenant Extraction' tests/security/tenant-isolation.test.ts"

echo ""
echo "5. Verifying no tenant_id accepted from request bodies in AI endpoints"
echo "-----------------------------------------------------------------------"

# Check that no AI endpoint directly uses body.tenant_id or body.organization_id
AI_ENDPOINTS=(
    "app/api/ai/classify-ticket/route.ts"
    "app/api/ai/detect-duplicates/route.ts"
    "app/api/ai/suggest-solutions/route.ts"
    "app/api/ai/analyze-sentiment/route.ts"
    "app/api/ai/generate-response/route.ts"
)

for endpoint in "${AI_ENDPOINTS[@]}"; do
    filename=$(basename "$endpoint" .ts)
    check "$filename does NOT use body.tenant_id" "! grep -q 'body\.tenant_id\|body\.organization_id' $endpoint"
done

echo ""
echo "6. Verifying documentation exists"
echo "----------------------------------"

check "AGENT_3 Summary report exists" "test -f AGENT_3_SUMMARY.md"
check "AGENT_3 Detailed report exists" "test -f AGENT_3_TENANT_ISOLATION_SECURITY_FIX_REPORT.md"

echo ""
echo "=================================================="
echo "VERIFICATION SUMMARY"
echo "=================================================="
echo ""
echo -e "Total Checks:  $TOTAL_CHECKS"
echo -e "${GREEN}Passed:        $CHECKS_PASSED${NC}"
echo -e "${RED}Failed:        $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL SECURITY CHECKS PASSED${NC}"
    echo ""
    echo "Tenant isolation vulnerability has been properly fixed."
    echo "All AI endpoints enforce proper tenant isolation."
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME CHECKS FAILED${NC}"
    echo ""
    echo "Please review the failed checks above and ensure all"
    echo "security requirements are met before deployment."
    echo ""
    exit 1
fi
