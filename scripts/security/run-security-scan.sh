#!/bin/bash

# Security Scanning Script for ServiceDesk
# This script runs comprehensive security scans including:
# - Dependency vulnerabilities
# - Secret detection
# - SQL injection patterns
# - XSS vulnerabilities
# - Insecure code patterns

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create reports directory if it doesn't exist
REPORTS_DIR="reports/security"
mkdir -p "$REPORTS_DIR"

# Timestamp for report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORTS_DIR/security-scan-$TIMESTAMP.txt"

echo "============================================" | tee "$REPORT_FILE"
echo "Security Scan Report - $(date)" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Function to log findings
log_finding() {
    local severity=$1
    local message=$2
    local color=$NC

    case $severity in
        "CRITICAL") color=$RED ;;
        "HIGH") color=$RED ;;
        "MEDIUM") color=$YELLOW ;;
        "LOW") color=$GREEN ;;
    esac

    echo -e "${color}[$severity]${NC} $message" | tee -a "$REPORT_FILE"
}

# 1. Dependency Vulnerabilities
echo "=== 1. NPM AUDIT - Dependency Vulnerabilities ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

npm audit --production --json > "$REPORTS_DIR/npm-audit-$TIMESTAMP.json" 2>&1 || true
npm audit --production | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Count vulnerabilities
CRITICAL_COUNT=$(grep -o "critical" "$REPORTS_DIR/npm-audit-$TIMESTAMP.json" | wc -l || echo 0)
HIGH_COUNT=$(grep -o "high" "$REPORTS_DIR/npm-audit-$TIMESTAMP.json" | wc -l || echo 0)

if [ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ]; then
    log_finding "CRITICAL" "Found $CRITICAL_COUNT critical and $HIGH_COUNT high severity vulnerabilities in dependencies"
else
    log_finding "LOW" "No critical or high severity vulnerabilities found in dependencies"
fi
echo "" | tee -a "$REPORT_FILE"

# 2. Secret Detection
echo "=== 2. SECRET DETECTION ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

SECRET_COUNT=0

# Check for hardcoded passwords
echo "Checking for hardcoded passwords..." | tee -a "$REPORT_FILE"
PASSWORD_MATCHES=$(grep -r "password\s*=\s*['\"][^'\"]\+" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$PASSWORD_MATCHES" ]; then
    echo "$PASSWORD_MATCHES" | tee -a "$REPORT_FILE"
    PASSWORD_COUNT=$(echo "$PASSWORD_MATCHES" | wc -l)
    log_finding "HIGH" "Found $PASSWORD_COUNT potential hardcoded passwords"
    SECRET_COUNT=$((SECRET_COUNT + PASSWORD_COUNT))
fi

# Check for API keys
echo "Checking for hardcoded API keys..." | tee -a "$REPORT_FILE"
API_KEY_MATCHES=$(grep -r "api[_-]key\s*=\s*['\"][^'\"]\+" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$API_KEY_MATCHES" ]; then
    echo "$API_KEY_MATCHES" | tee -a "$REPORT_FILE"
    API_KEY_COUNT=$(echo "$API_KEY_MATCHES" | wc -l)
    log_finding "HIGH" "Found $API_KEY_COUNT potential hardcoded API keys"
    SECRET_COUNT=$((SECRET_COUNT + API_KEY_COUNT))
fi

# Check for secret tokens
echo "Checking for hardcoded secrets..." | tee -a "$REPORT_FILE"
SECRET_MATCHES=$(grep -r "secret\s*=\s*['\"][^'\"]\+" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$SECRET_MATCHES" ]; then
    echo "$SECRET_MATCHES" | tee -a "$REPORT_FILE"
    SECRET_MATCH_COUNT=$(echo "$SECRET_MATCHES" | wc -l)
    log_finding "HIGH" "Found $SECRET_MATCH_COUNT potential hardcoded secrets"
    SECRET_COUNT=$((SECRET_COUNT + SECRET_MATCH_COUNT))
fi

# Check for JWT secrets
echo "Checking for hardcoded JWT secrets..." | tee -a "$REPORT_FILE"
JWT_MATCHES=$(grep -r "jwt[_-]secret\s*=\s*['\"][^'\"]\+" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$JWT_MATCHES" ]; then
    echo "$JWT_MATCHES" | tee -a "$REPORT_FILE"
    JWT_COUNT=$(echo "$JWT_MATCHES" | wc -l)
    log_finding "CRITICAL" "Found $JWT_COUNT potential hardcoded JWT secrets"
    SECRET_COUNT=$((SECRET_COUNT + JWT_COUNT))
fi

if [ $SECRET_COUNT -eq 0 ]; then
    log_finding "LOW" "No hardcoded secrets detected"
fi
echo "" | tee -a "$REPORT_FILE"

# 3. SQL Injection Check
echo "=== 3. SQL INJECTION PATTERNS ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

SQL_INJECTION_COUNT=0

# Check for string interpolation in SQL queries
echo "Checking for template literal SQL injection..." | tee -a "$REPORT_FILE"
SQL_TEMPLATE_MATCHES=$(grep -rn "db\.prepare.*\${" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$SQL_TEMPLATE_MATCHES" ]; then
    echo "$SQL_TEMPLATE_MATCHES" | tee -a "$REPORT_FILE"
    SQL_TEMPLATE_COUNT=$(echo "$SQL_TEMPLATE_MATCHES" | wc -l)
    log_finding "HIGH" "Found $SQL_TEMPLATE_COUNT potential SQL injection via template literals in db.prepare"
    SQL_INJECTION_COUNT=$((SQL_INJECTION_COUNT + SQL_TEMPLATE_COUNT))
fi

echo "Checking for SQL exec injection..." | tee -a "$REPORT_FILE"
SQL_EXEC_MATCHES=$(grep -rn "db\.exec.*\${" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$SQL_EXEC_MATCHES" ]; then
    echo "$SQL_EXEC_MATCHES" | tee -a "$REPORT_FILE"
    SQL_EXEC_COUNT=$(echo "$SQL_EXEC_MATCHES" | wc -l)
    log_finding "CRITICAL" "Found $SQL_EXEC_COUNT potential SQL injection via template literals in db.exec"
    SQL_INJECTION_COUNT=$((SQL_INJECTION_COUNT + SQL_EXEC_COUNT))
fi

# Check for string concatenation in SQL
echo "Checking for SQL string concatenation..." | tee -a "$REPORT_FILE"
SQL_CONCAT_MATCHES=$(grep -rn "\"SELECT.*\"\s*\+\s*" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$SQL_CONCAT_MATCHES" ]; then
    echo "$SQL_CONCAT_MATCHES" | tee -a "$REPORT_FILE"
    SQL_CONCAT_COUNT=$(echo "$SQL_CONCAT_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $SQL_CONCAT_COUNT potential SQL injection via string concatenation"
    SQL_INJECTION_COUNT=$((SQL_INJECTION_COUNT + SQL_CONCAT_COUNT))
fi

if [ $SQL_INJECTION_COUNT -eq 0 ]; then
    log_finding "LOW" "No obvious SQL injection patterns detected"
fi
echo "" | tee -a "$REPORT_FILE"

# 4. Eval Usage Check
echo "=== 4. DANGEROUS CODE PATTERNS ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

DANGEROUS_COUNT=0

echo "Checking for eval() usage..." | tee -a "$REPORT_FILE"
EVAL_MATCHES=$(grep -rn "eval(" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$EVAL_MATCHES" ]; then
    echo "$EVAL_MATCHES" | tee -a "$REPORT_FILE"
    EVAL_COUNT=$(echo "$EVAL_MATCHES" | wc -l)
    log_finding "CRITICAL" "Found $EVAL_COUNT instances of eval() usage"
    DANGEROUS_COUNT=$((DANGEROUS_COUNT + EVAL_COUNT))
fi

# Check for Function constructor
echo "Checking for Function constructor..." | tee -a "$REPORT_FILE"
FUNCTION_CONSTRUCTOR_MATCHES=$(grep -rn "new Function(" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$FUNCTION_CONSTRUCTOR_MATCHES" ]; then
    echo "$FUNCTION_CONSTRUCTOR_MATCHES" | tee -a "$REPORT_FILE"
    FUNCTION_CONSTRUCTOR_COUNT=$(echo "$FUNCTION_CONSTRUCTOR_MATCHES" | wc -l)
    log_finding "HIGH" "Found $FUNCTION_CONSTRUCTOR_COUNT instances of Function constructor"
    DANGEROUS_COUNT=$((DANGEROUS_COUNT + FUNCTION_CONSTRUCTOR_COUNT))
fi

# Check for dangerouslySetInnerHTML
echo "Checking for dangerouslySetInnerHTML..." | tee -a "$REPORT_FILE"
DANGEROUSLY_SET_MATCHES=$(grep -rn "dangerouslySetInnerHTML" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$DANGEROUSLY_SET_MATCHES" ]; then
    echo "$DANGEROUSLY_SET_MATCHES" | tee -a "$REPORT_FILE"
    DANGEROUSLY_SET_COUNT=$(echo "$DANGEROUSLY_SET_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $DANGEROUSLY_SET_COUNT instances of dangerouslySetInnerHTML (review for XSS)"
    DANGEROUS_COUNT=$((DANGEROUS_COUNT + DANGEROUSLY_SET_COUNT))
fi

if [ $DANGEROUS_COUNT -eq 0 ]; then
    log_finding "LOW" "No dangerous code patterns detected"
fi
echo "" | tee -a "$REPORT_FILE"

# 5. XSS Vulnerabilities
echo "=== 5. XSS VULNERABILITY PATTERNS ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

XSS_COUNT=0

# Check for innerHTML usage
echo "Checking for innerHTML usage..." | tee -a "$REPORT_FILE"
INNER_HTML_MATCHES=$(grep -rn "\.innerHTML\s*=" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$INNER_HTML_MATCHES" ]; then
    echo "$INNER_HTML_MATCHES" | tee -a "$REPORT_FILE"
    INNER_HTML_COUNT=$(echo "$INNER_HTML_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $INNER_HTML_COUNT instances of innerHTML assignment (review for XSS)"
    XSS_COUNT=$((XSS_COUNT + INNER_HTML_COUNT))
fi

# Check for document.write
echo "Checking for document.write..." | tee -a "$REPORT_FILE"
DOCUMENT_WRITE_MATCHES=$(grep -rn "document\.write(" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$DOCUMENT_WRITE_MATCHES" ]; then
    echo "$DOCUMENT_WRITE_MATCHES" | tee -a "$REPORT_FILE"
    DOCUMENT_WRITE_COUNT=$(echo "$DOCUMENT_WRITE_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $DOCUMENT_WRITE_COUNT instances of document.write (XSS risk)"
    XSS_COUNT=$((XSS_COUNT + DOCUMENT_WRITE_COUNT))
fi

if [ $XSS_COUNT -eq 0 ]; then
    log_finding "LOW" "No obvious XSS patterns detected"
fi
echo "" | tee -a "$REPORT_FILE"

# 6. Authentication & Authorization Issues
echo "=== 6. AUTHENTICATION & AUTHORIZATION ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

AUTH_COUNT=0

# Check for weak password requirements
echo "Checking for weak password validation..." | tee -a "$REPORT_FILE"
WEAK_PASSWORD_MATCHES=$(grep -rn "password.*length.*<\s*[1-6]" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$WEAK_PASSWORD_MATCHES" ]; then
    echo "$WEAK_PASSWORD_MATCHES" | tee -a "$REPORT_FILE"
    WEAK_PASSWORD_COUNT=$(echo "$WEAK_PASSWORD_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $WEAK_PASSWORD_COUNT potential weak password requirements"
    AUTH_COUNT=$((AUTH_COUNT + WEAK_PASSWORD_COUNT))
fi

# Check for console.log with sensitive data
echo "Checking for console.log statements (potential data exposure)..." | tee -a "$REPORT_FILE"
CONSOLE_LOG_MATCHES=$(grep -rn "console\.log.*password\|console\.log.*token\|console\.log.*secret" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$CONSOLE_LOG_MATCHES" ]; then
    echo "$CONSOLE_LOG_MATCHES" | tee -a "$REPORT_FILE"
    CONSOLE_LOG_COUNT=$(echo "$CONSOLE_LOG_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $CONSOLE_LOG_COUNT console.log statements with potential sensitive data"
    AUTH_COUNT=$((AUTH_COUNT + CONSOLE_LOG_COUNT))
fi

if [ $AUTH_COUNT -eq 0 ]; then
    log_finding "LOW" "No obvious authentication/authorization issues detected"
fi
echo "" | tee -a "$REPORT_FILE"

# 7. Insecure Cryptography
echo "=== 7. CRYPTOGRAPHY ISSUES ===" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

CRYPTO_COUNT=0

# Check for MD5 usage
echo "Checking for MD5 usage (insecure)..." | tee -a "$REPORT_FILE"
MD5_MATCHES=$(grep -rn "crypto.*md5\|createHash.*md5" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$MD5_MATCHES" ]; then
    echo "$MD5_MATCHES" | tee -a "$REPORT_FILE"
    MD5_COUNT=$(echo "$MD5_MATCHES" | wc -l)
    log_finding "HIGH" "Found $MD5_COUNT instances of MD5 usage (use SHA-256 or better)"
    CRYPTO_COUNT=$((CRYPTO_COUNT + MD5_COUNT))
fi

# Check for SHA1 usage
echo "Checking for SHA1 usage (weak)..." | tee -a "$REPORT_FILE"
SHA1_MATCHES=$(grep -rn "crypto.*sha1\|createHash.*sha1" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null || true)
if [ ! -z "$SHA1_MATCHES" ]; then
    echo "$SHA1_MATCHES" | tee -a "$REPORT_FILE"
    SHA1_COUNT=$(echo "$SHA1_MATCHES" | wc -l)
    log_finding "MEDIUM" "Found $SHA1_COUNT instances of SHA1 usage (consider upgrading to SHA-256)"
    CRYPTO_COUNT=$((CRYPTO_COUNT + SHA1_COUNT))
fi

if [ $CRYPTO_COUNT -eq 0 ]; then
    log_finding "LOW" "No insecure cryptography patterns detected"
fi
echo "" | tee -a "$REPORT_FILE"

# Summary
echo "" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "SCAN SUMMARY" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
TOTAL_ISSUES=$((SECRET_COUNT + SQL_INJECTION_COUNT + DANGEROUS_COUNT + XSS_COUNT + AUTH_COUNT + CRYPTO_COUNT))
echo "Total Issues Found: $TOTAL_ISSUES" | tee -a "$REPORT_FILE"
echo "  - Hardcoded Secrets: $SECRET_COUNT" | tee -a "$REPORT_FILE"
echo "  - SQL Injection Patterns: $SQL_INJECTION_COUNT" | tee -a "$REPORT_FILE"
echo "  - Dangerous Code Patterns: $DANGEROUS_COUNT" | tee -a "$REPORT_FILE"
echo "  - XSS Patterns: $XSS_COUNT" | tee -a "$REPORT_FILE"
echo "  - Auth Issues: $AUTH_COUNT" | tee -a "$REPORT_FILE"
echo "  - Crypto Issues: $CRYPTO_COUNT" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
echo "Full report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "NPM Audit JSON saved to: $REPORTS_DIR/npm-audit-$TIMESTAMP.json" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Return exit code based on critical issues
if [ $TOTAL_ISSUES -gt 0 ]; then
    echo -e "${YELLOW}⚠ Security issues detected. Please review the report.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Security scan completed successfully. No major issues found.${NC}"
    exit 0
fi
