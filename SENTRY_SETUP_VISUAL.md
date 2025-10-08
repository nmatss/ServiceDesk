# Sentry Source Maps - Visual Setup Guide

## 🎯 Quick Overview

```
┌─────────────────────────────────────────────────────────────┐
│  SENTRY SOURCE MAPS CONFIGURATION                           │
│  Status: ✅ COMPLETE (Ready for credentials setup)          │
└─────────────────────────────────────────────────────────────┘

📦 Build Process Flow:
─────────────────────────────────────────────────────────────

  npm run build
       │
       ├──> Next.js Build
       │       │
       │       ├──> Generate Source Maps (.map files)
       │       │       └──> Hidden from public (security)
       │       │
       │       └──> Create Production Bundle
       │
       └──> postbuild Hook (automatic)
               │
               └──> scripts/sentry-upload-sourcemaps.js
                       │
                       ├──> 1. Validate Config
                       ├──> 2. Create Release
                       ├──> 3. Upload Source Maps
                       ├──> 4. Associate Commits
                       ├──> 5. Set Environment
                       └──> 6. Finalize Release
                               │
                               └──> ✅ Done!
```

---

## 📁 Configuration Files

```
ServiceDesk/
│
├── 📄 next.config.js                    ✅ Modified
│   ├── productionBrowserSourceMaps: true
│   └── devtool: 'hidden-source-map'
│
├── 📄 package.json                      ✅ Modified
│   └── scripts:
│       ├── sentry:sourcemaps            (upload all)
│       ├── sentry:sourcemaps:client     (client only)
│       ├── sentry:sourcemaps:server     (server only)
│       ├── sentry:release               (create release)
│       ├── sentry:deploy                (full workflow)
│       └── postbuild                    (auto-upload)
│
├── 📄 .sentryclirc                      ✅ Created
│   ├── [auth] token                     ⚠️ Needs update
│   ├── [defaults] org/project           ⚠️ Needs update
│   └── [sourcemaps] config              ✅ Ready
│
├── 📄 .env.example                      ✅ Updated
│   └── SENTRY_* variables               ✅ Documented
│
├── 📄 .gitignore                        ✅ Updated
│   ├── .sentryclirc                     (excluded)
│   └── .env*                            (excluded)
│
├── 📄 scripts/sentry-upload-sourcemaps.js  ✅ Created
│   └── Automated upload logic           ✅ Executable
│
└── 📚 Documentation/
    ├── SENTRY_SOURCEMAPS_SETUP.md       ✅ Complete guide
    ├── SENTRY_SOURCEMAPS_CHECKLIST.md   ✅ Verification
    ├── SENTRY_SETUP_README.md           ✅ Quick start
    └── SENTRY_CONFIGURATION_SUMMARY.md  ✅ Summary
```

---

## 🚀 5-Minute Setup

### Step 1: Install Sentry CLI
```bash
npm install -g @sentry/cli
sentry-cli --version  # Verify installation
```

### Step 2: Get Sentry Credentials

```
┌─────────────────────────────────────────────────────────┐
│  Go to: https://sentry.io                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📍 Sentry DSN (Public)                                 │
│     Settings → Projects → [Your Project] → Client Keys  │
│     Copy: https://xxxxx@xxxxx.ingest.sentry.io/xxxxx   │
│                                                          │
│  🔑 Auth Token (Secret)                                 │
│     Settings → Account → API → Auth Tokens              │
│     Create with scopes:                                 │
│       ✓ project:read                                    │
│       ✓ project:releases                                │
│       ✓ org:read                                        │
│                                                          │
│  🏢 Organization & Project Slugs                        │
│     Found in URL:                                       │
│     /organizations/[ORG_SLUG]/projects/[PROJECT_SLUG]/  │
└─────────────────────────────────────────────────────────┘
```

### Step 3: Configure .sentryclirc

```bash
# Edit .sentryclirc
nano .sentryclirc

# Replace placeholders:
[auth]
token=YOUR_ACTUAL_SENTRY_AUTH_TOKEN_HERE

[defaults]
org=your-actual-organization-slug
project=your-actual-project-slug
```

### Step 4: Set Environment Variables

```bash
# Create .env file
cp .env.example .env

# Add to .env:
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=servicedesk
SENTRY_UPLOAD_SOURCEMAPS=true
SENTRY_ENVIRONMENT=production
```

### Step 5: Test Configuration

```bash
# 1. Test Sentry CLI authentication
sentry-cli info

# 2. Build with source maps
npm run build

# 3. Verify source maps exist
find .next -name "*.map" | head -5

# 4. Test upload
npm run sentry:sourcemaps

# 5. Check Sentry dashboard
# Visit: https://sentry.io/organizations/[ORG]/releases/
```

---

## 🔄 How It Works

### Development Mode
```
npm run dev
   │
   └──> SENTRY_UPLOAD_SOURCEMAPS=false
           │
           └──> No upload (local development)
```

### Production Build
```
npm run build
   │
   ├──> Generate source maps
   │       │
   │       └──> .next/static/chunks/*.map
   │            .next/server/**/*.map
   │
   └──> postbuild hook
           │
           └──> Check SENTRY_UPLOAD_SOURCEMAPS
                   │
                   ├──> true  → Upload to Sentry ✅
                   └──> false → Skip upload ⏭️
```

### Error Tracking Flow
```
User triggers error in production
   │
   ├──> Error sent to Sentry (via SENTRY_DSN)
   │
   ├──> Sentry matches error to release
   │
   ├──> Looks up source maps for that release
   │
   └──> Displays readable stack trace
           │
           ├──> Original file names ✅
           ├──> Exact line numbers ✅
           ├──> Variable names ✅
           └──> Surrounding code ✅
```

---

## 🧪 Testing Your Setup

### 1. Add Test Error Component

```javascript
// pages/test-sentry.tsx
import { useEffect } from 'react';

export default function TestSentry() {
  useEffect(() => {
    // This will trigger a test error
    throw new Error('🧪 Test error for Sentry source maps');
  }, []);

  return <div>Testing Sentry...</div>;
}
```

### 2. Trigger the Error

```bash
# Visit in browser:
https://yourapp.com/test-sentry
```

### 3. Verify in Sentry

```
┌────────────────────────────────────────────────────┐
│  Sentry Dashboard → Issues → [Your Test Error]     │
├────────────────────────────────────────────────────┤
│                                                     │
│  ✅ Should Show:                                   │
│     • Original file name (test-sentry.tsx)         │
│     • Exact line number (line 6)                   │
│     • Function name (useEffect)                    │
│     • Surrounding source code                      │
│                                                     │
│  ❌ Should NOT Show:                               │
│     • Minified code (e.g., function a(){...})      │
│     • Generic file names (main.js)                 │
│     • Wrong line numbers                           │
└────────────────────────────────────────────────────┘
```

---

## 🔒 Security Checklist

```
Security Item                              Status
────────────────────────────────────────────────────
.sentryclirc in .gitignore                 ✅ Yes
.env files in .gitignore                   ✅ Yes
Auth token stored securely                 ⚠️ Your action
Source maps hidden from public             ✅ Yes
Token has minimal scopes                   ⚠️ Verify
Production bundles don't reference maps    ✅ Yes
CI/CD uses secrets for tokens              ⚠️ Setup needed
```

---

## 📊 Available Commands

```bash
# ────────────────────────────────────────────────────────
# BUILD & UPLOAD
# ────────────────────────────────────────────────────────

npm run build                   # Build + auto-upload (if enabled)
npm run sentry:deploy          # Build + upload + release

# ────────────────────────────────────────────────────────
# MANUAL UPLOAD
# ────────────────────────────────────────────────────────

npm run sentry:sourcemaps       # Upload all source maps
npm run sentry:sourcemaps:client   # Upload client maps only
npm run sentry:sourcemaps:server   # Upload server maps only

# ────────────────────────────────────────────────────────
# RELEASE MANAGEMENT
# ────────────────────────────────────────────────────────

npm run sentry:release          # Create & finalize release

# ────────────────────────────────────────────────────────
# DEBUGGING
# ────────────────────────────────────────────────────────

sentry-cli info                 # Check auth & config
sentry-cli releases list        # List all releases
find .next -name "*.map"        # Find source maps
```

---

## 🔧 Common Issues & Fixes

### Issue 1: "401 Unauthorized"

```
❌ Problem: Authentication failed
✅ Solution:
   1. Regenerate token at: https://sentry.io/settings/account/api/auth-tokens/
   2. Ensure scopes: project:read, project:releases, org:read
   3. Update .sentryclirc and environment variables
```

### Issue 2: "No source maps found"

```
❌ Problem: Build didn't generate source maps
✅ Solution:
   1. Check next.config.js:
      productionBrowserSourceMaps: true  ✅
   2. Run: npm run build
   3. Verify: find .next -name "*.map"
```

### Issue 3: "Wrong stack traces"

```
❌ Problem: Sentry shows minified code
✅ Solution:
   1. Check release version matches:
      echo $SENTRY_RELEASE
   2. Verify maps uploaded:
      sentry-cli releases files $SENTRY_RELEASE list
   3. Re-upload if needed:
      npm run sentry:sourcemaps
```

---

## 📚 Documentation Reference

```
┌─────────────────────────────────────────────────────────┐
│  Document                          │  Use When           │
├────────────────────────────────────┼─────────────────────┤
│  SENTRY_SETUP_README.md           │  Quick start (5min) │
│  SENTRY_SOURCEMAPS_SETUP.md       │  Detailed guide     │
│  SENTRY_SOURCEMAPS_CHECKLIST.md   │  Step-by-step       │
│  SENTRY_CONFIGURATION_SUMMARY.md  │  Full summary       │
│  SENTRY_SETUP_VISUAL.md           │  This visual guide  │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Final Checklist

```
Pre-Deployment
─────────────────────────────────────────────
[x] Build configuration complete
[x] NPM scripts added
[x] Upload script created
[x] Documentation written
[x] Security configured (.gitignore)

Setup Required (Your Action)
─────────────────────────────────────────────
[ ] Sentry CLI installed
[ ] Sentry account created
[ ] Auth token generated
[ ] .sentryclirc updated
[ ] Environment variables configured
[ ] Test build completed
[ ] Source maps uploaded
[ ] Test error verified in Sentry

Production Ready
─────────────────────────────────────────────
[ ] CI/CD configured
[ ] Source maps not publicly accessible
[ ] Team access configured in Sentry
[ ] Monitoring alerts set up
```

---

## 🎯 Summary

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  ✅ CONFIGURATION COMPLETE                              │
│                                                          │
│  What's Done:                                           │
│    • Build settings configured                          │
│    • Upload automation ready                            │
│    • Security measures in place                         │
│    • Complete documentation                             │
│                                                          │
│  What's Needed:                                         │
│    • Sentry account setup                               │
│    • Credentials configuration                          │
│    • Testing & verification                             │
│                                                          │
│  Time to Production: 5-10 minutes                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**Created:** 2025-10-05  
**Status:** Ready for deployment  
**Next Step:** Get Sentry credentials and configure .sentryclirc
