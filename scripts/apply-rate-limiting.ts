#!/usr/bin/env ts-node
/**
 * Script to automatically apply rate limiting to all API routes
 * This script adds rate limiting imports and checks to API endpoints
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Rate limit configuration mapping
const RATE_LIMIT_CONFIG_MAP: Record<string, string> = {
  // Auth endpoints (CRITICAL)
  '/api/auth/register': 'RATE_LIMITS.AUTH_REGISTER',
  '/api/auth/login': 'RATE_LIMITS.AUTH_LOGIN',
  '/api/auth/login-v2': 'RATE_LIMITS.AUTH_LOGIN',
  '/api/auth/change-password': 'RATE_LIMITS.AUTH_FORGOT_PASSWORD',
  '/api/auth/': 'RATE_LIMITS.AUTH_LOGIN', // Default for auth

  // AI endpoints (HIGH COST)
  '/api/ai/classify': 'RATE_LIMITS.AI_CLASSIFY',
  '/api/ai/semantic': 'RATE_LIMITS.AI_SEMANTIC',
  '/api/ai/suggest': 'RATE_LIMITS.AI_SUGGEST',
  '/api/ai/': 'RATE_LIMITS.AI_CLASSIFY', // Default for AI

  // Email/Integration endpoints
  '/api/integrations/email/send': 'RATE_LIMITS.EMAIL_SEND',
  '/api/integrations/whatsapp/send': 'RATE_LIMITS.WHATSAPP_SEND',
  '/api/integrations/whatsapp/webhook': 'RATE_LIMITS.WEBHOOK',
  '/api/integrations/email/webhook': 'RATE_LIMITS.WEBHOOK',

  // Ticket mutations
  '/api/tickets/create': 'RATE_LIMITS.TICKET_MUTATION',
  '/api/tickets/[id]/comments': 'RATE_LIMITS.TICKET_COMMENT',
  '/api/tickets/[id]/attachments': 'RATE_LIMITS.TICKET_ATTACHMENT',
  '/api/tickets/': 'RATE_LIMITS.TICKET_MUTATION', // Default for tickets

  // Search/Knowledge
  '/api/knowledge/search': 'RATE_LIMITS.KNOWLEDGE_SEARCH',
  '/api/knowledge/semantic-search': 'RATE_LIMITS.KNOWLEDGE_SEARCH',
  '/api/search/': 'RATE_LIMITS.SEARCH',

  // Workflows
  '/api/workflows/execute': 'RATE_LIMITS.WORKFLOW_EXECUTE',
  '/api/workflows/': 'RATE_LIMITS.WORKFLOW_MUTATION',

  // Analytics
  '/api/analytics/': 'RATE_LIMITS.ANALYTICS',

  // Admin
  '/api/admin/users': 'RATE_LIMITS.ADMIN_USER',
  '/api/admin/': 'RATE_LIMITS.ADMIN_MUTATION',
};

function getRateLimitConfig(routePath: string): string {
  // Try exact match first
  for (const [pattern, config] of Object.entries(RATE_LIMIT_CONFIG_MAP)) {
    if (routePath.includes(pattern)) {
      return config;
    }
  }

  // Default
  return 'RATE_LIMITS.DEFAULT';
}

function addRateLimitingToFile(filePath: string): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Skip if already has new rate limiting
    if (content.includes('from \'@/lib/rate-limit/redis-limiter\'')) {
      console.log(`✓ Already updated: ${filePath}`);
      return false;
    }

    // Determine route path
    const routePath = filePath.replace(process.cwd(), '').replace('/app', '').replace('/route.ts', '');
    const rateLimitConfig = getRateLimitConfig(routePath);

    // Add import if not present
    if (!content.includes('applyRateLimit')) {
      // Find last import statement
      const importRegex = /^import .* from ['"].*['"];?$/gm;
      const imports = content.match(importRegex) || [];

      if (imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;

        // Add import
        const newImport = `\nimport { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';`;
        content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
      }
    }

    // Find export function (GET, POST, PUT, DELETE, PATCH)
    const functionRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(\s*request:\s*NextRequest/g;
    let match;
    let modified = false;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionStart = match.index;
      const functionName = match[1];

      // Find the opening brace
      const braceIndex = content.indexOf('{', functionStart);
      if (braceIndex === -1) continue;

      // Check if rate limiting already exists right after the brace
      const nextLines = content.slice(braceIndex, braceIndex + 300);
      if (nextLines.includes('applyRateLimit') || nextLines.includes('rateLimitResponse')) {
        continue;
      }

      // Insert rate limiting check
      const rateLimitCode = `\n  // SECURITY: Rate limiting\n  const rateLimitResponse = await applyRateLimit(request, ${rateLimitConfig});\n  if (rateLimitResponse) return rateLimitResponse;\n`;

      // Insert after opening brace
      content = content.slice(0, braceIndex + 1) + rateLimitCode + content.slice(braceIndex + 1);
      modified = true;

      console.log(`✓ Added rate limiting to ${functionName} in ${filePath}`);
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error);
    return false;
  }
}

async function main() {
  console.log('🔒 Starting rate limiting application...\n');

  // Find all route files
  const routeFiles = await glob('app/api/**/route.ts', {
    cwd: process.cwd(),
    absolute: true,
  });

  console.log(`Found ${routeFiles.length} API route files\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of routeFiles) {
    const result = addRateLimitingToFile(file);
    if (result === true) {
      updated++;
    } else if (result === false) {
      skipped++;
    } else {
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✓ Updated: ${updated} files`);
  console.log(`⊘ Skipped (already updated): ${skipped} files`);
  console.log(`✗ Failed: ${failed} files`);
  console.log(`📁 Total: ${routeFiles.length} files`);
}

main().catch(console.error);
