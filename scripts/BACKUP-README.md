# ServiceDesk Backup & DR System

Complete enterprise-grade backup and disaster recovery system for ServiceDesk.

## Quick Start

### Initial Setup

```bash
# 1. Configure environment variables
export BACKUP_DIR="/var/backups/servicedesk"
export S3_BUCKET="your-backup-bucket"
export GPG_RECIPIENT="backup@servicedesk.com"
export NOTIFICATION_WEBHOOK="https://your-webhook-url"

# 2. Generate GPG keys for encryption
gpg --gen-key

# 3. Test backup
bash scripts/backup/database-backup.sh

# 4. Verify backup
bash scripts/backup/verify-backup.sh latest
```

### Daily Operations

```bash
# Manual database backup
bash scripts/backup/database-backup.sh

# Incremental backup
BACKUP_TYPE=incremental bash scripts/backup/database-backup.sh

# Application state backup
bash scripts/backup/app-state-backup.sh

# Verify backups
bash scripts/backup/verify-backup.sh latest

# List all backups
bash scripts/backup/verify-backup.sh list
```

### Restore Operations

```bash
# Restore from latest backup (DRY RUN)
bash scripts/restore/database-restore.sh --dry-run

# Restore from latest backup
bash scripts/restore/database-restore.sh --backup-file latest

# Restore specific tables
bash scripts/restore/database-restore.sh --tables users,tickets

# Point-in-time restore (PostgreSQL only)
bash scripts/restore/database-restore.sh --pitr "2025-01-18 14:30:00"
```

### Disaster Recovery

```bash
# Interactive DR menu
bash scripts/dr/disaster-recovery.sh

# Specific scenario
DR_SCENARIO=database_corruption bash scripts/dr/disaster-recovery.sh

# DR drill (testing)
bash scripts/dr/dr-drill.sh
```

## Architecture

```
scripts/
├── backup/
│   ├── database-backup.sh          # Full/incremental DB backup
│   ├── app-state-backup.sh         # Config/uploads backup
│   ├── verify-backup.sh            # Integrity verification
│   └── cleanup-old-backups.sh      # Retention enforcement
├── restore/
│   ├── database-restore.sh         # DB restoration
│   └── app-state-restore.sh        # State restoration
└── dr/
    ├── disaster-recovery.sh        # DR orchestration
    └── dr-drill.sh                 # Automated DR testing

k8s/cronjobs/
├── backup-database.yaml            # Daily/incremental backups
├── backup-app-state.yaml           # Application state backups
├── backup-verification.yaml        # Weekly verification
└── backup-cleanup.yaml             # Daily cleanup

lib/backup/
└── monitoring.ts                   # Backup monitoring & alerts

infrastructure/
└── s3-lifecycle.json               # S3 retention policies

docs/
├── DISASTER-RECOVERY.md            # Complete DR plan
└── BACKUP-STRATEGY.md              # Backup strategy guide
```

## Features

### Backup Features
- ✅ Full database backups (daily)
- ✅ Incremental backups (every 6 hours)
- ✅ Application state backups
- ✅ Automated encryption (GPG + AWS KMS)
- ✅ Compression (gzip level 9)
- ✅ Checksum verification (SHA-256)
- ✅ S3 lifecycle policies
- ✅ Multi-tier storage (Standard → IA → Glacier → Deep Archive)

### Recovery Features
- ✅ Full database restore
- ✅ Selective table restore
- ✅ Point-in-time recovery (PostgreSQL)
- ✅ Dry-run mode
- ✅ Automated verification
- ✅ Pre-restore database backup

### DR Features
- ✅ 5 DR scenarios supported
- ✅ Automated DR orchestration
- ✅ RTO: 2 hours
- ✅ RPO: 6 hours
- ✅ Cross-region failover
- ✅ Automated DR drills

### Monitoring Features
- ✅ Backup job tracking
- ✅ Success/failure rate monitoring
- ✅ Size anomaly detection
- ✅ Duration monitoring
- ✅ Webhook notifications
- ✅ Health checks

## Backup Schedule

| Type | Frequency | Time (UTC) | Retention |
|------|-----------|------------|-----------|
| Full | Daily | 2:00 AM | 30 days → 12 months |
| Incremental | Every 6h | 2,8,14,20:00 | 7 days |
| App State | Daily | 3:00 AM | 90 days |
| Verification | Weekly | Sun 4:00 AM | N/A |
| Cleanup | Daily | 5:00 AM | N/A |

## Storage Tiers

```
Day 0-30:   S3 Standard         (Immediate access)
Day 31-90:  S3 Standard-IA      (Minutes to access)
Day 91-365: S3 Glacier IR       (Hours to access)
Day 365+:   S3 Deep Archive     (12-48h to access)
```

## Configuration

### Environment Variables

```bash
# Backup Configuration
BACKUP_DIR="/var/backups/servicedesk"
BACKUP_TYPE="full"                    # full or incremental
RETENTION_DAYS=30
RETENTION_MONTHLY=12

# Database Configuration
DB_TYPE="sqlite"                      # sqlite or postgres
DB_PATH="/app/servicedesk.db"
DB_HOST="localhost"
DB_PORT=5432
DB_NAME="servicedesk"
DB_USER="servicedesk"
DB_PASSWORD="secret"

# Storage Configuration
STORAGE_TYPE="s3"                     # s3, gcs, azure, local
S3_BUCKET="servicedesk-backups"
S3_PREFIX="backups/database"

# Encryption
ENCRYPT_BACKUPS="true"
GPG_RECIPIENT="backup@servicedesk.com"
AWS_KMS_KEY_ID="alias/servicedesk-backup"

# Notifications
NOTIFY_ON_SUCCESS="false"
NOTIFY_ON_FAILURE="true"
NOTIFICATION_WEBHOOK="https://hooks.slack.com/..."
NOTIFICATION_EMAIL="ops@servicedesk.com"

# Logging
LOG_DIR="/var/log/servicedesk/backup"
```

### Kubernetes Secrets

```bash
# Create backup secrets
kubectl create secret generic servicedesk-backup-secrets \
  --from-literal=notification.webhook="https://..." \
  --namespace=servicedesk

# Create AWS credentials
kubectl create secret generic servicedesk-aws-credentials \
  --from-literal=access-key-id="AKIAIOSFODNN7EXAMPLE" \
  --from-literal=secret-access-key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" \
  --namespace=servicedesk

# Create GPG keys
kubectl create secret generic servicedesk-gpg-keys \
  --from-file=gpg-private.key=/path/to/private.key \
  --from-file=gpg-public.key=/path/to/public.key \
  --namespace=servicedesk
```

## Monitoring

### Health Checks

```bash
# Check backup health
curl http://localhost:3000/api/backup/health

# Get backup metrics
curl http://localhost:3000/api/backup/metrics

# List recent backups
curl http://localhost:3000/api/backup/inventory
```

### Alerts

**Critical:**
- Backup failure
- No backup in 24 hours
- Restore test failure

**Warning:**
- Backup size anomaly
- Backup duration > 1 hour
- Failure rate > 10%

**Info:**
- Backup completed
- Verification passed

## Testing

### Weekly Verification (Automated)

Every Sunday at 4:00 AM UTC:
1. Download latest backup
2. Verify checksum
3. Test decryption
4. Test decompression
5. Restore to isolated environment
6. Verify database integrity
7. Send notification

### Monthly DR Drill

First Saturday of each month:
1. Select DR scenario
2. Assemble team
3. Execute full recovery
4. Measure RTO/RPO
5. Document results
6. Update procedures

### Manual Testing

```bash
# Run verification
bash scripts/backup/verify-backup.sh latest

# Run DR drill
bash scripts/dr/dr-drill.sh

# Test restore (dry-run)
bash scripts/restore/database-restore.sh --dry-run
```

## Troubleshooting

### Common Issues

**Backup fails with "GPG encryption failed"**
```bash
# Check GPG key
gpg --list-keys backup@servicedesk.com

# Import key if missing
gpg --import /path/to/key
```

**"Checksum verification failed"**
```bash
# Download backup again
# Corrupted during transfer

# Verify S3 object integrity
aws s3api head-object --bucket BUCKET --key KEY
```

**Restore fails with "Database locked"**
```bash
# Stop application first
kubectl scale deployment/servicedesk --replicas=0

# Then retry restore
bash scripts/restore/database-restore.sh
```

**S3 upload fails**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket BUCKET

# Check network connectivity
curl -I https://s3.amazonaws.com
```

### Debug Mode

```bash
# Enable verbose logging
set -x

# Run backup with debug
bash -x scripts/backup/database-backup.sh

# Check logs
tail -f /var/log/servicedesk/backup/backup_*.log
```

## Security

### Encryption

- **At Rest:** GPG (RSA 4096) + AWS KMS
- **In Transit:** TLS 1.3
- **Key Rotation:** Every 90 days

### Access Control

- IAM roles with least privilege
- MFA required for restore operations
- S3 bucket policies enforce encryption
- Kubernetes RBAC for CronJobs

### Compliance

- **LGPD:** 7-year retention, encrypted backups
- **SOC 2:** Quarterly DR tests, documented procedures
- **ISO 27001:** Annual review, offsite storage

## Performance

### Backup Performance

| Operation | Size | Duration |
|-----------|------|----------|
| SQLite backup (500MB) | 500MB | 10-15 min |
| PostgreSQL backup (10GB) | 10GB | 45-60 min |
| Compression | 50% reduction | +5 min |
| Encryption | Minimal | +2 min |
| S3 upload | Network dependent | 5-20 min |

### Restore Performance

| Operation | Size | Duration |
|-----------|------|----------|
| S3 download | 500MB | 5-10 min |
| Decryption | Minimal | +2 min |
| Decompression | 500MB → 1GB | +5 min |
| Database restore | 1GB | 10-15 min |
| **Total RTO** | | **30-45 min** |

## Cost Estimate

### Monthly Costs

```
Storage:
- S3 Standard (60GB):        $1.38
- S3 Standard-IA (180GB):    $2.25
- S3 Glacier IR (500GB):     $2.00
- S3 Deep Archive (2TB):     $2.02

Operations:
- PUT/GET requests:          $0.92
- Data transfer:             $0.90

Infrastructure:
- Kubernetes PVC (100GB):    $10.00
- CronJobs:                  $5.00
- Monitoring:                $3.00

Total: ~$27/month
```

## Support

**Issues:** https://github.com/servicedesk/issues
**Docs:** https://docs.servicedesk.com/backup
**Slack:** #backup-support
**On-call:** backup-oncall@servicedesk.com

## License

MIT License - See LICENSE file for details

---

**Version:** 1.0
**Last Updated:** 2025-01-18
**Maintainer:** Infrastructure Team
