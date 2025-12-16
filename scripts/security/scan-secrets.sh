#!/bin/bash

###############################################################################
# Secrets Scanner
#
# Scans codebase for accidentally committed secrets, API keys, and credentials.
# Uses regex patterns to detect common secret formats.
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔐 Starting Secrets Scan..."
echo "==========================="
echo ""

SECRETS_FOUND=0
SECRETS_LOG="secrets-scan-report.txt"

# Clear previous report
> "$SECRETS_LOG"

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_finding() {
    echo "$1" >> "$SECRETS_LOG"
    print_error "$1"
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
}

# Directories to scan
SCAN_DIRS="app lib scripts components pages api"

# Directories to exclude
EXCLUDE_DIRS="node_modules .next dist build coverage .git"

# Build exclude pattern for grep
EXCLUDE_PATTERN=""
for dir in $EXCLUDE_DIRS; do
    EXCLUDE_PATTERN="$EXCLUDE_PATTERN --exclude-dir=$dir"
done

echo "1️⃣  Scanning for hardcoded API keys..."
echo "--------------------------------------"

# AWS Access Keys
if grep -r $EXCLUDE_PATTERN -E "AKIA[0-9A-Z]{16}" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential AWS Access Key ID"
fi

# Generic API key patterns
if grep -r $EXCLUDE_PATTERN -iE "(api[_-]?key|apikey)['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential API key"
fi

# Secret key patterns
if grep -r $EXCLUDE_PATTERN -iE "(secret[_-]?key|secretkey)['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential secret key"
fi

echo ""

echo "2️⃣  Scanning for passwords..."
echo "-----------------------------"

# Password in code
if grep -r $EXCLUDE_PATTERN -iE "(password|passwd|pwd)['\"]?\s*[:=]\s*['\"][^'\"]{8,}['\"]" $SCAN_DIRS 2>/dev/null | grep -v "process.env" | grep -v "PASSWORD" | grep -v "example"; then
    log_finding "Found potential hardcoded password"
fi

# Database connection strings
if grep -r $EXCLUDE_PATTERN -E "(mysql|postgres|mongodb)://[^:]+:[^@]+@" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential database connection string with credentials"
fi

echo ""

echo "3️⃣  Scanning for JWT secrets..."
echo "--------------------------------"

# JWT secret
if grep -r $EXCLUDE_PATTERN -iE "jwt[_-]?secret['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_\-]{10,}['\"]" $SCAN_DIRS 2>/dev/null | grep -v "process.env"; then
    log_finding "Found potential hardcoded JWT secret"
fi

echo ""

echo "4️⃣  Scanning for OAuth tokens..."
echo "---------------------------------"

# GitHub tokens
if grep -r $EXCLUDE_PATTERN -E "ghp_[a-zA-Z0-9]{36}" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential GitHub Personal Access Token"
fi

# Generic OAuth tokens
if grep -r $EXCLUDE_PATTERN -iE "(oauth|bearer)[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_\-\.]{20,}['\"]" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential OAuth token"
fi

echo ""

echo "5️⃣  Scanning for private keys..."
echo "---------------------------------"

# Private keys
if grep -r $EXCLUDE_PATTERN "BEGIN.*PRIVATE KEY" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential private key"
fi

# SSH private keys
if grep -r $EXCLUDE_PATTERN "BEGIN RSA PRIVATE KEY" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential RSA private key"
fi

echo ""

echo "6️⃣  Scanning for cloud provider credentials..."
echo "-----------------------------------------------"

# AWS Secret Access Key
if grep -r $EXCLUDE_PATTERN -E "['\"][a-zA-Z0-9/+=]{40}['\"]" $SCAN_DIRS 2>/dev/null | grep -i "aws"; then
    log_finding "Found potential AWS Secret Access Key"
fi

# Google Cloud keys
if grep -r $EXCLUDE_PATTERN '"type": "service_account"' $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential Google Cloud service account key"
fi

# Azure connection strings
if grep -r $EXCLUDE_PATTERN "DefaultEndpointsProtocol=https;AccountName=" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential Azure connection string"
fi

echo ""

echo "7️⃣  Scanning for Stripe keys..."
echo "--------------------------------"

# Stripe keys
if grep -r $EXCLUDE_PATTERN -E "sk_live_[a-zA-Z0-9]{24,}" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential Stripe live secret key"
fi

if grep -r $EXCLUDE_PATTERN -E "pk_live_[a-zA-Z0-9]{24,}" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential Stripe live publishable key"
fi

echo ""

echo "8️⃣  Scanning for Slack tokens..."
echo "---------------------------------"

# Slack tokens
if grep -r $EXCLUDE_PATTERN -E "xox[pbar]-[0-9]{10,13}-[a-zA-Z0-9-]+" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential Slack token"
fi

echo ""

echo "9️⃣  Scanning for SendGrid API keys..."
echo "--------------------------------------"

# SendGrid
if grep -r $EXCLUDE_PATTERN -E "SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}" $SCAN_DIRS 2>/dev/null; then
    log_finding "Found potential SendGrid API key"
fi

echo ""

echo "🔟 Scanning for Twilio credentials..."
echo "-------------------------------------"

# Twilio
if grep -r $EXCLUDE_PATTERN -E "SK[a-z0-9]{32}" $SCAN_DIRS 2>/dev/null | grep -i twilio; then
    log_finding "Found potential Twilio API key"
fi

echo ""

echo "1️⃣1️⃣  Scanning .env files in git..."
echo "-----------------------------------"

# Check if .env files are tracked by git
if git ls-files | grep -E "\.env$|\.env\..*" 2>/dev/null; then
    log_finding "Found .env file(s) tracked by git - these should be in .gitignore"
fi

echo ""

echo "1️⃣2️⃣  Scanning git history for secrets..."
echo "-----------------------------------------"

# Check if gitleaks is available
if command -v gitleaks &> /dev/null; then
    if gitleaks detect --no-git --source=. --report-path=gitleaks-report.json 2>&1 | tee gitleaks-output.txt; then
        print_success "Gitleaks: No secrets found in codebase"
    else
        if [ -f gitleaks-report.json ]; then
            log_finding "Gitleaks found potential secrets (see gitleaks-report.json)"
        fi
    fi
else
    print_warning "gitleaks not installed. Install from: https://github.com/gitleaks/gitleaks"
    echo "         Skipping git history scan..."
fi

echo ""

echo "1️⃣3️⃣  Checking for trufflehog (if available)..."
echo "-----------------------------------------------"

if command -v trufflehog &> /dev/null; then
    if trufflehog filesystem . --json > trufflehog-report.json 2>&1; then
        if [ -s trufflehog-report.json ]; then
            log_finding "TruffleHog found potential secrets (see trufflehog-report.json)"
        else
            print_success "TruffleHog: No secrets found"
        fi
    fi
else
    print_warning "trufflehog not installed. Install from: https://github.com/trufflesecurity/trufflehog"
fi

echo ""

echo "1️⃣4️⃣  Checking specific files for secrets..."
echo "--------------------------------------------"

# Check common config files
SENSITIVE_FILES=".env .env.local .env.production credentials.json secrets.json firebase-adminsdk.json"

for file in $SENSITIVE_FILES; do
    if [ -f "$file" ]; then
        if git ls-files --error-unmatch "$file" 2>/dev/null; then
            log_finding "Sensitive file '$file' is tracked by git"
        fi
    fi
done

echo ""

# Generate final report
cat > "$SECRETS_LOG.summary" << EOF
Secrets Scan Report
Generated: $(date)

Total Potential Secrets Found: $SECRETS_FOUND

Detailed Findings: $SECRETS_LOG

Recommendations:
1. Review all findings in $SECRETS_LOG
2. Remove any hardcoded secrets from code
3. Use environment variables for all secrets
4. Add sensitive files to .gitignore
5. Rotate any exposed credentials immediately
6. Use secret management tools (AWS Secrets Manager, HashiCorp Vault, etc.)
7. Install gitleaks and trufflehog for comprehensive scanning

Prevention:
- Add pre-commit hook to scan for secrets
- Use environment variables exclusively
- Never commit .env files
- Use .env.example as template
- Enable secret scanning in GitHub/GitLab

EOF

cat "$SECRETS_LOG.summary"

echo ""
echo "==========================="
echo "Scan Complete!"
echo "==========================="

if [ $SECRETS_FOUND -gt 0 ]; then
    print_error "SECRETS SCAN FAILED: Found $SECRETS_FOUND potential secret(s)"
    echo ""
    echo "⚠️  CRITICAL: Review all findings immediately!"
    echo "📋 Detailed report: $SECRETS_LOG"
    exit 1
else
    print_success "SECRETS SCAN PASSED: No secrets detected"
    exit 0
fi
