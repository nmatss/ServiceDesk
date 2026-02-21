#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Readiness Audit
# Generates a lightweight report of SQLite coupling hotspots.
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

timestamp="$(date +"%Y%m%d_%H%M%S")"
report_path="reports/postgres-readiness-${timestamp}.md"

count_connection_imports="$( (rg -l "from '@/lib/db/connection'|from \"@/lib/db/connection\"" app lib --glob '!**/*.bak' --glob '!**/__tests__/**' || true) | wc -l | tr -d ' ' )"
count_sqlite_auth_imports="$( (rg -l "from '@/lib/auth/sqlite-auth'|from \"@/lib/auth/sqlite-auth\"" app lib --glob '!**/*.bak' --glob '!**/__tests__/**' || true) | wc -l | tr -d ' ' )"
count_sqlite_symbols="$( (rg -l "sqlite_master|better-sqlite3|from 'sqlite'|from \"sqlite\"|from 'sqlite3'|from \"sqlite3\"|servicedesk\\.db" app lib --glob '!**/*.bak' --glob '!**/__tests__/**' || true) | wc -l | tr -d ' ' )"

{
  echo "# PostgreSQL Readiness Audit"
  echo
  echo "Generated at: $(date -Iseconds)"
  echo
  echo "## Summary"
  echo "- Files importing \`@/lib/db/connection\`: ${count_connection_imports}"
  echo "- Files importing \`@/lib/auth/sqlite-auth\`: ${count_sqlite_auth_imports}"
  echo "- Files with SQLite-specific symbols: ${count_sqlite_symbols}"
  echo
  echo "## SQLite-specific API routes"
  echo
  rg -n "from 'sqlite'|from \"sqlite\"|from 'sqlite3'|from \"sqlite3\"|servicedesk\\.db" app/api --glob '!**/*.bak' -S || true
  echo
  echo "## Files importing @/lib/db/connection (first 120)"
  echo
  (rg -l "from '@/lib/db/connection'|from \"@/lib/db/connection\"" app lib --glob '!**/*.bak' --glob '!**/__tests__/**' || true) | head -n 120
  echo
  echo "## Files importing @/lib/auth/sqlite-auth (first 120)"
  echo
  (rg -l "from '@/lib/auth/sqlite-auth'|from \"@/lib/auth/sqlite-auth\"" app lib --glob '!**/*.bak' --glob '!**/__tests__/**' || true) | head -n 120
} > "$report_path"

echo "$report_path"
