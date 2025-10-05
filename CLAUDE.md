# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Database Management
```bash
npm run init-db      # Initialize SQLite database with schema and seed data
npm run test-db      # Test database connection
npm run db:seed      # Add seed data only (requires initialized database)
npm run db:clear     # Clear all data from database
```

## Database Architecture

This project uses a **custom SQLite-based database layer** with 18 interconnected tables. The database is the core of the application and understanding it is crucial.

### Key Database Files
- **Schema**: `lib/db/schema.sql` - Complete table definitions with triggers and indexes
- **Connection**: `lib/db/connection.ts` - SQLite database connection
- **Queries**: `lib/db/queries.ts` - Type-safe query functions for all entities
- **Initialization**: `lib/db/init.ts` - Database setup and seeding logic
- **Types**: `lib/types/database.ts` - TypeScript interfaces for all database entities

### Core Tables
- **users** - Admin/agent/user roles with bcrypt password hashing
- **tickets** - Support tickets with SLA tracking
- **categories, priorities, statuses** - Ticket classification
- **comments, attachments** - Ticket interactions
- **sla_policies, sla_tracking** - Automated SLA management with triggers
- **notifications** - Real-time notification system
- **kb_articles, kb_categories** - Knowledge base system
- **analytics_daily_metrics, analytics_agent_metrics** - Performance tracking

### Database Initialization
- Database file: `servicedesk.db` (created automatically)
- **Always run `npm run init-db` after fresh clone**
- Includes comprehensive seed data (users, tickets, categories, etc.)
- Uses database triggers for automatic timestamp updates and SLA tracking

## Authentication System

### Implementation
- **JWT-based authentication** in `lib/auth/sqlite-auth.ts`
- **Middleware protection** in `middleware.ts` - handles route protection and role verification
- **Password hashing** using bcrypt
- **Role-based access**: admin, agent, user

### Protected Routes
- Admin routes: `/admin/*`
- Auth routes: `/api/auth/*` (login, register, verify, profile)
- Tenant routes: Various API endpoints require specific roles

## Application Architecture

### Framework & Stack
- **Next.js 15** with App Router
- **TypeScript** with strict mode and path mapping (`@/*` aliases)
- **Tailwind CSS** with custom ServiceDesk theme (priority colors, status colors, animations)
- **SQLite** for development (migration-ready for PostgreSQL/Neon)
- **Socket.io** for real-time notifications

### Directory Structure
```
app/
├── api/               # API routes (auth, notifications, protected)
├── auth/              # Authentication pages (login, register)
├── tickets/           # Ticket management pages
├── admin/             # Admin interface
└── layout.tsx         # Root layout with AppLayout component

lib/
├── db/                # Database layer (queries, schema, connection)
├── auth/              # Authentication utilities
├── notifications/     # Real-time notification system
├── workflow/          # Workflow management
├── automations/       # Automation engine
├── monitoring/        # Logging and monitoring
├── validation/        # Zod schemas
└── types/             # TypeScript type definitions
```

### Key Patterns
- **Custom ORM**: Hand-built query functions in `lib/db/queries.ts` with full TypeScript support
- **Middleware-first auth**: All routes protected via `middleware.ts`
- **Type safety**: Comprehensive TypeScript interfaces for database entities
- **Real-time updates**: Socket.io integration for live notifications
- **Automated SLA**: Database triggers automatically track SLA compliance

## Frontend Components

### Styling System
- **Custom Tailwind theme** with ServiceDesk branding
- **Priority colors**: low (green), medium (yellow), high (orange), critical (red)
- **Status colors**: open (blue), in-progress (yellow), resolved (green), closed (gray)
- **Custom animations**: fade-in, slide-up, pulse-soft, etc.
- **Dark mode** support via class-based toggling

### UI Components
- **Headless UI** for accessible components (Dialog, Menu, etc.)
- **Heroicons** for consistent iconography
- **React Hot Toast** for notifications
- **React Quill** for rich text editing
- **Recharts** for analytics visualization

## Real-time Features

### Socket.io Integration
- **User sessions** tracked in `user_sessions` table
- **Live notifications** via `notification_events` table
- **Real-time ticket updates** broadcast to relevant users
- **SLA warnings** pushed automatically when deadlines approach

### Automation System
- **Trigger-based automations** in `automations` table
- **SLA tracking** with automatic escalation
- **Email notifications** (Nodemailer integration)
- **Audit logging** for all user actions

## Development Notes

### Configuration
- **Standalone build** configured in `next.config.js`
- **CSP headers** for security (fonts, styles)
- **TypeScript strict mode** with comprehensive type checking
- **ESLint** with Next.js configuration

### Migration Readiness
- Schema designed for **PostgreSQL compatibility**
- Database configuration centralized in `lib/db/config.ts`
- Ready for **Neon PostgreSQL** migration with environment variable switching

### Missing Testing Framework
- No test setup currently implemented
- Consider adding Jest or Vitest for future development
- Database queries are prime candidates for unit testing

## Common Development Tasks

### Adding New Ticket Features
1. Update database schema in `schema.sql`
2. Add TypeScript types in `lib/types/database.ts`
3. Create query functions in `lib/db/queries.ts`
4. Implement API routes in `app/api/`
5. Build frontend components

### Modifying SLA Rules
- Edit `sla_policies` table structure
- Update database triggers in `schema.sql`
- Modify SLA tracking logic in relevant API routes

### Adding New User Roles
- Update role enum in database schema
- Modify middleware route protection logic
- Update TypeScript types and query functions