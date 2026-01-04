#!/bin/bash

# Script to apply rate limiting to all API routes
# This uses sed to insert rate limiting code into route files

PROJECT_ROOT="/home/nic20/ProjetosWeb/ServiceDesk"
cd "$PROJECT_ROOT"

echo "🔒 Applying rate limiting to all API routes..."
echo ""

updated=0
skipped=0

# Function to apply rate limiting to a file
apply_rate_limiting() {
    local file=$1
    local route_path=$(echo "$file" | sed "s|$PROJECT_ROOT/app||" | sed 's|/route.ts||')

    # Skip if already has new rate limiting
    if grep -q "from '@/lib/rate-limit/redis-limiter'" "$file"; then
        echo "✓ Already updated: $file"
        ((skipped++))
        return
    fi

    # Determine rate limit config based on route
    local rate_limit_config="RATE_LIMITS.DEFAULT"

    if [[ "$route_path" == *"/auth/register"* ]]; then
        rate_limit_config="RATE_LIMITS.AUTH_REGISTER"
    elif [[ "$route_path" == *"/auth/login"* ]]; then
        rate_limit_config="RATE_LIMITS.AUTH_LOGIN"
    elif [[ "$route_path" == *"/auth/"*"password"* ]]; then
        rate_limit_config="RATE_LIMITS.AUTH_FORGOT_PASSWORD"
    elif [[ "$route_path" == *"/ai/"* ]]; then
        rate_limit_config="RATE_LIMITS.AI_CLASSIFY"
    elif [[ "$route_path" == *"/integrations/email/send"* ]]; then
        rate_limit_config="RATE_LIMITS.EMAIL_SEND"
    elif [[ "$route_path" == *"/integrations/whatsapp/send"* ]]; then
        rate_limit_config="RATE_LIMITS.WHATSAPP_SEND"
    elif [[ "$route_path" == *"/integrations/"*"webhook"* ]]; then
        rate_limit_config="RATE_LIMITS.WEBHOOK"
    elif [[ "$route_path" == *"/tickets/"*"comment"* ]]; then
        rate_limit_config="RATE_LIMITS.TICKET_COMMENT"
    elif [[ "$route_path" == *"/tickets/"*"attachment"* ]]; then
        rate_limit_config="RATE_LIMITS.TICKET_ATTACHMENT"
    elif [[ "$route_path" == *"/tickets/"* ]]; then
        rate_limit_config="RATE_LIMITS.TICKET_MUTATION"
    elif [[ "$route_path" == *"/knowledge/"*"search"* ]] || [[ "$route_path" == *"/search/"* ]]; then
        rate_limit_config="RATE_LIMITS.SEARCH"
    elif [[ "$route_path" == *"/workflows/execute"* ]]; then
        rate_limit_config="RATE_LIMITS.WORKFLOW_EXECUTE"
    elif [[ "$route_path" == *"/workflows/"* ]]; then
        rate_limit_config="RATE_LIMITS.WORKFLOW_MUTATION"
    elif [[ "$route_path" == *"/analytics/"* ]]; then
        rate_limit_config="RATE_LIMITS.ANALYTICS"
    elif [[ "$route_path" == *"/admin/"*"user"* ]]; then
        rate_limit_config="RATE_LIMITS.ADMIN_USER"
    elif [[ "$route_path" == *"/admin/"* ]]; then
        rate_limit_config="RATE_LIMITS.ADMIN_MUTATION"
    fi

    # Create backup
    cp "$file" "${file}.bak"

    # Add import if not present (after last import line)
    if ! grep -q "applyRateLimit" "$file"; then
        # Find line number of last import
        last_import_line=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)

        if [ -n "$last_import_line" ]; then
            # Insert import after last import
            sed -i "${last_import_line}a import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';" "$file"
        fi
    fi

    # Add rate limiting check after function declaration
    # Look for patterns like: export async function POST(request: NextRequest) {
    if grep -q "export async function \(GET\|POST\|PUT\|DELETE\|PATCH\)" "$file"; then
        # Use a temp file to process
        temp_file=$(mktemp)

        awk -v config="$rate_limit_config" '
        /export async function (GET|POST|PUT|DELETE|PATCH).*NextRequest/ {
            in_function = 1
            print $0
            next
        }
        in_function && /^[[:space:]]*{[[:space:]]*$/ {
            print $0
            if (!added_rate_limit) {
                print "  // SECURITY: Rate limiting"
                print "  const rateLimitResponse = await applyRateLimit(request, " config ");"
                print "  if (rateLimitResponse) return rateLimitResponse;"
                print ""
                added_rate_limit = 1
            }
            in_function = 0
            next
        }
        { print }
        ' "$file" > "$temp_file"

        mv "$temp_file" "$file"
    fi

    echo "✅ Updated: $file (${rate_limit_config})"
    ((updated++))
}

# Find all route.ts files and process them
while IFS= read -r file; do
    apply_rate_limiting "$file"
done < <(find "$PROJECT_ROOT/app/api" -name "route.ts" -type f)

echo ""
echo "📊 Summary:"
echo "✅ Updated: $updated files"
echo "⊘ Skipped: $skipped files"
echo "📁 Total processed: $((updated + skipped)) files"
