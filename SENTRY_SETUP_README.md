# Sentry Source Maps - Quick Start Guide

## 🎯 Overview

This project is configured to automatically upload source maps to Sentry for enhanced error tracking in production. Source maps allow you to see readable stack traces with original file names, line numbers, and variable names instead of minified code.

## 📁 Configuration Files

| File | Purpose | Status |
|------|---------|--------|
| `next.config.js` | Build configuration for source map generation | ✅ Configured |
| `.sentryclirc` | Sentry CLI configuration with auth token | ⚠️ Needs setup |
| `.env.example` | Environment variable template | ✅ Updated |
| `package.json` | NPM scripts for Sentry operations | ✅ Scripts added |
| `scripts/sentry-upload-sourcemaps.js` | Automated upload script | ✅ Created |

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Sentry CLI

```bash
npm install -g @sentry/cli
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Required for error tracking
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Required for source map upload
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=servicedesk
SENTRY_UPLOAD_SOURCEMAPS=true
```

**Get Your Credentials:**

1. **Sentry DSN**: Project Settings → Client Keys (DSN)
2. **Auth Token**: Account Settings → API → Auth Tokens
   - Required scopes: `project:read`, `project:releases`, `org:read`
3. **Org/Project Slugs**: Found in your Sentry URL

### Step 3: Configure .sentryclirc

Edit `.sentryclirc` in project root:

```ini
[auth]
token=YOUR_SENTRY_AUTH_TOKEN_HERE

[defaults]
org=YOUR_ORGANIZATION_SLUG
project=YOUR_PROJECT_SLUG
```

⚠️ **IMPORTANT**: This file is already in `.gitignore` - never commit it!

### Step 4: Test the Setup

```bash
# Build the application
npm run build

# Verify source maps were generated
find .next -name "*.map" | head -5

# Test Sentry CLI authentication
sentry-cli info

# Upload source maps (manual test)
npm run sentry:sourcemaps
```

## 📋 Available NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run sentry:sourcemaps` | Upload all source maps to Sentry |
| `npm run sentry:sourcemaps:client` | Upload client-side source maps only |
| `npm run sentry:sourcemaps:server` | Upload server-side source maps only |
| `npm run sentry:release` | Create and finalize a release in Sentry |
| `npm run sentry:deploy` | Full workflow: build + upload + release |

## 🔄 Automated Upload Process

Source maps are automatically uploaded after each production build when:

1. `SENTRY_UPLOAD_SOURCEMAPS=true` is set
2. Required environment variables are configured
3. `npm run build` is executed

The `postbuild` script runs `scripts/sentry-upload-sourcemaps.js` which:
- Creates a new release in Sentry
- Uploads all source maps
- Associates git commits
- Sets deployment environment
- Finalizes the release

## 🔒 Security Best Practices

### ✅ DO:
- Store `SENTRY_AUTH_TOKEN` in environment variables or CI/CD secrets
- Add `.sentryclirc` to `.gitignore` (already done)
- Use `hidden-source-map` for production (already configured)
- Rotate auth tokens periodically
- Limit token scopes to minimum required

### ❌ DON'T:
- Commit `.sentryclirc` with real tokens
- Expose `SENTRY_AUTH_TOKEN` in client-side code
- Serve `.map` files publicly
- Use the same token across all environments

## 🧪 Testing Source Maps

### 1. Add Test Error to Any Component

```javascript
import { useEffect } from 'react';

export default function MyComponent() {
  useEffect(() => {
    // Trigger test error with ?test-sentry=true
    if (typeof window !== 'undefined' && window.location.search.includes('test-sentry')) {
      throw new Error('Test error for Sentry source maps verification');
    }
  }, []);

  return <div>My Component</div>;
}
```

### 2. Trigger the Error

Visit: `https://yourapp.com?test-sentry=true`

### 3. Verify in Sentry

1. Go to Sentry Dashboard → **Issues**
2. Find the test error
3. Check that:
   - ✅ Stack trace shows original source code
   - ✅ File names are readable (not minified)
   - ✅ Line numbers are accurate
   - ✅ Variable names are preserved

## 🔧 Troubleshooting

### Source Maps Not Uploading?

```bash
# Check environment variables
env | grep SENTRY

# Verify Sentry CLI is installed
sentry-cli --version

# Test authentication
sentry-cli info

# Upload with verbose logging
sentry-cli sourcemaps upload --verbose .next
```

### Wrong Stack Traces?

```bash
# Verify release matches
echo $SENTRY_RELEASE

# List uploaded files
sentry-cli releases files $SENTRY_RELEASE list

# Re-upload if needed
npm run sentry:sourcemaps
```

### Authentication Errors?

1. Regenerate token at: https://sentry.io/settings/account/api/auth-tokens/
2. Ensure token has required scopes: `project:read`, `project:releases`, `org:read`
3. Update `.sentryclirc` and environment variables

## 📊 CI/CD Integration

### GitHub Actions Example

```yaml
- name: Upload source maps to Sentry
  run: npm run sentry:sourcemaps
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
    SENTRY_RELEASE: ${{ github.sha }}
```

### Vercel

Add environment variables in **Project Settings → Environment Variables**:
- `SENTRY_DSN` (exposed to client)
- `SENTRY_AUTH_TOKEN` (server-only)
- `SENTRY_ORG` (server-only)
- `SENTRY_PROJECT` (server-only)
- `SENTRY_UPLOAD_SOURCEMAPS=true`

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [SENTRY_SOURCEMAPS_SETUP.md](./SENTRY_SOURCEMAPS_SETUP.md) | Complete setup guide with detailed explanations |
| [SENTRY_SOURCEMAPS_CHECKLIST.md](./SENTRY_SOURCEMAPS_CHECKLIST.md) | Step-by-step verification checklist |
| [.sentryclirc](./.sentryclirc) | Sentry CLI configuration (update with your values) |

## ✅ Verification Checklist

Before deploying to production:

- [ ] Sentry CLI installed (`sentry-cli --version`)
- [ ] Environment variables configured (`.env` or CI/CD)
- [ ] `.sentryclirc` configured with auth token
- [ ] Source maps generated during build (`find .next -name "*.map"`)
- [ ] Test error shows readable stack trace in Sentry
- [ ] `.map` files NOT publicly accessible
- [ ] Auth token stored securely (not committed)
- [ ] CI/CD pipeline configured for automatic upload

## 🆘 Need Help?

1. **Setup Issues**: See [SENTRY_SOURCEMAPS_SETUP.md](./SENTRY_SOURCEMAPS_SETUP.md) - Section 6: Troubleshooting
2. **Step-by-Step Guide**: See [SENTRY_SOURCEMAPS_CHECKLIST.md](./SENTRY_SOURCEMAPS_CHECKLIST.md)
3. **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs/

## 🔗 Quick Links

- [Sentry Dashboard](https://sentry.io)
- [Generate Auth Token](https://sentry.io/settings/account/api/auth-tokens/)
- [Next.js Source Maps Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/)
- [Sentry CLI Reference](https://docs.sentry.io/product/cli/)

---

**Configuration Status**: ✅ Complete - Ready for deployment
**Last Updated**: 2025-10-05
