#!/usr/bin/env python3
"""
Script to apply rate limiting to all API route files
"""

import os
import re
from pathlib import Path
from typing import Tuple

PROJECT_ROOT = Path("/home/nic20/ProjetosWeb/ServiceDesk")
API_DIR = PROJECT_ROOT / "app" / "api"

# Rate limit configuration mapping
RATE_LIMIT_MAP = {
    # Auth endpoints (CRITICAL)
    r'/api/auth/register': 'RATE_LIMITS.AUTH_REGISTER',
    r'/api/auth/login': 'RATE_LIMITS.AUTH_LOGIN',
    r'/api/auth/.*password': 'RATE_LIMITS.AUTH_FORGOT_PASSWORD',
    r'/api/auth/': 'RATE_LIMITS.AUTH_LOGIN',

    # AI endpoints (HIGH COST)
    r'/api/ai/': 'RATE_LIMITS.AI_CLASSIFY',

    # Email/Integration endpoints
    r'/api/integrations/email/send': 'RATE_LIMITS.EMAIL_SEND',
    r'/api/email/send': 'RATE_LIMITS.EMAIL_SEND',
    r'/api/integrations/whatsapp/send': 'RATE_LIMITS.WHATSAPP_SEND',
    r'/api/integrations/.*webhook': 'RATE_LIMITS.WEBHOOK',

    # Ticket mutations
    r'/api/tickets/.*create': 'RATE_LIMITS.TICKET_MUTATION',
    r'/api/tickets/.*comments': 'RATE_LIMITS.TICKET_COMMENT',
    r'/api/tickets/.*attachments': 'RATE_LIMITS.TICKET_ATTACHMENT',
    r'/api/tickets/': 'RATE_LIMITS.TICKET_MUTATION',
    r'/api/portal/tickets': 'RATE_LIMITS.TICKET_MUTATION',

    # Search/Knowledge
    r'/api/knowledge/.*search': 'RATE_LIMITS.KNOWLEDGE_SEARCH',
    r'/api/search/': 'RATE_LIMITS.SEARCH',

    # Workflows
    r'/api/workflows/execute': 'RATE_LIMITS.WORKFLOW_EXECUTE',
    r'/api/workflows/': 'RATE_LIMITS.WORKFLOW_MUTATION',

    # Analytics
    r'/api/analytics/': 'RATE_LIMITS.ANALYTICS',

    # Admin
    r'/api/admin/.*users': 'RATE_LIMITS.ADMIN_USER',
    r'/api/admin/': 'RATE_LIMITS.ADMIN_MUTATION',
}

def get_rate_limit_config(route_path: str) -> str:
    """Determine the appropriate rate limit config for a route"""
    for pattern, config in RATE_LIMIT_MAP.items():
        if re.search(pattern, route_path):
            return config
    return 'RATE_LIMITS.DEFAULT'

def apply_rate_limiting(file_path: Path) -> Tuple[bool, str]:
    """Apply rate limiting to a single route file"""
    try:
        content = file_path.read_text()

        # Skip if already has new rate limiting
        if "from '@/lib/rate-limit/redis-limiter'" in content:
            return False, "Already updated"

        # Determine route path
        route_path = str(file_path).replace(str(PROJECT_ROOT), '').replace('/app', '').replace('/route.ts', '')
        rate_limit_config = get_rate_limit_config(route_path)

        modified = False

        # Add import if not present
        if 'applyRateLimit' not in content:
            # Find last import
            import_pattern = r"^import .* from ['\"'].*['\"'];?\s*$"
            imports = list(re.finditer(import_pattern, content, re.MULTILINE))

            if imports:
                last_import = imports[-1]
                insert_pos = last_import.end()

                new_import = f"\nimport {{ applyRateLimit, RATE_LIMITS }} from '@/lib/rate-limit/redis-limiter';"
                content = content[:insert_pos] + new_import + content[insert_pos:]
                modified = True

        # Find export functions and add rate limiting
        function_pattern = r'(export async function (GET|POST|PUT|DELETE|PATCH)\s*\(\s*request:\s*NextRequest[^{]*\{)'

        def add_rate_limit(match):
            nonlocal modified
            function_def = match.group(1)

            # Check if rate limiting already exists
            next_200_chars = content[match.end():match.end() + 300]
            if 'applyRateLimit' in next_200_chars or 'rateLimitResponse' in next_200_chars:
                return function_def

            modified = True
            rate_limit_code = f"\n  // SECURITY: Rate limiting\n  const rateLimitResponse = await applyRateLimit(request, {rate_limit_config});\n  if (rateLimitResponse) return rateLimitResponse;\n"

            return function_def + rate_limit_code

        content = re.sub(function_pattern, add_rate_limit, content)

        if modified:
            # Create backup
            backup_path = file_path.with_suffix('.ts.bak')
            backup_path.write_text(file_path.read_text())

            # Write modified content
            file_path.write_text(content)
            return True, f"Updated ({rate_limit_config})"

        return False, "No changes needed"

    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    print("🔒 Applying rate limiting to all API routes...\n")

    # Find all route.ts files
    route_files = list(API_DIR.rglob("route.ts"))

    print(f"Found {len(route_files)} API route files\n")

    updated = 0
    skipped = 0
    errors = 0

    for file_path in sorted(route_files):
        success, message = apply_rate_limiting(file_path)

        relative_path = file_path.relative_to(PROJECT_ROOT)

        if success:
            print(f"✅ {relative_path}: {message}")
            updated += 1
        elif "Already updated" in message:
            print(f"⊘  {relative_path}: {message}")
            skipped += 1
        else:
            print(f"❌ {relative_path}: {message}")
            errors += 1

    print(f"\n📊 Summary:")
    print(f"✅ Updated: {updated} files")
    print(f"⊘  Skipped (already updated): {skipped} files")
    print(f"❌ Errors: {errors} files")
    print(f"📁 Total: {len(route_files)} files")

if __name__ == "__main__":
    main()
