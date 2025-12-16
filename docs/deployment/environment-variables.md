# Environment Variables Reference

Complete reference for all ServiceDesk environment variables.

## Quick Links

- [Required Variables](#required-variables)
- [Security](#security)
- [Database](#database)
- [Authentication](#authentication)
- [Email](#email)
- [Storage](#storage)
- [Monitoring](#monitoring)
- [Integrations](#integrations)

## Required Variables

### Production Requirements

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes | - |
| `SESSION_SECRET` | Session encryption secret | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | Yes | SQLite (dev) |
| `NODE_ENV` | Environment (production/staging/development) | Yes | development |

Generate secrets:
```bash
openssl rand -hex 32  # For JWT_SECRET and SESSION_SECRET
```

## Security

### JWT & Sessions

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT expiration (seconds) | 28800 (8h) |
| `SESSION_SECRET` | Session secret | - |
| `SESSION_DURATION` | Session duration (seconds) | 28800 |
| `REFRESH_TOKEN_DURATION` | Refresh token duration (days) | 7 |

### Passwords

| Variable | Description | Default |
|----------|-------------|---------|
| `MIN_PASSWORD_LENGTH` | Minimum password length | 8 |
| `REQUIRE_PASSWORD_SPECIAL_CHARS` | Require special characters | true |
| `REQUIRE_PASSWORD_NUMBERS` | Require numbers | true |
| `REQUIRE_PASSWORD_UPPERCASE` | Require uppercase | true |

### Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_RATE_LIMITING` | Enable rate limiting | true |
| `RATE_LIMIT_API` | API requests per minute | 60 |
| `RATE_LIMIT_AUTH` | Auth requests per 15 min | 5 |
| `MAX_LOGIN_ATTEMPTS` | Max login attempts before lockout | 5 |
| `LOCKOUT_DURATION` | Lockout duration (minutes) | 30 |

## Database

### Connection

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `DB_POOL_MIN` | Min connections in pool | 2 |
| `DB_POOL_MAX` | Max connections in pool | 10 |
| `DB_POOL_IDLE_TIMEOUT` | Idle timeout (ms) | 30000 |
| `DB_POOL_ACQUIRE_TIMEOUT` | Acquire timeout (ms) | 5000 |

### SQLite (Development Only)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite file path | `./data/servicedesk.db` |

## Authentication

### Multi-Factor Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `ENFORCE_2FA_FOR_ADMIN` | Force 2FA for admins | false |
| `MFA_SECRET` | TOTP secret | - |

### WebAuthn

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBAUTHN_RP_ID` | Relying Party ID | localhost |

### SSO Providers

#### Google OAuth

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |

#### Microsoft Azure AD

| Variable | Description |
|----------|-------------|
| `AZURE_AD_CLIENT_ID` | Azure AD Client ID |
| `AZURE_AD_CLIENT_SECRET` | Azure AD Secret |
| `AZURE_AD_TENANT_ID` | Azure AD Tenant ID |

#### Gov.br (Brazilian Government)

| Variable | Description | Default |
|----------|-------------|---------|
| `GOVBR_CLIENT_ID` | Gov.br Client ID | - |
| `GOVBR_CLIENT_SECRET` | Gov.br Secret | - |
| `GOVBR_ENVIRONMENT` | Environment (staging/production) | staging |

## Email

### Provider Selection

| Variable | Description | Options |
|----------|-------------|---------|
| `EMAIL_PROVIDER` | Email service provider | smtp, sendgrid, mailgun, ses |

### SMTP

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server host | smtp.gmail.com |
| `SMTP_PORT` | SMTP port | 587 |
| `SMTP_SECURE` | Use TLS | false |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `EMAIL_FROM_ADDRESS` | From email address | noreply@servicedesk.com |
| `EMAIL_FROM_NAME` | From name | ServiceDesk |

### SendGrid

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |

### AWS SES

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_SES_REGION` | AWS region | us-east-1 |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |

## Storage

### Provider Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PROVIDER` | Storage provider | local |
| `LOCAL_STORAGE_PATH` | Local storage path | ./uploads |
| `MAX_FILE_SIZE_MB` | Max file size (MB) | 10 |

### AWS S3

| Variable | Description |
|----------|-------------|
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_S3_REGION` | AWS region |
| `AWS_S3_ACCESS_KEY` | AWS access key |
| `AWS_S3_SECRET_KEY` | AWS secret key |

### Google Cloud Storage

| Variable | Description |
|----------|-------------|
| `GCS_BUCKET` | GCS bucket name |
| `GCS_PROJECT_ID` | GCP project ID |
| `GCS_CREDENTIALS_PATH` | Service account JSON path |

### Azure Blob Storage

| Variable | Description |
|----------|-------------|
| `AZURE_STORAGE_ACCOUNT` | Storage account name |
| `AZURE_STORAGE_KEY` | Storage account key |
| `AZURE_STORAGE_CONTAINER` | Container name |

## Redis

### Connection

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Full Redis connection URL | - |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `REDIS_PASSWORD` | Redis password | - |
| `REDIS_DB` | Redis database number | 0 |
| `ENABLE_REDIS_CACHE` | Enable Redis caching | false (dev) |

### Cache Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_TTL` | Default TTL (seconds) | 3600 |
| `CACHE_TTL_SHORT` | Short TTL | 300 |
| `CACHE_TTL_MEDIUM` | Medium TTL | 1800 |
| `CACHE_TTL_LONG` | Long TTL | 7200 |

## Monitoring

### Sentry

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN (public) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry DSN |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (for source maps) |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_ENVIRONMENT` | Environment name |
| `SENTRY_ERROR_SAMPLE_RATE` | Error sample rate (0-1) |
| `SENTRY_TRACES_SAMPLE_RATE` | Traces sample rate (0-1) |

### Datadog

| Variable | Description | Default |
|----------|-------------|---------|
| `DD_API_KEY` | Datadog API key | - |
| `DD_SITE` | Datadog site | datadoghq.com |
| `DD_SERVICE` | Service name | servicedesk |
| `DD_ENV` | Environment | development |
| `DD_VERSION` | Version | 1.0.0 |
| `DD_TRACE_ENABLED` | Enable tracing | false |
| `DD_LOGS_ENABLED` | Enable logs | false |
| `DD_PROFILING_ENABLED` | Enable profiling | false |

## Integrations

### WhatsApp Business API

| Variable | Description |
|----------|-------------|
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp access token |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification token |

### Slack

| Variable | Description |
|----------|-------------|
| `SLACK_WEBHOOK_URL` | Slack webhook URL |
| `SLACK_BOT_TOKEN` | Slack bot token |

### OpenAI

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | Model to use | gpt-4o-mini |
| `ENABLE_AI_CLASSIFICATION` | Enable AI classification | false |
| `ENABLE_AI_SENTIMENT_ANALYSIS` | Enable sentiment analysis | false |

## Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_KNOWLEDGE_BASE` | Enable knowledge base | true |
| `ENABLE_ANALYTICS` | Enable analytics | true |
| `ENABLE_WORKFLOWS` | Enable workflows | true |
| `ENABLE_GAMIFICATION` | Enable gamification | false |
| `ENABLE_PWA` | Enable PWA features | true |
| `ENABLE_REALTIME_NOTIFICATIONS` | Enable real-time notifications | true |
| `ENABLE_MULTI_TENANCY` | Enable multi-tenancy | true |

## Development

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug mode | false |
| `LOG_SQL_QUERIES` | Log SQL queries | false |
| `LOG_LEVEL` | Log level (error/warn/info/debug) | info |
| `SKIP_EMAIL_VERIFICATION` | Skip email verification | true (dev) |

## Example Configurations

### Development (.env.local)

```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=./data/servicedesk.db
LOG_LEVEL=debug
SKIP_EMAIL_VERIFICATION=true
```

### Production (.env.production)

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://servicedesk.yourdomain.com

# Security (CHANGE THESE!)
JWT_SECRET=<generate-with-openssl>
SESSION_SECRET=<generate-with-openssl>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/servicedesk

# Redis
REDIS_URL=redis://:password@host:6379

# Email
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=<your-key>

# Storage
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=<your-bucket>
AWS_S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=<your-dsn>
DD_API_KEY=<your-key>
```

## Validation

The application validates environment variables on startup.

```bash
# Manually validate
npm run env:validate
```

Missing required variables will prevent the application from starting in production.

## References

- [.env.example](../../.env.example) - Complete template
- [.env.local.example](../../.env.local.example) - Development template
- [.env.production.example](../../.env.production.example) - Production template
