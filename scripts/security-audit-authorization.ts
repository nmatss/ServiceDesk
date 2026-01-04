#!/usr/bin/env ts-node
/**
 * AUTHORIZATION SECURITY AUDIT SCRIPT
 *
 * Analyzes codebase for authorization and privilege escalation vulnerabilities
 *
 * Usage: npx ts-node scripts/security-audit-authorization.ts
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  file: string;
  line: number;
  code: string;
  issue: string;
  recommendation: string;
}

const findings: Finding[] = [];

// Patterns to detect vulnerabilities
const VULNERABILITY_PATTERNS = {
  // Missing organization_id filter
  missingTenantFilter: {
    pattern: /SELECT.*FROM (users|tickets|notifications|categories|priorities|statuses|comments|attachments)(?!.*organization_id|.*tenant_id)/gi,
    severity: 'CRITICAL' as const,
    category: 'Multi-Tenant Isolation',
    issue: 'Query without tenant/organization_id filter - allows cross-tenant data access',
    recommendation: 'Add "WHERE organization_id = ?" or "AND organization_id = ?" to all queries'
  },

  // Direct role assignment without validation
  unsafeRoleAssignment: {
    pattern: /role\s*=\s*req(uest)?\.body\.role|role\s*:\s*req(uest)?\.body\.role/gi,
    severity: 'CRITICAL' as const,
    category: 'Vertical Privilege Escalation',
    issue: 'Role assignment from user input without validation',
    recommendation: 'Never allow users to set their own role. Validate role changes against current user permissions.'
  },

  // Missing role check before admin operations
  missingAdminCheck: {
    pattern: /(UPDATE|DELETE|INSERT)\s+users.*SET.*role|UPDATE.*SET.*role\s*=\s*'admin'/gi,
    severity: 'CRITICAL' as const,
    category: 'Vertical Privilege Escalation',
    issue: 'User/role modification without admin verification',
    recommendation: 'Check if current user is admin before allowing role modifications'
  },

  // Authorization bypass - accessing data without user check
  missingOwnershipCheck: {
    pattern: /SELECT.*FROM tickets WHERE id\s*=\s*\?(?!.*user_id|.*assigned_to)/gi,
    severity: 'HIGH' as const,
    category: 'Horizontal Privilege Escalation',
    issue: 'Ticket access without ownership verification',
    recommendation: 'Add "AND (user_id = ? OR assigned_to = ?)" to verify user can access ticket'
  },

  // Weak authorization middleware
  weakMiddleware: {
    pattern: /if\s*\(.*role\s*===\s*'admin'\s*\)\s*{[^}]*return/gi,
    severity: 'MEDIUM' as const,
    category: 'RBAC',
    issue: 'Hardcoded role check instead of using proper RBAC',
    recommendation: 'Use middleware.checkAdminAccess() or proper permission system'
  },

  // JWT without tenant validation
  jwtWithoutTenant: {
    pattern: /jwtVerify\([^)]+\)(?!.*organization_id|.*tenant)/gi,
    severity: 'CRITICAL' as const,
    category: 'Multi-Tenant Isolation',
    issue: 'JWT verification without tenant validation',
    recommendation: 'Always validate that JWT organization_id matches requested tenant'
  },

  // Organization ID from user input
  unsafeOrgId: {
    pattern: /organization_id\s*[=:]\s*req(uest)?\.body\.organization_id|tenant_id\s*[=:]\s*req(uest)?\.body\.tenant_id/gi,
    severity: 'CRITICAL' as const,
    category: 'Multi-Tenant Isolation',
    issue: 'Organization/Tenant ID taken from user input',
    recommendation: 'Always use organization_id from authenticated JWT token, never from request body'
  },

  // Missing CSRF protection
  missingCSRF: {
    pattern: /export async function (POST|PUT|PATCH|DELETE)(?!.*csrf|.*validateCSRFToken)/gi,
    severity: 'HIGH' as const,
    category: 'Session Security',
    issue: 'State-changing endpoint without CSRF protection',
    recommendation: 'Validate CSRF token for all POST/PUT/PATCH/DELETE requests'
  },

  // User ID from params without validation
  unsafeUserId: {
    pattern: /params\.id\s*\)(?!.*organization_id|.*tenant_id|.*user_id)/gi,
    severity: 'HIGH' as const,
    category: 'Horizontal Privilege Escalation',
    issue: 'Using user ID from URL params without tenant/ownership validation',
    recommendation: 'Validate that ID belongs to current tenant and user has permission'
  }
};

async function analyzeFile(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const [key, config] of Object.entries(VULNERABILITY_PATTERNS)) {
    const matches = content.matchAll(config.pattern);

    for (const match of matches) {
      if (!match.index) continue;

      // Calculate line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      findings.push({
        severity: config.severity,
        category: config.category,
        file: filePath,
        line: lineNumber,
        code: lines[lineNumber - 1]?.trim() || '',
        issue: config.issue,
        recommendation: config.recommendation
      });
    }
  }
}

async function analyzeMiddleware(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if middleware validates tenant in JWT
  if (!content.includes('organization_id') && !content.includes('tenant')) {
    findings.push({
      severity: 'CRITICAL',
      category: 'Multi-Tenant Isolation',
      file: filePath,
      line: 1,
      code: 'middleware.ts',
      issue: 'Middleware does not validate tenant isolation in JWT',
      recommendation: 'Add validation: payload.organization_id === tenant.id'
    });
  }

  // Check admin role validation
  const adminCheckPattern = /checkAdminAccess|requiresAdminAccess/;
  if (!adminCheckPattern.test(content)) {
    findings.push({
      severity: 'HIGH',
      category: 'RBAC',
      file: filePath,
      line: 1,
      code: 'middleware.ts',
      issue: 'Middleware missing centralized admin access check',
      recommendation: 'Implement checkAdminAccess() function in middleware'
    });
  }
}

async function analyzeQueries(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if all user queries have organization_id filter
  const userQueryPattern = /SELECT.*FROM users/gi;
  const matches = content.matchAll(userQueryPattern);

  for (const match of matches) {
    if (!match.index) continue;

    // Get surrounding context
    const start = Math.max(0, match.index - 200);
    const end = Math.min(content.length, match.index + 200);
    const context = content.substring(start, end);

    // Check if organization_id is in the query
    if (!context.includes('organization_id') && !context.includes('tenant_id')) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      findings.push({
        severity: 'CRITICAL',
        category: 'Multi-Tenant Isolation',
        file: filePath,
        line: lineNumber,
        code: match[0],
        issue: 'User query without organization_id filter',
        recommendation: 'Add "WHERE organization_id = ?" to isolate tenants'
      });
    }
  }
}

async function analyzeAPIRoutes(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if route validates user role
  const isAdminRoute = filePath.includes('/api/admin/');

  if (isAdminRoute) {
    // Admin routes should check role
    const hasRoleCheck = /role\s*===\s*['"]admin['"]|checkAdminAccess|requiresAdminAccess/.test(content);

    if (!hasRoleCheck) {
      findings.push({
        severity: 'CRITICAL',
        category: 'Vertical Privilege Escalation',
        file: filePath,
        line: 1,
        code: filePath,
        issue: 'Admin route without role verification',
        recommendation: 'Add role check: if (user.role !== "admin") return 403'
      });
    }
  }

  // Check tenant context usage
  if (!content.includes('getTenantContextFromRequest') && !content.includes('organization_id')) {
    findings.push({
      severity: 'HIGH',
      category: 'Multi-Tenant Isolation',
      file: filePath,
      line: 1,
      code: filePath,
      issue: 'API route not using tenant context',
      recommendation: 'Use getTenantContextFromRequest() to ensure tenant isolation'
    });
  }

  // Check if PUT/PATCH/DELETE verify ownership
  const stateChangingMethods = /export async function (PUT|PATCH|DELETE)/g;
  if (stateChangingMethods.test(content)) {
    const hasOwnershipCheck = /user_id\s*===|assigned_to\s*===|verifyOwnership/.test(content);

    if (!hasOwnershipCheck && !isAdminRoute) {
      findings.push({
        severity: 'HIGH',
        category: 'Horizontal Privilege Escalation',
        file: filePath,
        line: 1,
        code: filePath,
        issue: 'State-changing route without ownership verification',
        recommendation: 'Verify user owns the resource before allowing modifications'
      });
    }
  }
}

async function main() {
  console.log('🔍 Starting Authorization Security Audit...\n');

  // Analyze middleware
  const middlewarePath = path.join(process.cwd(), 'middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    console.log('Analyzing middleware...');
    await analyzeMiddleware(middlewarePath);
  }

  // Analyze database queries
  const queriesPath = path.join(process.cwd(), 'lib/db/queries.ts');
  if (fs.existsSync(queriesPath)) {
    console.log('Analyzing database queries...');
    await analyzeQueries(queriesPath);
  }

  // Analyze API routes
  console.log('Analyzing API routes...');
  const apiRoutes = await glob('app/api/**/*.ts', { cwd: process.cwd() });

  for (const route of apiRoutes) {
    const fullPath = path.join(process.cwd(), route);
    await analyzeFile(fullPath);
    await analyzeAPIRoutes(fullPath);
  }

  // Analyze auth files
  console.log('Analyzing authentication files...');
  const authFiles = await glob('lib/auth/**/*.ts', { cwd: process.cwd() });

  for (const file of authFiles) {
    const fullPath = path.join(process.cwd(), file);
    await analyzeFile(fullPath);
  }

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('AUTHORIZATION SECURITY AUDIT REPORT');
  console.log('='.repeat(80) + '\n');

  const bySeverity = {
    CRITICAL: findings.filter(f => f.severity === 'CRITICAL'),
    HIGH: findings.filter(f => f.severity === 'HIGH'),
    MEDIUM: findings.filter(f => f.severity === 'MEDIUM'),
    LOW: findings.filter(f => f.severity === 'LOW'),
    INFO: findings.filter(f => f.severity === 'INFO')
  };

  console.log('📊 SUMMARY:');
  console.log(`  🔴 CRITICAL: ${bySeverity.CRITICAL.length}`);
  console.log(`  🟠 HIGH:     ${bySeverity.HIGH.length}`);
  console.log(`  🟡 MEDIUM:   ${bySeverity.MEDIUM.length}`);
  console.log(`  🟢 LOW:      ${bySeverity.LOW.length}`);
  console.log(`  ℹ️  INFO:     ${bySeverity.INFO.length}`);
  console.log(`  📝 TOTAL:    ${findings.length}\n`);

  // Group by category
  const byCategory: Record<string, Finding[]> = {};
  findings.forEach(f => {
    if (!byCategory[f.category]) {
      byCategory[f.category] = [];
    }
    byCategory[f.category].push(f);
  });

  console.log('📋 BY CATEGORY:');
  Object.entries(byCategory).forEach(([category, items]) => {
    console.log(`  ${category}: ${items.length}`);
  });
  console.log('');

  // Print detailed findings
  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`${severity} FINDINGS (${items.length})`);
    console.log('='.repeat(80));

    items.forEach((finding, index) => {
      console.log(`\n${index + 1}. ${finding.category}`);
      console.log(`   File: ${finding.file}:${finding.line}`);
      console.log(`   Code: ${finding.code}`);
      console.log(`   Issue: ${finding.issue}`);
      console.log(`   Fix: ${finding.recommendation}`);
    });
  }

  // Critical vulnerabilities - detailed report
  if (bySeverity.CRITICAL.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🚨 CRITICAL VULNERABILITIES REQUIRING IMMEDIATE ATTENTION');
    console.log('='.repeat(80));

    const criticalByCategory: Record<string, Finding[]> = {};
    bySeverity.CRITICAL.forEach(f => {
      if (!criticalByCategory[f.category]) {
        criticalByCategory[f.category] = [];
      }
      criticalByCategory[f.category].push(f);
    });

    Object.entries(criticalByCategory).forEach(([category, items]) => {
      console.log(`\n📌 ${category} (${items.length} issues)`);
      items.forEach((finding, i) => {
        console.log(`   ${i + 1}. ${finding.file}:${finding.line}`);
      });
    });
  }

  // Save report to file
  const reportPath = path.join(process.cwd(), 'AUTHORIZATION_SECURITY_AUDIT.md');
  const reportContent = generateMarkdownReport(bySeverity, byCategory);
  fs.writeFileSync(reportPath, reportContent);

  console.log(`\n✅ Report saved to: ${reportPath}`);
  console.log(`\n🔍 Audit complete. Found ${findings.length} potential issues.`);

  // Exit with error code if critical findings
  process.exit(bySeverity.CRITICAL.length > 0 ? 1 : 0);
}

function generateMarkdownReport(
  bySeverity: Record<string, Finding[]>,
  byCategory: Record<string, Finding[]>
): string {
  let md = '# Authorization Security Audit Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;

  md += '## Executive Summary\n\n';
  md += '| Severity | Count |\n';
  md += '|----------|-------|\n';
  Object.entries(bySeverity).forEach(([severity, items]) => {
    md += `| ${severity} | ${items.length} |\n`;
  });
  md += '\n';

  md += '## Findings by Category\n\n';
  Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, items]) => {
      md += `### ${category} (${items.length})\n\n`;

      items.forEach((finding, i) => {
        md += `#### ${i + 1}. ${finding.severity}: ${finding.issue}\n\n`;
        md += `**File:** \`${finding.file}:${finding.line}\`\n\n`;
        md += `**Code:**\n\`\`\`typescript\n${finding.code}\n\`\`\`\n\n`;
        md += `**Recommendation:** ${finding.recommendation}\n\n`;
        md += '---\n\n';
      });
    });

  md += '## Remediation Priority\n\n';
  md += '1. **CRITICAL** - Fix immediately (< 24 hours)\n';
  md += '2. **HIGH** - Fix within 1 week\n';
  md += '3. **MEDIUM** - Fix within 1 month\n';
  md += '4. **LOW** - Fix in next release\n';
  md += '5. **INFO** - Consider for future improvements\n';

  return md;
}

main().catch(console.error);
