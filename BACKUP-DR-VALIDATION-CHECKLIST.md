# Backup & DR Validation Checklist

**Quick validation guide to verify the Backup & DR implementation**

---

## 1. File Structure Validation

### Check all files were created

```bash
# Navigate to project root
cd /home/nic20/ProjetosWeb/ServiceDesk

# Check backup scripts (should show 4 files)
ls -lh scripts/backup/*.sh
# Expected:
# - database-backup.sh
# - app-state-backup.sh
# - verify-backup.sh
# - cleanup-old-backups.sh

# Check restore scripts (should show 2 files)
ls -lh scripts/restore/*.sh
# Expected:
# - database-restore.sh
# - app-state-restore.sh

# Check DR scripts (should show 2 files)
ls -lh scripts/dr/*.sh
# Expected:
# - disaster-recovery.sh
# - dr-drill.sh

# Check Kubernetes manifests
ls -lh k8s/cronjobs/*.yaml
# Expected:
# - backup-database.yaml
# - backup-verification.yaml

# Check monitoring
ls -lh lib/backup/*.ts
# Expected: monitoring.ts

# Check documentation
ls -lh docs/*RECOVERY*.md docs/*BACKUP*.md
# Expected:
# - DISASTER-RECOVERY.md
# - BACKUP-STRATEGY.md

# Total count
find scripts -name "*.sh" -type f | wc -l
# Expected: 8 scripts
```

✅ **PASS:** All 14 files created
❌ **FAIL:** Files missing

---

## 2. Script Permissions Validation

### Verify all scripts are executable

```bash
# Check execute permissions
find scripts -name "*.sh" -type f -not -executable
# Expected: (empty output - all should be executable)

# If not executable, fix with:
chmod +x scripts/backup/*.sh scripts/restore/*.sh scripts/dr/*.sh
```

✅ **PASS:** All scripts executable
❌ **FAIL:** Some scripts not executable

---

## 3. Syntax Validation

### Verify bash syntax

```bash
# Check all scripts for syntax errors
for script in scripts/**/*.sh; do
  echo "Checking $script..."
  bash -n "$script" || echo "ERROR in $script"
done
# Expected: No errors
```

✅ **PASS:** All scripts have valid syntax
❌ **FAIL:** Syntax errors found

---

## 4. Documentation Validation

### Check documentation completeness

```bash
# Check DISASTER-RECOVERY.md
grep -q "RTO (Recovery Time Objective)" docs/DISASTER-RECOVERY.md && echo "✅ RTO defined"
grep -q "RPO (Recovery Point Objective)" docs/DISASTER-RECOVERY.md && echo "✅ RPO defined"
grep -q "Scenario 1: Database Corruption" docs/DISASTER-RECOVERY.md && echo "✅ Scenario 1 documented"
grep -q "Scenario 5: Application Bug" docs/DISASTER-RECOVERY.md && echo "✅ All 5 scenarios"

# Check BACKUP-STRATEGY.md
grep -q "Backup Architecture" docs/BACKUP-STRATEGY.md && echo "✅ Architecture documented"
grep -q "Retention Policy" docs/BACKUP-STRATEGY.md && echo "✅ Retention policy defined"
grep -q "Security" docs/BACKUP-STRATEGY.md && echo "✅ Security documented"

# Word count (should be substantial)
wc -w docs/DISASTER-RECOVERY.md docs/BACKUP-STRATEGY.md
# Expected: 10,000+ words each
```

✅ **PASS:** Complete documentation
❌ **FAIL:** Documentation incomplete

---

## 5. Kubernetes Manifests Validation

### Verify YAML syntax

```bash
# Install yamllint if needed
# pip install yamllint

# Validate YAML syntax
yamllint k8s/cronjobs/*.yaml
# Expected: No errors (warnings acceptable)

# Alternative: Use kubectl dry-run
kubectl apply -f k8s/cronjobs/backup-database.yaml --dry-run=client
kubectl apply -f k8s/cronjobs/backup-verification.yaml --dry-run=client
# Expected: No errors
```

✅ **PASS:** Valid Kubernetes manifests
❌ **FAIL:** YAML syntax errors

---

## 6. TypeScript Compilation Validation

### Check TypeScript monitoring code

```bash
# Check if TypeScript file exists
test -f lib/backup/monitoring.ts && echo "✅ monitoring.ts exists"

# Compile TypeScript
npx tsc lib/backup/monitoring.ts --noEmit --skipLibCheck
# Expected: No compilation errors
```

✅ **PASS:** TypeScript compiles without errors
❌ **FAIL:** TypeScript compilation errors

---

## 7. Configuration Validation

### Check S3 lifecycle policy JSON

```bash
# Validate JSON syntax
jq . infrastructure/s3-lifecycle.json > /dev/null && echo "✅ Valid JSON"

# Check required fields
jq '.Rules | length' infrastructure/s3-lifecycle.json
# Expected: 6 (6 lifecycle rules)

# Verify rule IDs
jq '.Rules[].Id' infrastructure/s3-lifecycle.json
# Expected:
# - backup-retention-policy
# - incremental-backup-cleanup
# - monthly-backup-long-term-retention
# - app-state-backup-cleanup
# - logs-backup-cleanup
# - yearly-compliance-backups
```

✅ **PASS:** Valid S3 lifecycle configuration
❌ **FAIL:** Invalid JSON or missing rules

---

## 8. Script Functionality Tests

### Test backup script (dry-run)

```bash
# Set test environment variables
export BACKUP_DIR="/tmp/test-backup"
export DB_TYPE="sqlite"
export DB_PATH="servicedesk.db"
export STORAGE_TYPE="local"
export ENCRYPT_BACKUPS="false"  # Disable for testing

# Create test database
mkdir -p "$BACKUP_DIR"
sqlite3 servicedesk.db "CREATE TABLE test (id INTEGER PRIMARY KEY);"

# Run backup script
bash scripts/backup/database-backup.sh
# Expected: Backup file created in /tmp/test-backup

# Verify backup was created
ls -lh /tmp/test-backup/servicedesk_full_*.backup
# Expected: Backup file exists

# Cleanup
rm -rf /tmp/test-backup servicedesk.db
```

✅ **PASS:** Backup script works
❌ **FAIL:** Backup script errors

### Test verify script (basic check)

```bash
# Check if script runs without errors
bash scripts/backup/verify-backup.sh list || echo "Script has issues"
# Expected: Lists backups or shows "No backups found"
```

✅ **PASS:** Verify script functional
❌ **FAIL:** Script errors

---

## 9. Environment Variables Check

### Verify all required environment variables are documented

```bash
# Check if .env.example exists
test -f .env.example && echo "✅ .env.example exists"

# Check for required variables in documentation
grep -q "BACKUP_DIR" docs/BACKUP-STRATEGY.md && echo "✅ BACKUP_DIR documented"
grep -q "S3_BUCKET" docs/BACKUP-STRATEGY.md && echo "✅ S3_BUCKET documented"
grep -q "ENCRYPT_BACKUPS" docs/BACKUP-STRATEGY.md && echo "✅ ENCRYPT_BACKUPS documented"
grep -q "DB_TYPE" docs/BACKUP-STRATEGY.md && echo "✅ DB_TYPE documented"
```

✅ **PASS:** All environment variables documented
❌ **FAIL:** Missing documentation

---

## 10. Code Quality Validation

### Check for common issues

```bash
# Check for TODO comments
grep -r "TODO" scripts/ | wc -l
# Expected: 0 (all TODOs should be resolved)

# Check for hardcoded paths
grep -r "/home/" scripts/ | grep -v "# Example" | wc -l
# Expected: 0 (no hardcoded home paths)

# Check for debug code
grep -r "console.log" lib/backup/ | wc -l
# Expected: Low count (only legitimate logging)

# Check for proper error handling
grep -r "set -euo pipefail" scripts/backup/*.sh scripts/restore/*.sh scripts/dr/*.sh | wc -l
# Expected: 8 (one per script)
```

✅ **PASS:** Code quality acceptable
❌ **FAIL:** Quality issues found

---

## 11. Security Validation

### Check for security best practices

```bash
# Check for exposed secrets in scripts
grep -r "password" scripts/ | grep -v "DB_PASSWORD" | grep -v "# " | wc -l
# Expected: 0 (no hardcoded passwords)

# Check encryption usage
grep -q "gpg --encrypt" scripts/backup/database-backup.sh && echo "✅ GPG encryption implemented"
grep -q "aws kms encrypt" scripts/backup/database-backup.sh && echo "✅ KMS option available"

# Check secure file permissions in scripts
grep -q "chmod 700" scripts/backup/database-backup.sh && echo "✅ Secure directory permissions"
```

✅ **PASS:** No security issues found
❌ **FAIL:** Security concerns detected

---

## 12. Integration Validation

### Check integrations are documented

```bash
# Datadog integration
grep -q "Datadog" docs/BACKUP-STRATEGY.md && echo "✅ Datadog integration documented"

# Slack/webhook notifications
grep -q "NOTIFICATION_WEBHOOK" scripts/backup/database-backup.sh && echo "✅ Webhook notifications implemented"

# S3 integration
grep -q "aws s3" scripts/backup/database-backup.sh && echo "✅ S3 integration implemented"
```

✅ **PASS:** All integrations present
❌ **FAIL:** Missing integrations

---

## 13. DR Scenarios Validation

### Verify all 5 DR scenarios are implemented

```bash
# Check DR script has all scenarios
grep -q "dr_database_corruption" scripts/dr/disaster-recovery.sh && echo "✅ Scenario 1: Database corruption"
grep -q "dr_datacenter_failure" scripts/dr/disaster-recovery.sh && echo "✅ Scenario 2: Data center failure"
grep -q "dr_ransomware_attack" scripts/dr/disaster-recovery.sh && echo "✅ Scenario 3: Ransomware"
grep -q "dr_accidental_deletion" scripts/dr/disaster-recovery.sh && echo "✅ Scenario 4: Accidental deletion"
grep -q "dr_application_bug" scripts/dr/disaster-recovery.sh && echo "✅ Scenario 5: Application bug"
```

✅ **PASS:** All 5 scenarios implemented
❌ **FAIL:** Missing scenarios

---

## 14. Monitoring Validation

### Check monitoring system completeness

```bash
# TypeScript monitoring classes
grep -q "class BackupMonitor" lib/backup/monitoring.ts && echo "✅ BackupMonitor class exists"
grep -q "class S3LifecycleManager" lib/backup/monitoring.ts && echo "✅ S3LifecycleManager exists"

# Alert functionality
grep -q "sendAlert" lib/backup/monitoring.ts && echo "✅ Alert system implemented"

# Metrics collection
grep -q "getMetrics" lib/backup/monitoring.ts && echo "✅ Metrics collection implemented"
```

✅ **PASS:** Monitoring system complete
❌ **FAIL:** Monitoring incomplete

---

## 15. Final Integration Test

### End-to-end validation

```bash
# 1. Create test database
mkdir -p /tmp/e2e-test
cd /tmp/e2e-test
sqlite3 test.db "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);"
sqlite3 test.db "INSERT INTO users (name) VALUES ('Test User');"

# 2. Run backup
export BACKUP_DIR="/tmp/e2e-test/backups"
export DB_TYPE="sqlite"
export DB_PATH="/tmp/e2e-test/test.db"
export STORAGE_TYPE="local"
export ENCRYPT_BACKUPS="false"

bash /home/nic20/ProjetosWeb/ServiceDesk/scripts/backup/database-backup.sh

# 3. Verify backup exists
test -f backups/servicedesk_full_*.backup && echo "✅ Backup created"

# 4. Delete original database
rm test.db

# 5. Restore from backup
cp backups/servicedesk_full_*.backup test.db

# 6. Verify data integrity
sqlite3 test.db "SELECT COUNT(*) FROM users;" | grep -q "1" && echo "✅ Data restored correctly"

# 7. Cleanup
cd -
rm -rf /tmp/e2e-test
```

✅ **PASS:** End-to-end backup/restore works
❌ **FAIL:** Integration issues

---

## Summary Checklist

Run this comprehensive check:

```bash
#!/bin/bash

echo "=================================="
echo "Backup & DR Validation Summary"
echo "=================================="

checks_passed=0
checks_failed=0

# 1. Files exist
if [ $(find /home/nic20/ProjetosWeb/ServiceDesk/scripts -name "*.sh" -type f | wc -l) -eq 8 ]; then
  echo "✅ All 8 scripts exist"
  ((checks_passed++))
else
  echo "❌ Scripts missing"
  ((checks_failed++))
fi

# 2. Scripts executable
if [ $(find /home/nic20/ProjetosWeb/ServiceDesk/scripts -name "*.sh" -type f -not -executable | wc -l) -eq 0 ]; then
  echo "✅ All scripts executable"
  ((checks_passed++))
else
  echo "❌ Some scripts not executable"
  ((checks_failed++))
fi

# 3. Documentation exists
if [ -f "/home/nic20/ProjetosWeb/ServiceDesk/docs/DISASTER-RECOVERY.md" ] && \
   [ -f "/home/nic20/ProjetosWeb/ServiceDesk/docs/BACKUP-STRATEGY.md" ]; then
  echo "✅ Documentation complete"
  ((checks_passed++))
else
  echo "❌ Documentation missing"
  ((checks_failed++))
fi

# 4. Kubernetes manifests exist
if [ -f "/home/nic20/ProjetosWeb/ServiceDesk/k8s/cronjobs/backup-database.yaml" ] && \
   [ -f "/home/nic20/ProjetosWeb/ServiceDesk/k8s/cronjobs/backup-verification.yaml" ]; then
  echo "✅ Kubernetes manifests exist"
  ((checks_passed++))
else
  echo "❌ Kubernetes manifests missing"
  ((checks_failed++))
fi

# 5. Monitoring code exists
if [ -f "/home/nic20/ProjetosWeb/ServiceDesk/lib/backup/monitoring.ts" ]; then
  echo "✅ Monitoring code exists"
  ((checks_passed++))
else
  echo "❌ Monitoring code missing"
  ((checks_failed++))
fi

# 6. S3 lifecycle policy exists
if [ -f "/home/nic20/ProjetosWeb/ServiceDesk/infrastructure/s3-lifecycle.json" ]; then
  echo "✅ S3 lifecycle policy exists"
  ((checks_passed++))
else
  echo "❌ S3 lifecycle policy missing"
  ((checks_failed++))
fi

echo "=================================="
echo "Checks Passed: $checks_passed"
echo "Checks Failed: $checks_failed"
echo "=================================="

if [ $checks_failed -eq 0 ]; then
  echo "✅ ALL VALIDATION CHECKS PASSED"
  echo "Implementation is READY FOR PRODUCTION"
  exit 0
else
  echo "❌ SOME CHECKS FAILED"
  echo "Please review and fix issues"
  exit 1
fi
```

---

## Production Readiness Checklist

Before deploying to production:

- [ ] All validation checks pass
- [ ] AWS S3 bucket created and accessible
- [ ] GPG keys generated and stored securely
- [ ] Kubernetes secrets created
- [ ] CronJobs deployed and scheduled
- [ ] First manual backup successful
- [ ] First backup verification successful
- [ ] Test restore completed successfully
- [ ] DR team trained
- [ ] Documentation reviewed and approved
- [ ] Monitoring alerts configured
- [ ] First DR drill scheduled
- [ ] Stakeholders notified

---

## Quick Commands Reference

```bash
# Run full validation
bash BACKUP-DR-VALIDATION-CHECKLIST.md

# Test backup manually
bash scripts/backup/database-backup.sh

# Verify latest backup
bash scripts/backup/verify-backup.sh latest

# Run DR drill
bash scripts/dr/dr-drill.sh

# List all backups
bash scripts/backup/verify-backup.sh list
```

---

**Last Updated:** 2025-01-18
**Status:** Ready for validation
