#!/bin/bash

###############################################################################
# Dependency Security Scanner
#
# Scans project dependencies for known vulnerabilities using multiple tools.
# Returns non-zero exit code if HIGH or CRITICAL vulnerabilities are found.
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Starting Dependency Security Scan..."
echo "========================================"
echo ""

# Track vulnerabilities
HIGH_CRITICAL_FOUND=0

# Function to print colored messages
print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 1. NPM Audit
echo "1️⃣  Running npm audit..."
echo "------------------------"

if npm audit --audit-level=moderate --json > npm-audit-report.json 2>&1; then
    print_success "npm audit: No moderate+ vulnerabilities found"
else
    # Parse the JSON report
    if [ -f npm-audit-report.json ]; then
        HIGH_COUNT=$(cat npm-audit-report.json | grep -o '"severity":"high"' | wc -l)
        CRITICAL_COUNT=$(cat npm-audit-report.json | grep -o '"severity":"critical"' | wc -l)

        if [ "$HIGH_COUNT" -gt 0 ] || [ "$CRITICAL_COUNT" -gt 0 ]; then
            print_error "Found $CRITICAL_COUNT CRITICAL and $HIGH_COUNT HIGH vulnerabilities"
            HIGH_CRITICAL_FOUND=1
        else
            print_warning "Found moderate vulnerabilities (see npm-audit-report.json)"
        fi
    fi
fi

echo ""

# 2. Check for outdated packages
echo "2️⃣  Checking for outdated packages..."
echo "------------------------------------"

if npm outdated > outdated-packages.txt 2>&1 || true; then
    if [ -s outdated-packages.txt ]; then
        print_warning "Some packages are outdated (see outdated-packages.txt)"
        cat outdated-packages.txt
    else
        print_success "All packages are up to date"
    fi
fi

echo ""

# 3. Check for Snyk (if available)
echo "3️⃣  Running Snyk (if available)..."
echo "----------------------------------"

if command -v snyk &> /dev/null; then
    if snyk test --severity-threshold=high --json > snyk-report.json 2>&1; then
        print_success "Snyk: No HIGH or CRITICAL vulnerabilities found"
    else
        print_error "Snyk found HIGH or CRITICAL vulnerabilities (see snyk-report.json)"
        HIGH_CRITICAL_FOUND=1
    fi
else
    print_warning "Snyk not installed. Install with: npm install -g snyk"
fi

echo ""

# 4. Check for known malicious packages
echo "4️⃣  Checking for known malicious packages..."
echo "--------------------------------------------"

MALICIOUS_PACKAGES=(
    "event-stream@3.3.6"
    "flatmap-stream"
    "eslint-scope@3.7.2"
    "getcookies"
    "http-proxy-agent@2.1.0"
)

FOUND_MALICIOUS=0

for package in "${MALICIOUS_PACKAGES[@]}"; do
    if npm list "$package" 2>&1 | grep -q "$package"; then
        print_error "Found known malicious package: $package"
        FOUND_MALICIOUS=1
        HIGH_CRITICAL_FOUND=1
    fi
done

if [ $FOUND_MALICIOUS -eq 0 ]; then
    print_success "No known malicious packages found"
fi

echo ""

# 5. Check for typosquatting
echo "5️⃣  Checking for potential typosquatting..."
echo "-------------------------------------------"

SUSPICIOUS_PATTERNS=(
    "reacct"
    "requset"
    "expres"
    "lodas"
    "momnet"
)

FOUND_SUSPICIOUS=0

for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
    if npm list 2>&1 | grep -qi "$pattern"; then
        print_warning "Potentially suspicious package name containing: $pattern"
        FOUND_SUSPICIOUS=1
    fi
done

if [ $FOUND_SUSPICIOUS -eq 0 ]; then
    print_success "No obvious typosquatting detected"
fi

echo ""

# 6. Check package-lock.json integrity
echo "6️⃣  Checking package-lock.json integrity..."
echo "-------------------------------------------"

if [ -f package-lock.json ]; then
    if npm ci --dry-run > /dev/null 2>&1; then
        print_success "package-lock.json is valid"
    else
        print_error "package-lock.json may be corrupted or out of sync"
        HIGH_CRITICAL_FOUND=1
    fi
else
    print_warning "package-lock.json not found"
fi

echo ""

# 7. Check for dependencies with no recent updates (abandoned)
echo "7️⃣  Checking for potentially abandoned packages..."
echo "--------------------------------------------------"

# This would require checking npm registry data
print_warning "Manual check recommended for abandoned packages"

echo ""

# 8. License compliance check
echo "8️⃣  Checking licenses..."
echo "------------------------"

if command -v npx &> /dev/null; then
    npx license-checker --summary > license-summary.txt 2>&1 || true
    if [ -s license-summary.txt ]; then
        print_success "License summary generated (see license-summary.txt)"
        cat license-summary.txt
    fi
else
    print_warning "npx not available for license checking"
fi

echo ""

# 9. Generate consolidated report
echo "9️⃣  Generating consolidated report..."
echo "-------------------------------------"

cat > security-report.txt << EOF
Dependency Security Scan Report
Generated: $(date)

NPM Audit Report: npm-audit-report.json
Outdated Packages: outdated-packages.txt
Snyk Report: snyk-report.json (if available)
License Summary: license-summary.txt (if available)

Summary:
- HIGH/CRITICAL vulnerabilities found: $HIGH_CRITICAL_FOUND
- Malicious packages found: $FOUND_MALICIOUS
- Suspicious patterns found: $FOUND_SUSPICIOUS

Recommendations:
1. Review all vulnerability reports
2. Update vulnerable packages: npm audit fix
3. For breaking changes, review: npm audit fix --force
4. Check for security advisories: https://github.com/advisories
5. Monitor dependencies regularly

EOF

print_success "Security report generated: security-report.txt"

echo ""
echo "========================================"
echo "Scan Complete!"
echo "========================================"

if [ $HIGH_CRITICAL_FOUND -eq 1 ]; then
    print_error "SECURITY SCAN FAILED: HIGH or CRITICAL vulnerabilities found"
    echo ""
    echo "Please review the reports and fix vulnerabilities before deploying."
    exit 1
else
    print_success "SECURITY SCAN PASSED: No HIGH or CRITICAL vulnerabilities found"
    exit 0
fi
