# Environment Variables - Quick Reference Card

## 🚀 Quick Start

### Development (Local)
```bash
cp .env.local.example .env.local
npm run dev
```
Done! No configuration needed.

### Production
```bash
cp .env.production.example .env.production
# Edit .env.production and fill required values
npm run build && npm start
```

## 📋 Required Variables

### Development
None! All have safe defaults.

### Production (MUST CONFIGURE)
```bash
JWT_SECRET=               # openssl rand -hex 32
SESSION_SECRET=           # openssl rand -hex 32
DATABASE_URL=             # postgresql://user:pass@host/db
```

## 🔧 Recommended Variables (Production)

```bash
# Caching & Performance
REDIS_URL=                # redis://...

# Error Tracking
SENTRY_DSN=               # https://...@sentry.io/...

# Monitoring (Optional but Recommended)
DD_API_KEY=               # Datadog API key

# Email
SENDGRID_API_KEY=         # Or configure SMTP_*
```

## 🔑 Generate Secrets

```bash
# JWT Secret (64 chars recommended)
openssl rand -hex 32

# Session Secret
openssl rand -hex 32

# NextAuth Secret
openssl rand -base64 32

# MFA Secret
openssl rand -hex 32
```

## 📊 Variable Categories

| Category | Example Variables | Required? |
|----------|------------------|-----------|
| **Security** | JWT_SECRET, SESSION_SECRET | ✅ Production |
| **Database** | DATABASE_URL | ✅ Production |
| **Email** | SENDGRID_API_KEY, SMTP_* | Recommended |
| **AI** | OPENAI_API_KEY | Optional |
| **Caching** | REDIS_URL | Recommended |
| **Monitoring** | SENTRY_DSN, DD_API_KEY | Recommended |
| **SSO** | GOOGLE_CLIENT_ID, etc. | Optional |
| **Integrations** | WHATSAPP_*, GOVBR_* | Optional |

## 🔍 Check Configuration

```bash
# Validate environment
npm run type-check

# Or manually
node -e "require('./lib/config/env').validateEnvironment()"
```

## ⚠️ Common Errors

### Error: JWT_SECRET must be set in production
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.production
```

### Error: DATABASE_URL must be set in production
```bash
# Get PostgreSQL URL from Neon.tech
echo "DATABASE_URL=postgresql://..." >> .env.production
```

### Warning: Redis not configured
```bash
# Optional but recommended for performance
echo "REDIS_URL=redis://..." >> .env.production
```

## 📚 Full Documentation

- **Complete list:** See `.env.example`
- **Development:** See `.env.local.example`
- **Production:** See `.env.production.example`
- **Detailed guide:** See `README.md` section "Environment Variables"

## 🎯 Environment-Specific Defaults

| Variable | Development | Production |
|----------|-------------|------------|
| NODE_ENV | development | production |
| DATABASE_URL | ./data/servicedesk.db | (required) |
| REDIS_URL | (optional) | (recommended) |
| LOG_LEVEL | debug | warn |
| RATE_LIMITING | disabled | enabled |
| DEBUG | true | false |

## 🛡️ Security Checklist

Production security requirements:
- ✅ JWT_SECRET: min 32 chars, random
- ✅ SESSION_SECRET: min 32 chars, random
- ✅ DATABASE_URL: PostgreSQL (not SQLite)
- ✅ Secrets NOT committed to git
- ✅ Different secrets than development
- ✅ Redis configured for sessions
- ✅ Sentry configured for errors

## 💡 Pro Tips

**Development:**
- Use `.env.local` (gitignored, safe for secrets)
- Pre-configured values work immediately
- All features enabled for testing

**Production:**
- Generate unique secrets (never copy from examples)
- Use PostgreSQL, not SQLite
- Configure Redis for performance
- Enable Sentry for error tracking
- Use SendGrid for reliable emails

**Secrets Management:**
```typescript
// Use the secrets manager
import { getSecretsManager } from '@/lib/config/secrets';

const secrets = getSecretsManager();
const auth = await secrets.getAuthSecrets();
```

## 🔗 Quick Links

- `.env.example` - Complete reference (195+ variables)
- `.env.local.example` - Development template
- `.env.production.example` - Production template
- `lib/config/env.ts` - Validation logic
- `lib/config/secrets.ts` - Secrets manager
- `README.md` - Full documentation

## 📞 Support

If you're stuck:
1. Check `.env.example` for variable documentation
2. Read `README.md` Environment Variables section
3. Validate with `npm run type-check`
4. Check error messages (they're detailed!)

---

**Last Updated:** 2025-10-18
**Quick Reference Version:** 1.0
