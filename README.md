# ServiceDesk - Enterprise Help Desk & Ticket Management System

[![CI Pipeline](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/ci.yml)
[![Security Scanning](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/security.yml/badge.svg)](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/security.yml)
[![Deploy Staging](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/deploy-staging.yml)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/ServiceDesk/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/ServiceDesk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A modern, production-ready help desk and ticket management system built with Next.js 15, TypeScript, and enterprise-grade features including multi-tenancy, advanced security, real-time notifications, and comprehensive monitoring.

## Features

### Core Ticket Management
- Create, track, and manage support tickets with full lifecycle management
- Advanced categorization with customizable categories and priorities
- SLA policies with automatic tracking and breach detection
- Rich text editor for ticket descriptions and comments
- File attachments with multi-cloud storage support (S3, GCS, Azure)
- Smart ticket assignment and workload distribution
- Ticket templates for common issues

### User & Access Management
- Role-based access control (RBAC) with granular permissions
- Multi-factor authentication (2FA/TOTP, WebAuthn/FIDO2)
- Single Sign-On (SSO) with OAuth2, SAML, LDAP, Gov.br
- Password policies with complexity requirements and expiration
- Account lockout protection with rate limiting
- Audit logging for compliance (LGPD/GDPR compliant)

### Real-time Features
- Live notifications via WebSockets
- Real-time ticket updates across users
- SLA deadline warnings and alerts
- Push notifications (Web Push API)
- Email notifications with customizable templates

### Knowledge Base
- Searchable knowledge base with full-text search
- Article version control and approval workflow
- Article ratings and feedback
- AI-powered duplicate detection
- Markdown support with syntax highlighting

### Analytics & Reporting
- Real-time dashboards with Recharts
- Agent performance metrics
- Ticket trend analysis
- SLA compliance reports
- Customer satisfaction surveys (CSAT)
- Exportable reports (CSV, PDF)

### Automation & Workflows
- Automated ticket routing and assignment
- Custom automation rules with condition builders
- Email notifications and webhooks
- Escalation workflows
- Scheduled tasks and reminders

### Multi-tenancy
- Full organization isolation
- Tenant-specific branding and configuration
- Subdomain routing support
- Per-tenant resource quotas
- Centralized tenant management

### Integrations
- **Government SSO**: Gov.br integration for Brazilian public sector
- **Communication**: WhatsApp Business API for ticket creation
- **External Services**: Slack, Discord, Jira, Zendesk
- **Email**: SMTP, SendGrid, Mailgun, AWS SES
- **AI**: OpenAI integration for classification and sentiment analysis
- **Search**: Elasticsearch for advanced search capabilities

### Enterprise Security
- JWT-based authentication with refresh tokens
- HTTPS-only with strict CSP headers
- SQL injection protection with prepared statements
- XSS protection with input sanitization
- CSRF protection
- Rate limiting on all endpoints
- Security headers (Helmet.js)
- Secrets encryption at rest
- Regular security scanning (Snyk, Trivy, CodeQL)

### Monitoring & Observability
- **APM**: Datadog integration for distributed tracing
- **Error Tracking**: Sentry with source maps
- **Metrics**: Prometheus with custom metrics
- **Visualization**: Grafana dashboards
- **Logging**: Structured logging with Pino
- **Health Checks**: Kubernetes-ready health endpoints

### Performance
- Redis caching with LRU eviction
- Database query optimization with indexes
- CDN support for static assets
- Image optimization with Sharp
- Code splitting and lazy loading
- Service workers for offline support
- Progressive Web App (PWA) features

### Accessibility
- WCAG 2.1 Level AA compliant
- Screen reader support with ARIA labels
- Keyboard navigation
- High contrast mode
- Focus management
- Automated accessibility testing

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3 with custom design system
- **UI Components**: Headless UI, Radix UI
- **Icons**: Heroicons, Lucide React
- **Forms**: React Hook Form with Zod validation
- **Rich Text**: React Quill
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Real-time**: Socket.io Client

### Backend
- **Runtime**: Node.js 20
- **Framework**: Next.js 15 API Routes
- **Database**: SQLite (dev), PostgreSQL 16 (production)
- **ORM**: Custom query builder with TypeScript
- **Cache**: Redis 7 with ioredis
- **Authentication**: JWT with NextAuth.js 5
- **Real-time**: Socket.io
- **Email**: Nodemailer
- **File Storage**: Local, AWS S3, GCS, Azure Blob
- **Queue**: Bull (Redis-based)
- **Search**: Fuse.js (built-in), Elasticsearch (optional)

### DevOps & Infrastructure
- **Containerization**: Docker multi-stage builds
- **Orchestration**: Kubernetes with Helm charts
- **IaC**: Terraform for AWS, Azure, GCP
- **CI/CD**: GitHub Actions with automated deployments
- **Monitoring**: Prometheus, Grafana, Datadog
- **Error Tracking**: Sentry
- **CDN**: Cloudflare support
- **Reverse Proxy**: NGINX

### Testing
- **Unit Tests**: Vitest with coverage
- **E2E Tests**: Playwright with parallel execution
- **Security Tests**: OWASP ZAP, Snyk, Trivy
- **Accessibility Tests**: axe-core, Pa11y
- **Performance Tests**: Lighthouse CI, k6

## Quick Start

### Prerequisites
- Node.js 18+ (recommended: 20 LTS)
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ServiceDesk.git
cd ServiceDesk

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Initialize database
npm run init-db

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Default Credentials (Development)

- **Admin**: admin@example.com / Admin123!
- **Agent**: agent1@example.com / Agent123!
- **User**: user1@example.com / User123!

> **Warning**: Change these credentials immediately in production!

## Environment Setup

### Development

```bash
# Use development environment template
cp .env.local.example .env.local

# No additional configuration needed for development
# SQLite database is used automatically
```

### Production

```bash
# Use production environment template
cp .env.production.example .env.production

# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# Edit .env.production and set REQUIRED variables:
# - JWT_SECRET
# - SESSION_SECRET
# - DATABASE_URL (PostgreSQL)
# - REDIS_URL (recommended)
# - SENTRY_DSN (recommended)
# - Email provider credentials
```

See [Environment Variables Reference](docs/deployment/environment-variables.md) for complete documentation.

## Documentation

### For Users
- [Getting Started Guide](docs/user-guide/getting-started.md) - First-time user tutorial
- [Ticket Management](docs/user-guide/tickets.md) - Creating and tracking tickets
- [Knowledge Base](docs/user-guide/knowledge-base.md) - Using the knowledge base
- [Admin Features](docs/user-guide/admin.md) - Administrative functions

### For Developers
- [Development Setup](docs/development/setup.md) - Development environment
- [Database Guide](docs/development/database.md) - Database schema and migrations
- [Authentication System](docs/development/authentication.md) - Auth architecture
- [Testing Guide](docs/development/testing.md) - Running tests
- [Contributing Guide](docs/development/contributing.md) - How to contribute

### API Documentation
- **[API Documentation](API_DOCUMENTATION.md)** - Complete REST API reference
- **[Quick Start Guide](API_QUICK_START.md)** - Get started with the API in 5 minutes
- **[Interactive Swagger UI](http://localhost:3000/api/docs)** - Try the API in your browser
- **[OpenAPI Specification](http://localhost:3000/api/docs/openapi.yaml)** - Download OpenAPI 3.0 spec
- **[Postman Collection](postman-collection.json)** - Import into Postman for testing

### For DevOps
- [Docker Deployment](docs/deployment/docker.md) - Docker deployment guide
- [Kubernetes Deployment](docs/deployment/kubernetes.md) - K8s deployment
- [Production Checklist](docs/deployment/production.md) - Go-live checklist
- [Environment Variables](docs/deployment/environment-variables.md) - Configuration reference

### For Operations
- [Monitoring Guide](docs/operations/monitoring.md) - Observability setup
- [Backup & Restore](docs/operations/backup-restore.md) - Disaster recovery
- [Troubleshooting](docs/operations/troubleshooting.md) - Common issues
- [Security Best Practices](docs/operations/security.md) - Security hardening

## Deployment

### Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Application: http://localhost:3000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001
```

See [Docker Deployment Guide](docs/deployment/docker.md) for details.

### Kubernetes

```bash
# Deploy to Kubernetes cluster
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl get pods -n servicedesk
```

See [Kubernetes Deployment Guide](docs/deployment/kubernetes.md) for details.

### Cloud Platforms

- **AWS**: Use provided Terraform modules in `terraform/aws/`
- **Azure**: Use provided Terraform modules in `terraform/azure/`
- **GCP**: Use provided Terraform modules in `terraform/gcp/`

See [Infrastructure Documentation](docs/INFRASTRUCTURE.md) for details.

## Scripts

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run type-check       # TypeScript type checking
npm run format           # Format code with Prettier
```

### Database
```bash
npm run init-db          # Initialize database with schema and seed data
npm run test-db          # Test database connection
npm run db:seed          # Add seed data only
npm run db:clear         # Clear all data
npm run migrate          # Run database migrations
npm run migrate:status   # Check migration status
```

### Testing
```bash
npm test                 # Run all tests
npm run test:unit        # Run unit tests
npm run test:e2e         # Run E2E tests
npm run test:a11y        # Run accessibility tests
npm run test:security    # Run security tests
npm run test:unit:coverage # Generate coverage report
```

### Security
```bash
npm run security:scan         # Full security scan
npm run security:scan-deps    # Scan dependencies
npm run security:scan-secrets # Scan for secrets
npm run security:report       # Generate security report
```

### Performance
```bash
npm run lighthouse        # Run Lighthouse audit
npm run build:analyze     # Analyze bundle size
npm run db:benchmark      # Database performance test
```

## Project Structure

```
ServiceDesk/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   ├── auth/                 # Authentication pages
│   ├── tickets/              # Ticket management
│   ├── admin/                # Admin dashboard
│   └── layout.tsx            # Root layout
├── lib/                      # Core libraries
│   ├── db/                   # Database layer
│   │   ├── schema.sql        # Database schema
│   │   ├── queries.ts        # Type-safe queries
│   │   ├── connection.ts     # Database connection
│   │   └── migrations/       # Database migrations
│   ├── auth/                 # Authentication
│   ├── cache/                # Redis caching
│   ├── notifications/        # Real-time notifications
│   ├── workflow/             # Automation engine
│   ├── monitoring/           # Logging & metrics
│   └── types/                # TypeScript types
├── components/               # React components
│   ├── ui/                   # Base UI components
│   ├── tickets/              # Ticket components
│   └── admin/                # Admin components
├── docs/                     # Documentation
│   ├── deployment/           # Deployment guides
│   ├── user-guide/           # User documentation
│   ├── development/          # Developer guides
│   └── operations/           # Operations guides
├── tests/                    # Test suites
│   ├── unit/                 # Unit tests
│   ├── e2e/                  # E2E tests
│   ├── security/             # Security tests
│   └── accessibility/        # A11y tests
├── k8s/                      # Kubernetes manifests
├── terraform/                # Infrastructure as Code
├── monitoring/               # Monitoring configs
├── .github/                  # GitHub Actions workflows
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Docker Compose config
└── package.json              # Dependencies and scripts
```

## Database Schema

The application uses an 18-table database schema with:

- **Users & Auth**: users, refresh_tokens, permissions, roles
- **Tickets**: tickets, comments, attachments, templates
- **SLA**: sla_policies, sla_tracking, escalations
- **Knowledge Base**: kb_articles, kb_categories
- **Analytics**: analytics_daily_metrics, analytics_agent_metrics
- **Notifications**: notifications, notification_events
- **Audit**: audit_logs, auth_audit_logs

See [Database Documentation](docs/development/database.md) for complete schema.

## API Reference

RESTful API with OpenAPI 3.0 specification:

- **Authentication**: `/api/auth/*`
- **Tickets**: `/api/tickets/*`
- **Users**: `/api/users/*`
- **Knowledge Base**: `/api/kb/*`
- **Analytics**: `/api/analytics/*`

See [API Documentation](docs/api/README.md) and [OpenAPI Spec](docs/openapi.yaml).

## Security

### Reporting Vulnerabilities

Please report security vulnerabilities to: **security@servicedesk.com**

Do NOT create public GitHub issues for security vulnerabilities.

### Security Features

- JWT authentication with rotation
- Password hashing with bcrypt
- 2FA/TOTP support
- WebAuthn/FIDO2 support
- Rate limiting on all endpoints
- SQL injection protection
- XSS/CSRF protection
- Security headers (Helmet.js)
- Regular dependency scanning
- Automated security testing

See [Security Best Practices](docs/operations/security.md) for details.

## Contributing

We welcome contributions! Please read our [Contributing Guide](docs/development/contributing.md) before submitting PRs.

### Contribution Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with conventional commits (`git commit -m "feat: add amazing feature"`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation
- Follow existing code style
- Use meaningful commit messages

## CI/CD Pipeline

Automated workflows powered by GitHub Actions:

- **CI**: Lint, type-check, test, security scan (on every push/PR)
- **Security**: Daily security scans with multiple tools
- **Dependencies**: Weekly dependency updates via Dependabot
- **Deploy Staging**: Auto-deploy to staging on merge to main
- **Deploy Production**: Manual approval required for production

See [CI/CD Guide](docs/CI_CD_GUIDE.md) for complete documentation.

## Performance

### Key Metrics
- **Lighthouse Score**: 95+
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.0s
- **Bundle Size**: < 200KB (gzipped)
- **API Response Time**: < 100ms (p95)
- **Database Query Time**: < 50ms (p95)

### Optimization Techniques
- Redis caching for frequent queries
- Database query optimization with indexes
- Image optimization with Sharp
- Code splitting and lazy loading
- CDN for static assets
- Service worker caching

## Accessibility

- WCAG 2.1 Level AA compliant
- Tested with screen readers (NVDA, JAWS, VoiceOver)
- Full keyboard navigation support
- High contrast mode
- Automated testing with axe-core
- Regular accessibility audits

See [Accessibility Documentation](docs/ACCESSIBILITY.md).

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/ServiceDesk/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/ServiceDesk/discussions)
- **Email**: support@servicedesk.com

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)

## Roadmap

### Version 2.0 (Q1 2026)
- AI-powered ticket classification
- Advanced analytics with machine learning
- Mobile apps (iOS/Android)
- Multi-channel support (SMS, Telegram)
- Advanced workflow builder (visual editor)

### Future Enhancements
- GraphQL API
- Real-time collaboration features
- Video call integration
- Advanced reporting with BI tools
- Self-service portal improvements

---

**Made with love by the ServiceDesk Team**

[⬆ Back to top](#servicedesk---enterprise-help-desk--ticket-management-system)
