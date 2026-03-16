#!/usr/bin/env bash
# ============================================
# ServiceDesk — Pre-Deployment Checklist
# ============================================
# Run before deploying to production.
# Usage: bash scripts/pre-deploy.sh
# ============================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

PASS=0
FAIL=0

step_pass() {
  echo -e "  ${GREEN}✓${RESET} $1"
  PASS=$((PASS + 1))
}

step_fail() {
  echo -e "  ${RED}✗${RESET} $1"
  FAIL=$((FAIL + 1))
}

echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   ServiceDesk — Pre-Deploy Checklist             ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# --- Step 1: TypeScript type checking ---
echo -e "${BOLD}${CYAN}[1/3] TypeScript type check${RESET}"
if npx tsc --noEmit 2>&1; then
  step_pass "TypeScript: no type errors"
else
  step_fail "TypeScript: type errors found"
fi

echo ""

# --- Step 2: Environment validation ---
echo -e "${BOLD}${CYAN}[2/3] Environment validation${RESET}"
if npx tsx scripts/validate-env.ts 2>&1; then
  step_pass "Environment variables validated"
else
  step_fail "Environment validation failed"
fi

echo ""

# --- Step 3: Production build ---
echo -e "${BOLD}${CYAN}[3/3] Production build${RESET}"
if npm run build 2>&1; then
  step_pass "Production build succeeded"
else
  step_fail "Production build failed"
fi

# --- Summary ---
echo ""
echo -e "${BOLD}─── Results ───${RESET}"
echo -e "  ${GREEN}${PASS} passed${RESET}, ${RED}${FAIL} failed${RESET}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n  ${RED}${BOLD}Pre-deploy: FAILED${RESET}"
  echo -e "  ${DIM}Fix the errors above before deploying.${RESET}"
  exit 1
else
  echo -e "\n  ${GREEN}${BOLD}Pre-deploy: PASSED — ready to deploy!${RESET}"
  exit 0
fi
