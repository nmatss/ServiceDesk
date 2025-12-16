# Database Guide

Complete guide to the ServiceDesk database architecture.

## Schema Overview

ServiceDesk uses an 18-table database schema:

### Core Tables

- **users**: User accounts and authentication
- **tickets**: Support tickets
- **comments**: Ticket comments
- **attachments**: File attachments

### Authentication

- **refresh_tokens**: JWT refresh tokens
- **permissions**: Granular permissions
- **roles**: Role definitions
- **user_roles**: User-role mappings

### SLA Management

- **sla_policies**: SLA definitions
- **sla_tracking**: Ticket SLA tracking
- **escalations**: Automatic escalations

### Knowledge Base

- **knowledge_articles**: KB articles
- **kb_categories**: Article categories

### Audit & Analytics

- **audit_logs**: System audit trail
- **auth_audit_logs**: Authentication events
- **analytics_daily_metrics**: Daily stats
- **analytics_agent_metrics**: Agent performance

## Database Commands

### Initialize Database

```bash
npm run init-db
```

### Run Migrations

```bash
npm run migrate
npm run migrate:status
npm run migrate:rollback
```

### Seed Data

```bash
npm run db:seed
```

### Clear Data

```bash
npm run db:clear
```

## Connection

### Development (SQLite)

```typescript
import { getDatabase } from '@/lib/db/connection';
const db = getDatabase();
```

### Production (PostgreSQL)

```bash
DATABASE_URL=postgresql://user:pass@host/db
```

## Queries

Type-safe queries in `lib/db/queries.ts`:

```typescript
import { ticketQueries } from '@/lib/db';

// Get all tickets
const tickets = ticketQueries.getAll();

// Create ticket
const ticket = ticketQueries.create({
  title: 'Issue',
  description: 'Details',
  user_id: 1,
  category_id: 1,
  priority_id: 2,
  status_id: 1
});
```

## Migrations

Create new migration:

```bash
npm run migrate:create my_migration
```

See complete schema: `lib/db/schema.sql`
