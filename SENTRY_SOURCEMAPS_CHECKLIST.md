# Sentry Source Maps - Verification Checklist

Quick reference checklist for verifying Sentry source maps configuration and upload process.

## 📋 Pre-Deployment Checklist

### 1. Initial Configuration ✓

- [ ] **Install Sentry CLI**
  ```bash
  npm install -g @sentry/cli
  # Verify installation
  sentry-cli --version
  ```

- [ ] **Configure .sentryclirc**
  - [ ] File created at project root
  - [ ] Auth token added (generate at: https://sentry.io/settings/account/api/auth-tokens/)
  - [ ] Organization slug configured
  - [ ] Project slug configured
  - [ ] File added to `.gitignore`

- [ ] **Set Environment Variables** (`.env.production`)
  ```bash
  SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
  SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
  SENTRY_ORG=your-organization-slug
  SENTRY_PROJECT=servicedesk
  SENTRY_ENVIRONMENT=production
  SENTRY_UPLOAD_SOURCEMAPS=true
  SENTRY_RELEASE=$(git rev-parse --short HEAD)
  ```

### 2. Build Configuration ✓

- [ ] **next.config.js Settings**
  ```javascript
  productionBrowserSourceMaps: true  // ✓ Enabled
  config.devtool = 'hidden-source-map' // ✓ Hidden maps
  ```

- [ ] **Verify Source Maps Generation**
  ```bash
  npm run build
  find .next -name "*.map" | head -5
  # Should show .map files
  ```

### 3. NPM Scripts ✓

Verify these scripts exist in `package.json`:

- [ ] `sentry:sourcemaps` - Upload all source maps
- [ ] `sentry:sourcemaps:client` - Upload client maps only
- [ ] `sentry:sourcemaps:server` - Upload server maps only
- [ ] `sentry:release` - Create and finalize release
- [ ] `sentry:deploy` - Full deployment workflow
- [ ] `postbuild` - Automatic upload after build

---

## 🚀 Deployment Checklist

### Step 1: Build Application

```bash
npm run build
```

**Verify:**
- [ ] Build completes successfully
- [ ] `.next` directory created
- [ ] Source maps present in `.next/static/chunks/*.map`

### Step 2: Set Environment Variables

```bash
export SENTRY_AUTH_TOKEN="your-token-here"
export SENTRY_ORG="your-org"
export SENTRY_PROJECT="servicedesk"
export SENTRY_RELEASE="$(git rev-parse --short HEAD)"
export SENTRY_UPLOAD_SOURCEMAPS="true"
```

**Verify:**
```bash
env | grep SENTRY
# Should show all variables
```

### Step 3: Upload Source Maps

**Option A: Automatic (Recommended)**
```bash
# Runs automatically after build if SENTRY_UPLOAD_SOURCEMAPS=true
npm run build
```

**Option B: Manual**
```bash
npm run sentry:sourcemaps
npm run sentry:release
```

**Verify Upload:**
- [ ] No error messages in console
- [ ] Release created in Sentry dashboard
- [ ] Source maps uploaded successfully

### Step 4: Verify in Sentry Dashboard

1. [ ] Go to Sentry project → **Releases**
2. [ ] Find your release (git SHA or version)
3. [ ] Click on release → **Artifacts** tab
4. [ ] Verify source maps are listed
5. [ ] Check file count matches build output

---

## 🧪 Testing Checklist

### Test Source Maps Are Working

1. [ ] **Trigger a Test Error**
   ```javascript
   // Add to any page component
   useEffect(() => {
     if (typeof window !== 'undefined' && window.location.search.includes('test-sentry')) {
       throw new Error('Test error for Sentry source maps');
     }
   }, []);
   ```

2. [ ] **Trigger Error in Browser**
   ```
   Visit: https://yourapp.com?test-sentry=true
   ```

3. [ ] **Check Sentry Dashboard**
   - [ ] Error appears in Issues
   - [ ] Click on error to view details
   - [ ] Stack trace shows original source code (not minified)
   - [ ] File paths are correct
   - [ ] Line numbers point to correct location
   - [ ] Variable names are readable

### Verify Source Map Quality

- [ ] **Original Function Names**: Functions not minified (e.g., `handleSubmit` not `a`)
- [ ] **Original Variable Names**: Variables readable (e.g., `userData` not `t`)
- [ ] **Correct File Paths**: Shows source file structure
- [ ] **Accurate Line Numbers**: Points to actual error line
- [ ] **Source Code Preview**: Sentry shows surrounding code

---

## 🔒 Security Checklist

### Secrets Management

- [ ] `.sentryclirc` in `.gitignore`
- [ ] `.env` files in `.gitignore`
- [ ] `SENTRY_AUTH_TOKEN` stored securely
- [ ] Auth token has minimal required scopes:
  - [ ] `project:read`
  - [ ] `project:releases`
  - [ ] `org:read`

### Source Map Protection

- [ ] Source maps use `hidden-source-map` (no references in bundles)
- [ ] `.map` files NOT served publicly
- [ ] Source maps uploaded to Sentry only
- [ ] Production bundles don't reference source maps

**Test Public Access:**
```bash
curl https://yourapp.com/_next/static/chunks/main-xxxxx.js.map
# Should return 404 or access denied
```

### CI/CD Security

- [ ] Environment variables in CI secrets (not hardcoded)
- [ ] Auth token rotated periodically
- [ ] Separate tokens for different environments
- [ ] Token access logged and monitored

---

## 🔧 Troubleshooting Checklist

### Source Maps Not Uploading

**Check:**
- [ ] `SENTRY_UPLOAD_SOURCEMAPS=true` is set
- [ ] `SENTRY_AUTH_TOKEN` is valid
- [ ] Organization and project slugs are correct
- [ ] Sentry CLI is installed (`sentry-cli --version`)
- [ ] `.next` directory exists and contains `.map` files

**Debug:**
```bash
# Test authentication
sentry-cli info

# Upload with verbose logging
sentry-cli sourcemaps upload --verbose .next
```

### Wrong Stack Traces

**Check:**
- [ ] Release version matches between client and upload
- [ ] `url-prefix` in `.sentryclirc` matches deployment
- [ ] Source maps uploaded for correct release
- [ ] Sentry SDK configured with same release

**Fix:**
```bash
# List releases
sentry-cli releases list

# Show release files
sentry-cli releases files $RELEASE list

# Delete and re-upload if needed
sentry-cli releases delete $RELEASE
npm run sentry:sourcemaps
```

### Authentication Errors

**Check:**
- [ ] Token has required scopes
- [ ] Token is not expired
- [ ] Organization/project slugs are correct
- [ ] Token is properly exported

**Fix:**
```bash
# Regenerate token at:
# https://sentry.io/settings/account/api/auth-tokens/

# Test new token
export SENTRY_AUTH_TOKEN="new-token-here"
sentry-cli info
```

---

## 📊 CI/CD Integration Checklist

### GitHub Actions

- [ ] Create `.github/workflows/deploy.yml`
- [ ] Add GitHub Secrets:
  - [ ] `SENTRY_DSN`
  - [ ] `SENTRY_AUTH_TOKEN`
  - [ ] `SENTRY_ORG`
  - [ ] `SENTRY_PROJECT`
- [ ] Build step configured
- [ ] Source map upload step configured
- [ ] Release creation step configured

### Vercel

- [ ] Environment variables configured:
  - [ ] `SENTRY_DSN` (exposed to client)
  - [ ] `SENTRY_AUTH_TOKEN` (server-only)
  - [ ] `SENTRY_ORG` (server-only)
  - [ ] `SENTRY_PROJECT` (server-only)
  - [ ] `SENTRY_UPLOAD_SOURCEMAPS=true`
- [ ] Build command updated
- [ ] Deploy hooks configured (optional)

### Docker

- [ ] Dockerfile includes build args for Sentry
- [ ] Multi-stage build configured
- [ ] Source maps excluded from final image
- [ ] Environment variables passed at build time

---

## ✅ Final Verification

### Before Going Live

- [ ] All environment variables configured
- [ ] Source maps upload successfully
- [ ] Test error shows readable stack trace
- [ ] `.map` files not publicly accessible
- [ ] Auth tokens stored securely
- [ ] CI/CD pipeline tested
- [ ] Team members have appropriate Sentry access

### Post-Deployment

- [ ] Monitor first errors in Sentry
- [ ] Verify stack traces are readable
- [ ] Check performance impact (minimal)
- [ ] Set up alerts for new issues
- [ ] Document the process for team

---

## 🆘 Quick Command Reference

```bash
# Build and test locally
npm run build
npm run sentry:sourcemaps

# Create release
npm run sentry:release

# Full deployment
npm run sentry:deploy

# Check configuration
sentry-cli info

# List releases
sentry-cli releases list --org $SENTRY_ORG --project $SENTRY_PROJECT

# Show release files
sentry-cli releases files $SENTRY_RELEASE list --org $SENTRY_ORG --project $SENTRY_PROJECT

# Delete release (for testing)
sentry-cli releases delete $SENTRY_RELEASE --org $SENTRY_ORG --project $SENTRY_PROJECT

# Validate source map
sentry-cli sourcemaps validate .next/static/chunks/main.js .next/static/chunks/main.js.map
```

---

## 📚 Additional Resources

- [Complete Setup Guide](./SENTRY_SOURCEMAPS_SETUP.md)
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry CLI Docs](https://docs.sentry.io/product/cli/)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)

---

**Last Updated:** 2025-10-05
**Status:** Ready for production deployment
