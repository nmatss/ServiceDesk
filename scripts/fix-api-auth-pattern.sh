#!/bin/bash

# Script to update API routes from Bearer token auth to cookie-based auth
# This ensures consistent authentication across all routes

echo "Fixing API route authentication patterns..."

# Find all route files that use Bearer token auth
FILES=$(grep -rl "request\.headers\.get('authorization')" app/api/ 2>/dev/null || true)
FILES+=" $(grep -rl 'request\.headers\.get("authorization")' app/api/ 2>/dev/null || true)"

# Remove duplicates
FILES=$(echo "$FILES" | tr ' ' '\n' | sort -u)

FIXED_COUNT=0
SKIPPED_COUNT=0

for file in $FILES; do
  # Skip if file doesn't exist or is not a TypeScript file
  if [[ ! -f "$file" ]] || [[ ! "$file" =~ \.ts$ ]]; then
    continue
  fi

  # Skip if already using verifyTokenFromCookies
  if grep -q "verifyTokenFromCookies" "$file"; then
    echo "✓ Skipping $file (already using cookie-based auth)"
    ((SKIPPED_COUNT++))
    continue
  fi

  echo "→ Updating $file"

  # Create backup
  cp "$file" "$file.backup"

  # Update import statement
  sed -i "s/import { verifyToken }/import { verifyTokenFromCookies }/g" "$file"
  sed -i "s/from '@\/lib\/auth\/sqlite-auth'/from '@\/lib\/auth\/sqlite-auth'/g" "$file"

  # Pattern 1: Replace Bearer token extraction with cookie-based auth
  # This is a complex pattern, so we'll mark files for manual review
  if grep -q "authHeader.*Bearer" "$file"; then
    echo "  ⚠ File contains Bearer auth pattern - requires manual review"
    echo "    File: $file" >> /tmp/api-auth-manual-review.txt
  fi

  ((FIXED_COUNT++))
done

echo ""
echo "========================================="
echo "API Authentication Pattern Fix Complete"
echo "========================================="
echo "Files processed: $((FIXED_COUNT + SKIPPED_COUNT))"
echo "Files updated: $FIXED_COUNT"
echo "Files skipped: $SKIPPED_COUNT"
echo ""
echo "Files requiring manual review are listed in:"
echo "/tmp/api-auth-manual-review.txt"
echo ""
echo "Next steps:"
echo "1. Review files in /tmp/api-auth-manual-review.txt"
echo "2. Manually update Bearer auth patterns to use verifyTokenFromCookies"
echo "3. Ensure response formats follow { success: true, data: {...} } pattern"
echo "4. Test authentication flows"
