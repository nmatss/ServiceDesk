#!/bin/bash

################################################################################
# Cleanup Old Backups Script - ServiceDesk
#
# Removes old backups according to retention policy:
# - Daily backups: 30 days
# - Incremental backups: 7 days
# - Monthly backups: 12 months
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/servicedesk}"
LOG_DIR="${LOG_DIR:-/var/log/servicedesk/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/cleanup_${TIMESTAMP}.log"

# Retention periods (in days)
DAILY_RETENTION="${DAILY_RETENTION:-30}"
INCREMENTAL_RETENTION="${INCREMENTAL_RETENTION:-7}"
MONTHLY_RETENTION="${MONTHLY_RETENTION:-365}"

# Storage configuration
STORAGE_TYPE="${STORAGE_TYPE:-s3}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/database}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

################################################################################
# Helper Functions
################################################################################

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cleanup_local_backups() {
    log "Cleaning up local backups..."

    local deleted=0

    # Cleanup daily backups
    while IFS= read -r file; do
        rm -f "$file"
        ((deleted++))
        log "Deleted: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -type f -name "*full*.backup.gz.gpg" -mtime +"$DAILY_RETENTION")

    # Cleanup incremental backups
    while IFS= read -r file; do
        rm -f "$file"
        ((deleted++))
        log "Deleted: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -type f -name "*incremental*.backup.gz.gpg" -mtime +"$INCREMENTAL_RETENTION")

    log_success "Deleted $deleted local backup files"
}

cleanup_s3_backups() {
    log "Cleaning up S3 backups..."

    if [ -z "$S3_BUCKET" ]; then
        log "S3_BUCKET not configured, skipping S3 cleanup"
        return 0
    fi

    local deleted=0

    # Calculate cutoff dates
    local daily_cutoff=$(date -d "$DAILY_RETENTION days ago" +%Y%m%d)
    local incremental_cutoff=$(date -d "$INCREMENTAL_RETENTION days ago" +%Y%m%d)

    # List and delete old daily backups
    log "Deleting daily backups older than $DAILY_RETENTION days..."
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/full/" | \
        awk '{print $4}' | \
        while read -r file; do
            if [ -z "$file" ]; then
                continue
            fi

            # Extract date from filename (assuming format: servicedesk_full_YYYYMMDD_*.backup.gz.gpg)
            local file_date=$(echo "$file" | grep -oP '\d{8}' | head -1)

            if [ -n "$file_date" ] && [ "$file_date" \< "$daily_cutoff" ]; then
                aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/full/${file}" || \
                    log "Warning: Failed to delete $file"
                ((deleted++))
                log "Deleted S3: $file"
            fi
        done

    # Delete old incremental backups
    log "Deleting incremental backups older than $INCREMENTAL_RETENTION days..."
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/incremental/" | \
        awk '{print $4}' | \
        while read -r file; do
            if [ -z "$file" ]; then
                continue
            fi

            local file_date=$(echo "$file" | grep -oP '\d{8}' | head -1)

            if [ -n "$file_date" ] && [ "$file_date" \< "$incremental_cutoff" ]; then
                aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/incremental/${file}" || \
                    log "Warning: Failed to delete $file"
                ((deleted++))
                log "Deleted S3: $file"
            fi
        done

    log_success "Deleted $deleted S3 backup files"
}

cleanup_incomplete_uploads() {
    log "Cleaning up incomplete multipart uploads..."

    if [ -z "$S3_BUCKET" ]; then
        return 0
    fi

    # List and abort incomplete uploads older than 7 days
    local abort_date=$(date -d "7 days ago" +%Y-%m-%d)

    aws s3api list-multipart-uploads \
        --bucket "$S3_BUCKET" \
        --prefix "$S3_PREFIX" \
        --query "Uploads[?Initiated<'${abort_date}'].[Key,UploadId]" \
        --output text | \
        while read -r key upload_id; do
            if [ -n "$key" ] && [ -n "$upload_id" ]; then
                aws s3api abort-multipart-upload \
                    --bucket "$S3_BUCKET" \
                    --key "$key" \
                    --upload-id "$upload_id" || \
                    log "Warning: Failed to abort upload for $key"
                log "Aborted incomplete upload: $key"
            fi
        done

    log_success "Incomplete uploads cleaned up"
}

report_storage_usage() {
    log "Generating storage usage report..."

    # Local storage
    if [ -d "$BACKUP_DIR" ]; then
        local local_usage=$(du -sh "$BACKUP_DIR" | cut -f1)
        log "Local storage usage: $local_usage"
    fi

    # S3 storage
    if [ -n "$S3_BUCKET" ]; then
        log "S3 storage usage:"

        local full_size=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/full/" --recursive --summarize | \
            grep "Total Size" | awk '{print $3}')
        local incremental_size=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/incremental/" --recursive --summarize | \
            grep "Total Size" | awk '{print $3}')

        log "  Full backups: $(numfmt --to=iec-i --suffix=B ${full_size:-0})"
        log "  Incremental backups: $(numfmt --to=iec-i --suffix=B ${incremental_size:-0})"
    fi
}

################################################################################
# Main Process
################################################################################

main() {
    log "========================================="
    log "ServiceDesk Backup Cleanup"
    log "Timestamp: $TIMESTAMP"
    log "========================================="

    mkdir -p "$LOG_DIR"

    # Cleanup local backups
    cleanup_local_backups

    # Cleanup S3 backups
    if [ "$STORAGE_TYPE" = "s3" ]; then
        cleanup_s3_backups
        cleanup_incomplete_uploads
    fi

    # Report storage usage
    report_storage_usage

    log_success "========================================="
    log_success "Backup cleanup completed"
    log_success "========================================="
}

main "$@"
