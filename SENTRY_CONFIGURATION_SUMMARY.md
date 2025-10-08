# Sentry Source Maps - Configuration Summary

## ✅ Configuration Complete

All Sentry source maps configurations have been successfully implemented for the ServiceDesk application.

---

## 📦 What Was Configured

### 1. Build Settings (next.config.js) ✅

**Changes Made:**
- ✅ Enabled `productionBrowserSourceMaps: true`
- ✅ Configured `hidden-source-map` in webpack
- ✅ Source maps generated but NOT referenced in bundles (security)

```javascript
// next.config.js
productionBrowserSourceMaps: true  // Line 224
config.devtool = 'hidden-source-map' // Line 132
```

**Impact:**
- Source maps are generated during production builds
- Maps are hidden from public access (no references in JS bundles)
- Sentry can use maps for readable stack traces

---

### 2. NPM Scripts (package.json) ✅

**New Scripts Added:**

| Script | Purpose | Line |
|--------|---------|------|
| `sentry:sourcemaps` | Upload all source maps | 34 |
| `sentry:sourcemaps:client` | Upload client maps only | 35 |
| `sentry:sourcemaps:server` | Upload server maps only | 36 |
| `sentry:release` | Create Sentry release | 37 |
| `sentry:deploy` | Full deployment workflow | 38 |
| `postbuild` | Auto-upload after build | 39 |

**Usage:**
```bash
# Manual upload
npm run sentry:sourcemaps

# Full deployment
npm run sentry:deploy

# Automatic (runs after build if SENTRY_UPLOAD_SOURCEMAPS=true)
npm run build
```

---

### 3. Sentry CLI Configuration (.sentryclirc) ✅

**File Created:** `/home/nic20/ProjetosWeb/ServiceDesk/.sentryclirc`

**Configuration Sections:**
- `[auth]` - Authentication token (placeholder)
- `[defaults]` - Organization and project settings
- `[sourcemaps]` - Upload settings and options
- `[release]` - Release management
- `[http]` - Connection settings
- `[log]` - Logging configuration

**Security:**
- ✅ Added to `.gitignore` (line 119)
- ✅ Contains placeholders (needs user input)
- ✅ Documented with security warnings

**Required Updates:**
```ini
token=YOUR_SENTRY_AUTH_TOKEN_HERE     # Replace with real token
org=YOUR_ORGANIZATION_SLUG            # Replace with org slug
project=YOUR_PROJECT_SLUG             # Replace with project slug
```

---

### 4. Environment Variables (.env.example) ✅

**New Variables Added:**

```bash
# Sentry Error Tracking
SENTRY_DSN=                           # Public DSN (line 261)

# Source Map Upload (SENSITIVE)
SENTRY_AUTH_TOKEN=                    # Auth token (line 263)
SENTRY_ORG=                           # Organization slug (line 270)
SENTRY_PROJECT=                       # Project slug (line 274)
SENTRY_ENVIRONMENT=production         # Environment (line 278)
SENTRY_RELEASE=                       # Release ID (line 285)
SENTRY_UPLOAD_SOURCEMAPS=false        # Enable upload (line 293)

# Performance & Sampling
SENTRY_TRACES_SAMPLE_RATE=0.1         # Traces sampling (line 300)
SENTRY_ERROR_SAMPLE_RATE=1.0          # Error sampling (line 304)
```

**Documentation:**
- ✅ Detailed comments explaining each variable
- ✅ Links to Sentry dashboard for credentials
- ✅ Security warnings for sensitive values
- ✅ Example values and formats

---

### 5. Automated Upload Script ✅

**File Created:** `/home/nic20/ProjetosWeb/ServiceDesk/scripts/sentry-upload-sourcemaps.js`

**Features:**
- ✅ Validates configuration before upload
- ✅ Creates releases in Sentry
- ✅ Uploads source maps (client & server)
- ✅ Associates git commits
- ✅ Sets deployment environment
- ✅ Finalizes releases
- ✅ Colored console output for clarity
- ✅ Error handling and debugging info
- ✅ CI/CD compatible

**Execution:**
```bash
# Automatic (postbuild hook)
npm run build

# Manual
node scripts/sentry-upload-sourcemaps.js
```

---

### 6. Security Configuration (.gitignore) ✅

**Added Entries:**
```gitignore
# Line 110-116: Environment files
.env
.env.test
.env.production
.env.local
.env.development.local
.env.test.local
.env.production.local

# Line 119: Sentry config
.sentryclirc
```

**Protection:**
- ✅ Sensitive tokens never committed
- ✅ Environment-specific configs excluded
- ✅ Sentry CLI config excluded

---

## 📚 Documentation Created

### 1. Complete Setup Guide ✅
**File:** `SENTRY_SOURCEMAPS_SETUP.md` (15,992 bytes)

**Contents:**
- Overview and concepts
- Configuration files explained
- Environment variables guide
- Build configuration details
- Upload process workflow
- CI/CD integration examples (GitHub Actions, Vercel, Docker)
- Troubleshooting section
- Security best practices
- Quick reference commands

### 2. Verification Checklist ✅
**File:** `SENTRY_SOURCEMAPS_CHECKLIST.md` (8,582 bytes)

**Contents:**
- Pre-deployment checklist
- Deployment step-by-step guide
- Testing procedures
- Security verification
- CI/CD integration checklist
- Troubleshooting quick fixes
- Command reference

### 3. Quick Start Guide ✅
**File:** `SENTRY_SETUP_README.md` (7,140 bytes)

**Contents:**
- 5-minute quick setup
- Configuration file overview
- Available NPM scripts
- Automated upload process
- Testing instructions
- Troubleshooting tips
- CI/CD examples
- Verification checklist

---

## 🚀 Next Steps (Action Required)

### Step 1: Install Sentry CLI
```bash
npm install -g @sentry/cli
```

### Step 2: Get Sentry Credentials

1. **Sentry DSN** (Public)
   - Go to: https://sentry.io/settings/[YOUR_ORG]/projects/[YOUR_PROJECT]/keys/
   - Copy the DSN URL

2. **Auth Token** (Secret)
   - Go to: https://sentry.io/settings/account/api/auth-tokens/
   - Create token with scopes: `project:read`, `project:releases`, `org:read`
   - Copy token immediately (shown only once)

3. **Organization & Project Slugs**
   - Found in URL: `https://sentry.io/organizations/[ORG_SLUG]/projects/[PROJECT_SLUG]/`

### Step 3: Configure Environment

**Option A: Local Development**
Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add Sentry credentials
```

**Option B: Production/CI**
Set environment variables in your deployment platform:
- GitHub Actions: Use Secrets
- Vercel: Project Settings → Environment Variables
- Docker: Build args or runtime env vars

### Step 4: Update .sentryclirc

Edit `.sentryclirc` with your credentials:
```ini
[auth]
token=YOUR_ACTUAL_AUTH_TOKEN

[defaults]
org=your-actual-org-slug
project=your-actual-project-slug
```

### Step 5: Test the Configuration

```bash
# Test Sentry CLI auth
sentry-cli info

# Build with source maps
npm run build

# Verify source maps exist
find .next -name "*.map" | head -5

# Test upload
npm run sentry:sourcemaps
```

---

## ✅ Verification Checklist

Use this checklist to verify everything is working:

### Configuration Files
- [x] `next.config.js` - Source maps enabled
- [x] `package.json` - NPM scripts added
- [x] `.sentryclirc` - Created with placeholders
- [x] `.env.example` - Updated with Sentry variables
- [x] `scripts/sentry-upload-sourcemaps.js` - Upload script created
- [x] `.gitignore` - Sensitive files excluded

### Setup (Your Action Required)
- [ ] Sentry CLI installed
- [ ] Sentry account created
- [ ] Project created in Sentry
- [ ] Auth token generated
- [ ] `.sentryclirc` updated with real credentials
- [ ] Environment variables configured

### Testing
- [ ] Build completes successfully
- [ ] Source maps generated (`.next/**/*.map`)
- [ ] Source maps upload successfully
- [ ] Release created in Sentry
- [ ] Test error shows readable stack trace

### Security
- [ ] `.sentryclirc` in `.gitignore`
- [ ] Auth token stored securely
- [ ] `.map` files not publicly accessible
- [ ] Environment variables properly scoped

---

## 🔧 Troubleshooting

### Common Issues & Solutions

**Issue: Source maps not uploading**
```bash
# Check environment variables
env | grep SENTRY

# Verify CLI installation
sentry-cli --version

# Test authentication
sentry-cli info
```

**Issue: Wrong stack traces in Sentry**
```bash
# Check release version
echo $SENTRY_RELEASE

# List uploaded files
sentry-cli releases files $SENTRY_RELEASE list
```

**Issue: Authentication failed**
```bash
# Regenerate token with correct scopes
# https://sentry.io/settings/account/api/auth-tokens/

# Update .sentryclirc
# Update environment variables
```

---

## 📊 Configuration Summary

| Component | Status | Location |
|-----------|--------|----------|
| Build Config | ✅ Complete | `next.config.js` |
| NPM Scripts | ✅ Complete | `package.json` |
| CLI Config | ⚠️ Needs Setup | `.sentryclirc` |
| Environment | ✅ Template Ready | `.env.example` |
| Upload Script | ✅ Complete | `scripts/sentry-upload-sourcemaps.js` |
| Documentation | ✅ Complete | `SENTRY_*.md` files |
| Security | ✅ Complete | `.gitignore` updated |

---

## 📝 Files Modified/Created

### Modified Files
1. `/home/nic20/ProjetosWeb/ServiceDesk/next.config.js`
   - Line 132: Added `hidden-source-map`
   - Line 224: Enabled `productionBrowserSourceMaps`

2. `/home/nic20/ProjetosWeb/ServiceDesk/package.json`
   - Lines 34-39: Added Sentry scripts

3. `/home/nic20/ProjetosWeb/ServiceDesk/.env.example`
   - Lines 214-304: Added Sentry configuration section

4. `/home/nic20/ProjetosWeb/ServiceDesk/.gitignore`
   - Lines 110-119: Added environment and Sentry files

### Created Files
1. `/home/nic20/ProjetosWeb/ServiceDesk/.sentryclirc`
   - Sentry CLI configuration template

2. `/home/nic20/ProjetosWeb/ServiceDesk/scripts/sentry-upload-sourcemaps.js`
   - Automated upload script (executable)

3. `/home/nic20/ProjetosWeb/ServiceDesk/SENTRY_SOURCEMAPS_SETUP.md`
   - Complete setup guide (15,992 bytes)

4. `/home/nic20/ProjetosWeb/ServiceDesk/SENTRY_SOURCEMAPS_CHECKLIST.md`
   - Verification checklist (8,582 bytes)

5. `/home/nic20/ProjetosWeb/ServiceDesk/SENTRY_SETUP_README.md`
   - Quick start guide (7,140 bytes)

6. `/home/nic20/ProjetosWeb/ServiceDesk/SENTRY_CONFIGURATION_SUMMARY.md`
   - This summary document

---

## 🎯 Expected Workflow

### Development
```bash
npm run dev
# Source maps NOT uploaded (SENTRY_UPLOAD_SOURCEMAPS=false)
```

### Production Build
```bash
# Set environment variables
export SENTRY_UPLOAD_SOURCEMAPS=true
export SENTRY_AUTH_TOKEN="your-token"
export SENTRY_ORG="your-org"
export SENTRY_PROJECT="servicedesk"

# Build (uploads automatically via postbuild hook)
npm run build
```

### CI/CD Pipeline
```yaml
# GitHub Actions example
- name: Build and deploy
  run: npm run build
  env:
    SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
    SENTRY_UPLOAD_SOURCEMAPS: true
    SENTRY_RELEASE: ${{ github.sha }}
```

---

## 🔗 Quick Links

### Documentation
- [Complete Setup Guide](./SENTRY_SOURCEMAPS_SETUP.md)
- [Verification Checklist](./SENTRY_SOURCEMAPS_CHECKLIST.md)
- [Quick Start Guide](./SENTRY_SETUP_README.md)

### Sentry Resources
- [Sentry Dashboard](https://sentry.io)
- [Auth Token Generation](https://sentry.io/settings/account/api/auth-tokens/)
- [Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Sentry CLI Docs](https://docs.sentry.io/product/cli/)

---

## 🆘 Support

### Getting Help
1. Check [SENTRY_SOURCEMAPS_SETUP.md](./SENTRY_SOURCEMAPS_SETUP.md) - Section 6: Troubleshooting
2. Use [SENTRY_SOURCEMAPS_CHECKLIST.md](./SENTRY_SOURCEMAPS_CHECKLIST.md) for step-by-step verification
3. Review [SENTRY_SETUP_README.md](./SENTRY_SETUP_README.md) for quick fixes
4. Consult [Sentry Documentation](https://docs.sentry.io)

### Debug Commands
```bash
# Configuration check
sentry-cli info

# Build verification
npm run build && find .next -name "*.map"

# Upload test
npm run sentry:sourcemaps --verbose

# Release verification
sentry-cli releases list --org $SENTRY_ORG --project $SENTRY_PROJECT
```

---

## ✨ Summary

**Configuration Status:** ✅ **COMPLETE** - Ready for deployment after credentials setup

**What's Done:**
- ✅ Build configuration for source map generation
- ✅ NPM scripts for Sentry operations
- ✅ Automated upload script
- ✅ Environment variable templates
- ✅ Security configurations
- ✅ Comprehensive documentation

**What's Needed:**
- ⚠️ Sentry account and project setup
- ⚠️ Auth token generation
- ⚠️ Environment variable configuration
- ⚠️ Testing and verification

**Estimated Setup Time:** 5-10 minutes

---

**Last Updated:** 2025-10-05
**Configuration Version:** 1.0.0
**Status:** Ready for Production Setup
