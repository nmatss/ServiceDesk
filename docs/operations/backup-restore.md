# Backup & Restore Guide

Database backup and disaster recovery procedures.

## Backup Strategy

### Automated Backups

- **Frequency**: Daily at 2 AM UTC
- **Retention**: 30 days
- **Storage**: S3/GCS/Azure Blob
- **Encryption**: AES-256

### Backup Types

1. **Full Backup**: Complete database dump (daily)
2. **Incremental**: Changes since last backup (hourly)
3. **WAL Archive**: Point-in-time recovery

## Backup Procedures

### Manual Backup

```bash
# PostgreSQL
pg_dump -h localhost -U servicedesk servicedesk | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Upload to S3
aws s3 cp backup_*.sql.gz s3://your-bucket/backups/
```

### Automated Backup Script

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > /backups/backup_$DATE.sql.gz

# Upload to cloud
aws s3 cp /backups/backup_$DATE.sql.gz s3://$BUCKET/backups/

# Keep last 30 days
find /backups -name "backup_*.sql.gz" -mtime +30 -delete
```

## Restore Procedures

### Full Restore

```bash
# Download from S3
aws s3 cp s3://your-bucket/backups/backup_20250118.sql.gz .

# Extract
gunzip backup_20250118.sql.gz

# Restore
psql -h localhost -U servicedesk -d servicedesk < backup_20250118.sql
```

### Point-in-Time Recovery

```bash
# Restore base backup
pg_restore -d servicedesk base_backup.dump

# Apply WAL files up to specific time
recovery_target_time = '2025-01-18 14:30:00'
```

## Testing Backups

### Monthly Backup Test

1. Download latest backup
2. Restore to test database
3. Verify data integrity
4. Test application functionality
5. Document results

## Disaster Recovery

### RTO/RPO Targets

- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective)

### DR Procedure

1. **Assess Situation**: Determine severity
2. **Notify Stakeholders**: Send alerts
3. **Execute Recovery**: Restore from backup
4. **Verify System**: Run smoke tests
5. **Monitor**: Watch for issues
6. **Document**: Post-mortem report

## Best Practices

1. Test backups regularly
2. Store backups off-site
3. Encrypt backup files
4. Monitor backup success
5. Document restore procedures
6. Automate backup process
