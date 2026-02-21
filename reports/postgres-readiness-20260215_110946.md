# PostgreSQL Readiness Audit

Generated at: 2026-02-15T11:09:46-03:00

## Summary
- Files importing `@/lib/db/connection`: 97
- Files importing `@/lib/auth/sqlite-auth`: 0
- Files with SQLite-specific symbols: 38

## SQLite-specific API routes


## Files importing @/lib/db/connection (first 120)

app/sitemap.xml/route.ts
lib/tenant/resolver.ts
lib/dashboard/template-engine.ts
lib/integrations/email/automation.ts
lib/integrations/email/parser.ts
lib/integrations/email/sender.ts
lib/integrations/email/templates.ts
lib/security/audit-logger.ts
lib/db/connection.ts
lib/security/storage-quota.ts
lib/db/README.md
lib/security/password-policy.ts
lib/security/session-manager.ts
lib/api/cache-warmer.ts
app/api/catalog/route.ts
app/api/catalog/requests/route.ts
app/api/files/[...path]/route.ts
app/api/admin/templates/route.ts
app/api/categories/[id]/route.ts
app/api/ai/train/route.ts
app/api/admin/tickets/route.ts
app/api/files/upload/route.ts
app/api/notifications/sse/route.ts
app/api/admin/stats/route.ts
app/api/admin/automations/route.ts
app/api/admin/super/tenants/route.ts
app/api/categories/route.ts
app/api/pwa/subscribe/route.ts
app/api/ai/models/route.ts
app/api/admin/super/stats/route.ts
app/api/notifications/unread/route.ts
app/api/ai/suggest-solutions/route.ts
app/api/admin/users/route.ts
app/api/pwa/sync/route.ts
app/api/priorities/route.ts
app/api/notifications/route.ts
app/api/admin/audit/route.ts
app/api/admin/sla/[id]/route.ts
app/api/ai/generate-response/route.ts
app/api/comments/route.ts
app/api/admin/governance/data/route.ts
app/api/push/subscribe/route.ts
app/api/analytics/knowledge/route.ts
app/api/attachments/route.ts
app/api/example-with-sentry/route.ts
app/api/ai/metrics/route.ts
app/api/push/send/route.ts
app/api/changes/[id]/route.ts
app/api/admin/governance/access/route.ts
app/api/agent/stats/route.ts
app/api/analytics/realtime/route.ts
app/api/agents/route.ts
app/api/push/unsubscribe/route.ts
app/api/templates/apply/route.ts
app/api/statuses/route.ts
app/api/analytics/overview/route.ts
app/api/changes/route.ts
app/api/analytics/detailed/route.ts
app/api/analytics/route.ts
app/api/analytics/cobit/route.ts
app/api/db-stats/route.ts
app/api/tags/[id]/route.ts
app/api/ai/classify-ticket/route.ts
app/api/ticket-types/[id]/route.ts
app/api/ai/analyze-sentiment/route.ts
app/api/ticket-types/route.ts
app/api/admin/governance/audit/route.ts
app/api/saas/onboarding/route.ts
app/api/ai/feedback/route.ts
app/api/admin/governance/compliance/route.ts
app/api/test-error/route.ts
app/api/tags/route.ts
app/api/email/queue/route.ts
app/api/ai/detect-duplicates/route.ts
app/api/workflows/executions/[id]/route.ts
app/api/sla/tickets/route.ts
app/api/cab/[id]/vote/route.ts
app/api/macros/[id]/route.ts
app/api/macros/route.ts
app/api/sla/route.ts
app/api/cmdb/[id]/relationships/route.ts
app/api/macros/[id]/apply/route.ts
app/api/cab/route.ts
app/api/integrations/email/templates/[id]/route.ts
app/api/cab/[id]/route.ts
app/api/teams/[id]/route.ts
app/api/portal/tickets/route.ts
app/api/cmdb/statuses/route.ts
app/api/workflows/definitions/[id]/route.ts
app/api/portal/tickets/[id]/route.ts
app/api/cmdb/[id]/route.ts
app/api/integrations/email/templates/route.ts
app/api/workflows/definitions/route.ts
app/api/teams/[id]/members/route.ts
app/api/cmdb/route.ts
app/api/teams/[id]/members/[userId]/route.ts
app/api/cmdb/types/route.ts

## Files importing @/lib/auth/sqlite-auth (first 120)

