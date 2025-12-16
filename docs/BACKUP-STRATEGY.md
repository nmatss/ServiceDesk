# Backup & Recovery Strategy - ServiceDesk

## Overview

This document outlines the comprehensive backup and recovery strategy for the ServiceDesk application, ensuring data protection, business continuity, and compliance with regulatory requirements.

## Table of Contents

1. [Backup Architecture](#backup-architecture)
2. [Backup Types](#backup-types)
3. [Retention Policy](#retention-policy)
4. [Security](#security)
5. [Monitoring](#monitoring)
6. [Restoration Procedures](#restoration-procedures)
7. [Automation](#automation)
8. [Compliance](#compliance)

---

## Backup Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    ServiceDesk Production                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Database   │  │ File Uploads │  │ App Config   │          │
│  │  (SQLite/PG) │  │     (S3)     │  │   (.env)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
└─────────┼─────────────────┼──────────────────┼───────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backup System                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ DB Backup    │  │ State Backup │  │ Verification │          │
│  │  (Cron)      │  │   (Cron)     │  │   (Cron)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                       │
│                    ┌──────▼──────┐                               │
│                    │  Encryption  │                               │
│                    │  (GPG/KMS)   │                               │
│                    └──────┬──────┘                               │
└───────────────────────────┼───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Layers                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  S3 Standard (0-30 days)                                │    │
│  │  - Hot backups                                           │    │
│  │  - Quick restore                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  S3 Standard-IA (31-90 days)                            │    │
│  │  - Infrequent access                                     │    │
│  │  - Cost optimized                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  S3 Glacier (91-365 days)                               │    │
│  │  - Archive storage                                       │    │
│  │  - Lower cost                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  S3 Deep Archive (365+ days)                            │    │
│  │  - Compliance retention                                  │    │
│  │  - Lowest cost                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backup Types

### 1. Full Database Backup

**Purpose:** Complete snapshot of database at a point in time

**Frequency:** Daily at 2:00 AM UTC

**Components:**
- All database tables
- Indexes and constraints
- Stored procedures (if any)
- Database metadata

**Size:** ~500MB - 2GB (depends on data growth)

**Duration:** 10-30 minutes

**Script:**
```bash
bash scripts/backup/database-backup.sh
```

**Kubernetes CronJob:**
```yaml
schedule: "0 2 * * *"  # Daily at 2 AM UTC
```

### 2. Incremental Backup

**Purpose:** Capture changes since last backup

**Frequency:** Every 6 hours (2:00, 8:00, 14:00, 20:00 UTC)

**Components:**
- Changed data only
- Transaction logs (PostgreSQL WAL)
- Delta from last full backup

**Size:** ~50MB - 200MB per increment

**Duration:** 5-15 minutes

**Script:**
```bash
BACKUP_TYPE=incremental bash scripts/backup/database-backup.sh
```

**Kubernetes CronJob:**
```yaml
schedule: "0 */6 * * *"  # Every 6 hours
```

### 3. Application State Backup

**Purpose:** Preserve application configuration and uploaded files

**Frequency:** Daily at 3:00 AM UTC

**Components:**
- File uploads (S3 sync)
- Configuration files
  - `next.config.js`
  - `tailwind.config.js`
  - `package.json`
- Environment variables (encrypted)
- Recent logs (last 7 days)

**Size:** Variable (depends on file uploads)

**Duration:** 15-45 minutes

**Script:**
```bash
bash scripts/backup/app-state-backup.sh
```

### 4. Monthly Archive Backup

**Purpose:** Long-term compliance retention

**Frequency:** 1st of each month at 1:00 AM UTC

**Components:**
- Full database snapshot
- Application state
- Compliance metadata

**Retention:** 7 years (compliance requirement)

**Storage:** S3 Deep Archive

---

## Retention Policy

### Standard Retention

| Backup Type | Frequency | Hot Storage | Archive | Total Retention |
|------------|-----------|-------------|---------|-----------------|
| Full | Daily | 30 days | 12 months | 395 days |
| Incremental | 6 hours | 7 days | - | 7 days |
| App State | Daily | 30 days | 90 days | 120 days |
| Monthly | Monthly | - | 7 years | 2555 days |

### Storage Lifecycle

```
Day 0-30:   S3 Standard (immediate access)
Day 31-90:  S3 Standard-IA (minutes to access)
Day 91-365: S3 Glacier IR (hours to access)
Day 365+:   S3 Deep Archive (12-48 hours to access)
```

### Cleanup Policy

**Daily Backups:**
- Keep last 30 daily backups in Standard
- Move to IA after 30 days
- Move to Glacier after 90 days
- Delete after 365 days (except monthly)

**Incremental Backups:**
- Keep last 7 days only
- Auto-delete after 7 days

**Monthly Backups:**
- Keep 12 months in Glacier
- Move to Deep Archive after 1 year
- Retain for 7 years (compliance)

---

## Security

### Encryption at Rest

**Method:** GPG + AWS KMS

**Implementation:**
```bash
# GPG encryption
gpg --recipient backup@servicedesk.com \
    --encrypt \
    --output backup.gz.gpg \
    backup.gz

# AWS KMS encryption
aws kms encrypt \
    --key-id alias/servicedesk-backup \
    --plaintext fileb://backup.gz \
    --output text \
    --query CiphertextBlob | base64 -d > backup.gz.enc
```

**Key Management:**
- GPG keys stored in Kubernetes secrets
- AWS KMS keys in dedicated AWS account
- Key rotation every 90 days
- Separate keys for prod/staging

### Encryption in Transit

**Method:** TLS 1.3

**Implementation:**
- AWS S3 transfer encryption (TLS)
- VPC endpoints for private S3 access
- No public S3 access allowed

### Access Control

**IAM Policies:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::servicedesk-backups/backups/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

**Bucket Policies:**
- Block public access
- Enforce encryption
- MFA delete enabled
- Versioning enabled
- Object Lock (WORM) for compliance backups

### Immutable Backups

**S3 Object Lock:**
```json
{
  "ObjectLockEnabled": "Enabled",
  "ObjectLockConfiguration": {
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 90
      }
    }
  }
}
```

**Benefits:**
- Protection against ransomware
- Prevent accidental deletion
- Compliance requirement (LGPD)

---

## Monitoring

### Backup Job Monitoring

**Metrics Tracked:**
- Backup success/failure rate
- Backup duration
- Backup size
- Last backup timestamp
- Storage utilization

**Implementation:**
```typescript
import { backupMonitor } from '@/lib/backup/monitoring';

// Register job
const jobId = await backupMonitor.registerJob('full');

// Update status
await backupMonitor.updateJobStatus(jobId, 'completed', {
  sizeBytes: 1024 * 1024 * 500,  // 500MB
});

// Check health
const health = await backupMonitor.checkHealth();
```

### Alerting

**Alert Conditions:**
- Backup failure
- Backup not run in 24 hours
- Backup size anomaly (too small/large)
- Backup duration > 1 hour
- Failure rate > 10%
- Storage quota > 80%

**Notification Channels:**
- Slack #ops-alerts
- PagerDuty (critical only)
- Email (backup-alerts@servicedesk.com)
- Datadog events

**Alert Levels:**
- **INFO:** Backup completed successfully
- **WARNING:** Backup size anomaly, duration warning
- **CRITICAL:** Backup failure, no recent backup

### Datadog Integration

```typescript
// lib/backup/datadog.ts
import StatsD from 'hot-shots';

const statsd = new StatsD({
  host: process.env.DD_AGENT_HOST,
  prefix: 'servicedesk.backup.',
});

// Track metrics
statsd.increment('jobs.started', 1, ['type:full']);
statsd.histogram('duration', durationMs, ['type:full']);
statsd.gauge('size', sizeBytes, ['type:full']);
```

**Datadog Monitors:**
```
Backup Failure Rate:
  avg(last_1h):sum:servicedesk.backup.jobs.failed{*}.as_count() > 2

No Recent Backup:
  max(last_24h):max:servicedesk.backup.last_success{*} > 86400

Backup Size Anomaly:
  avg(last_4h):anomalies(avg:servicedesk.backup.size{*}, 'basic', 2)
```

---

## Restoration Procedures

### Quick Restore (RTO: 2 hours)

**Scenario:** Production database corruption

```bash
# 1. Stop application
kubectl scale deployment/servicedesk --replicas=0

# 2. Restore database
bash scripts/restore/database-restore.sh --backup-file latest

# 3. Verify restoration
bash scripts/backup/verify-backup.sh latest

# 4. Start application
kubectl scale deployment/servicedesk --replicas=3

# 5. Health check
curl https://servicedesk.com/api/health
```

### Selective Restore

**Scenario:** Accidental table deletion

```bash
# Restore specific tables only
bash scripts/restore/database-restore.sh \
  --tables users,tickets \
  --dry-run  # Test first

# Execute restore
bash scripts/restore/database-restore.sh \
  --tables users,tickets
```

### Point-in-Time Recovery (PostgreSQL)

**Scenario:** Restore to specific timestamp

```bash
# Restore to exact time
bash scripts/restore/database-restore.sh \
  --pitr "2025-01-18 14:30:00"
```

**Requirements:**
- PostgreSQL with WAL archiving enabled
- Continuous archiving configured
- Base backup + WAL files available

### Disaster Recovery

**Scenario:** Complete data center failure

```bash
# Execute DR plan
export RECOVERY_REGION=us-west-2
bash scripts/dr/disaster-recovery.sh

# Select scenario: datacenter_failure
```

See [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) for complete procedures.

---

## Automation

### Kubernetes CronJobs

**Deployed Jobs:**
```bash
# List backup CronJobs
kubectl get cronjobs -n servicedesk | grep backup

# Output:
# servicedesk-database-backup-full         0 2 * * *
# servicedesk-database-backup-incremental  0 */6 * * *
# servicedesk-app-state-backup             0 3 * * *
# servicedesk-backup-verification          0 4 * * 0
# servicedesk-backup-cleanup               0 5 * * *
```

**Manual Trigger:**
```bash
# Trigger backup manually
kubectl create job --from=cronjob/servicedesk-database-backup-full manual-backup-$(date +%s)

# Watch job progress
kubectl logs -f job/manual-backup-1234567890
```

### CI/CD Integration

**Pre-deployment Backup:**
```yaml
# .github/workflows/deploy.yml
- name: Create pre-deployment backup
  run: |
    kubectl create job \
      --from=cronjob/servicedesk-database-backup-full \
      pre-deploy-backup-${{ github.sha }}

    # Wait for backup completion
    kubectl wait --for=condition=complete \
      job/pre-deploy-backup-${{ github.sha }} \
      --timeout=30m
```

---

## Compliance

### LGPD (Brazil)

**Requirements:**
- Data retention: 5 years minimum
- Encrypted backups: Yes (GPG + KMS)
- Audit trail: Complete backup logs
- Data deletion: Secure erasure after retention

**Implementation:**
- Monthly compliance backups → Deep Archive
- 7-year retention for sensitive data
- Encrypted at rest and in transit
- Access logs retained 2 years

### SOC 2

**Requirements:**
- Backup testing: Quarterly
- Documented procedures: Yes
- Access controls: RBAC
- Monitoring: 24/7

**Implementation:**
- Automated weekly verification
- DR drills quarterly
- Comprehensive documentation
- Datadog monitoring + alerts

### ISO 27001

**Requirements:**
- Backup strategy documented: Yes
- Regular testing: Yes
- Offsite storage: Yes (multi-region)
- Recovery procedures: Documented

**Implementation:**
- This document
- Monthly DR tests
- S3 cross-region replication
- Disaster recovery plan

---

## Testing & Validation

### Weekly Verification (Automated)

**Schedule:** Every Sunday at 4:00 AM UTC

**Process:**
```bash
# Automated by Kubernetes CronJob
# scripts/backup/verify-backup.sh

1. Download latest backup
2. Verify checksum (SHA-256)
3. Test decryption
4. Test decompression
5. Restore to isolated environment
6. Verify database integrity
7. Send notification (success/failure)
```

**Success Criteria:**
- Checksum matches ✓
- Decryption successful ✓
- Decompression successful ✓
- Database integrity check passes ✓
- All tables present ✓

### Monthly DR Drill

**Schedule:** First Saturday of each month

**Procedure:**
1. Select DR scenario
2. Assemble DR team
3. Execute full recovery
4. Measure RTO/RPO
5. Document lessons learned
6. Update procedures

**Scenarios Rotated:**
- Month 1: Database corruption
- Month 2: Accidental deletion
- Month 3: Application bug
- Month 4: Ransomware (simulated)

### Quarterly Full Test

**Schedule:** End of each quarter

**Scope:**
- Complete data center failover
- All team members participate
- External stakeholders involved
- Full documentation

**Deliverables:**
- Test report
- RTO/RPO measurements
- Improvement recommendations
- Updated DR plan

---

## Backup Costs

### Storage Costs (Monthly Estimate)

| Storage Tier | Usage | Cost/GB | Monthly Cost |
|--------------|-------|---------|--------------|
| S3 Standard | 60GB | $0.023 | $1.38 |
| S3 Standard-IA | 180GB | $0.0125 | $2.25 |
| S3 Glacier IR | 500GB | $0.004 | $2.00 |
| S3 Deep Archive | 2TB | $0.00099 | $2.02 |
| **Total** | **2.74TB** | | **$7.65** |

### Operations Costs

| Operation | Monthly Volume | Cost |
|-----------|----------------|------|
| PUT requests | 500 | $0.003 |
| GET requests | 100 | $0.0004 |
| Glacier retrieval | 2 | $0.02 |
| Data transfer | 10GB | $0.90 |
| **Total Operations** | | **$0.92** |

### Infrastructure Costs

| Resource | Monthly Cost |
|----------|--------------|
| Backup PVC (100GB) | $10 |
| Kubernetes CronJobs | $5 |
| Monitoring/Alerts | $3 |
| **Total Infrastructure** | **$18** |

**Total Monthly Cost:** ~$26.57

**Annual Cost:** ~$319

---

## Quick Reference

### Common Commands

```bash
# List backups
bash scripts/backup/verify-backup.sh list

# Manual backup
bash scripts/backup/database-backup.sh

# Verify latest backup
bash scripts/backup/verify-backup.sh latest

# Restore from latest
bash scripts/restore/database-restore.sh --backup-file latest

# DR scenario
bash scripts/dr/disaster-recovery.sh

# Check backup health
kubectl exec -it deployment/servicedesk -- \
  node -e "require('./lib/backup/monitoring').backupMonitor.checkHealth()"
```

### Environment Variables

```bash
# Backup configuration
export BACKUP_DIR="/var/backups/servicedesk"
export S3_BUCKET="servicedesk-backups"
export ENCRYPT_BACKUPS="true"
export GPG_RECIPIENT="backup@servicedesk.com"

# Notification
export NOTIFICATION_WEBHOOK="https://hooks.slack.com/services/..."

# Database
export DB_TYPE="sqlite"  # or "postgres"
export DB_PATH="/app/servicedesk.db"
```

---

## Support

**Backup Team Contact:**
- Email: backup-team@servicedesk.com
- Slack: #backup-support
- On-call: +1-XXX-XXX-XXXX

**Escalation:**
- DR Coordinator: dr-coordinator@servicedesk.com
- Infrastructure Lead: infra-lead@servicedesk.com

---

**Document Version:** 1.0
**Last Updated:** 2025-01-18
**Next Review:** 2025-04-18
**Owner:** Infrastructure Team
