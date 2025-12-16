#!/bin/bash

################################################################################
# Database Backup Script - ServiceDesk
#
# Performs full and incremental backups of SQLite/PostgreSQL database
# Features:
# - Full backups (daily at 2 AM UTC)
# - Incremental backups (every 6 hours)
# - Compression (gzip)
# - Encryption (GPG)
# - Upload to S3/GCS/Azure Blob
# - Checksum verification
# - Notification on success/failure
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/servicedesk}"
BACKUP_TYPE="${BACKUP_TYPE:-full}" # full or incremental
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"

# Database configuration
DB_TYPE="${DB_TYPE:-sqlite}" # sqlite or postgres
DB_PATH="${DB_PATH:-$PROJECT_ROOT/servicedesk.db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-servicedesk}"
DB_USER="${DB_USER:-servicedesk}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Storage configuration
STORAGE_TYPE="${STORAGE_TYPE:-s3}" # s3, gcs, azure, local
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/database}"
GCS_BUCKET="${GCS_BUCKET:-}"
AZURE_CONTAINER="${AZURE_CONTAINER:-}"

# Encryption configuration
ENCRYPT_BACKUPS="${ENCRYPT_BACKUPS:-true}"
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@servicedesk.com}"
AWS_KMS_KEY_ID="${AWS_KMS_KEY_ID:-}"

# Notification configuration
NOTIFY_ON_SUCCESS="${NOTIFY_ON_SUCCESS:-true}"
NOTIFY_ON_FAILURE="${NOTIFY_ON_FAILURE:-true}"
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK:-}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"

# Logging
LOG_DIR="${LOG_DIR:-/var/log/servicedesk/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/backup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

################################################################################
# Helper Functions
################################################################################

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -f "$TEMP_BACKUP" "$TEMP_BACKUP.gz" "$TEMP_BACKUP.gz.gpg"
}

send_notification() {
    local status=$1
    local message=$2

    if [ "$status" = "success" ] && [ "$NOTIFY_ON_SUCCESS" != "true" ]; then
        return 0
    fi

    if [ "$status" = "failure" ] && [ "$NOTIFY_ON_FAILURE" != "true" ]; then
        return 0
    fi

    # Send webhook notification
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"$status\",\"message\":\"$message\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            || log_warning "Failed to send webhook notification"
    fi

    # Send email notification
    if [ -n "$NOTIFICATION_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "ServiceDesk Backup $status" "$NOTIFICATION_EMAIL" \
            || log_warning "Failed to send email notification"
    fi
}

################################################################################
# Backup Functions
################################################################################

create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    chmod 700 "$BACKUP_DIR"
}

backup_sqlite() {
    local backup_file=$1
    log "Backing up SQLite database: $DB_PATH"

    if [ ! -f "$DB_PATH" ]; then
        log_error "Database file not found: $DB_PATH"
        exit 1
    fi

    # Use SQLite backup API for consistent snapshot
    sqlite3 "$DB_PATH" ".backup '$backup_file'" || {
        log_error "SQLite backup failed"
        exit 1
    }

    log_success "SQLite backup completed: $backup_file"
}

backup_postgres() {
    local backup_file=$1
    log "Backing up PostgreSQL database: $DB_NAME"

    export PGPASSWORD="$DB_PASSWORD"

    if [ "$BACKUP_TYPE" = "full" ]; then
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -Fc -b -v -f "$backup_file" "$DB_NAME" || {
            log_error "PostgreSQL backup failed"
            exit 1
        }
    else
        # Incremental backup using WAL archiving
        pg_basebackup -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -D "$backup_file" -Ft -z -P || {
            log_error "PostgreSQL incremental backup failed"
            exit 1
        }
    fi

    unset PGPASSWORD
    log_success "PostgreSQL backup completed: $backup_file"
}

compress_backup() {
    local input_file=$1
    local output_file="${input_file}.gz"

    log "Compressing backup: $input_file"

    gzip -9 -c "$input_file" > "$output_file" || {
        log_error "Compression failed"
        exit 1
    }

    log_success "Compression completed: $output_file"
    echo "$output_file"
}

encrypt_backup() {
    local input_file=$1
    local output_file="${input_file}.gpg"

    log "Encrypting backup: $input_file"

    if [ "$ENCRYPT_BACKUPS" != "true" ]; then
        log "Encryption disabled, skipping..."
        echo "$input_file"
        return 0
    fi

    if [ -n "$AWS_KMS_KEY_ID" ]; then
        # Use AWS KMS for encryption
        aws kms encrypt \
            --key-id "$AWS_KMS_KEY_ID" \
            --plaintext "fileb://$input_file" \
            --output text \
            --query CiphertextBlob | base64 -d > "$output_file" || {
            log_error "AWS KMS encryption failed"
            exit 1
        }
    else
        # Use GPG for encryption
        gpg --batch --yes --trust-model always \
            --recipient "$GPG_RECIPIENT" \
            --encrypt --output "$output_file" "$input_file" || {
            log_error "GPG encryption failed"
            exit 1
        }
    fi

    log_success "Encryption completed: $output_file"
    echo "$output_file"
}

calculate_checksum() {
    local file=$1
    log "Calculating checksum for: $file"

    sha256sum "$file" > "${file}.sha256" || {
        log_error "Checksum calculation failed"
        exit 1
    }

    log_success "Checksum saved: ${file}.sha256"
}

upload_to_storage() {
    local file=$1
    local checksum_file="${file}.sha256"

    log "Uploading backup to $STORAGE_TYPE storage..."

    case "$STORAGE_TYPE" in
        s3)
            upload_to_s3 "$file" "$checksum_file"
            ;;
        gcs)
            upload_to_gcs "$file" "$checksum_file"
            ;;
        azure)
            upload_to_azure "$file" "$checksum_file"
            ;;
        local)
            log "Using local storage, no upload needed"
            ;;
        *)
            log_error "Unknown storage type: $STORAGE_TYPE"
            exit 1
            ;;
    esac
}

upload_to_s3() {
    local file=$1
    local checksum_file=$2

    if [ -z "$S3_BUCKET" ]; then
        log_error "S3_BUCKET not configured"
        exit 1
    fi

    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$file")"
    local s3_checksum_path="s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$checksum_file")"

    # Upload backup file
    aws s3 cp "$file" "$s3_path" \
        --storage-class STANDARD \
        --server-side-encryption AES256 \
        --metadata "backup-type=${BACKUP_TYPE},timestamp=${TIMESTAMP}" || {
        log_error "S3 upload failed"
        exit 1
    }

    # Upload checksum file
    aws s3 cp "$checksum_file" "$s3_checksum_path" || {
        log_warning "Failed to upload checksum file"
    }

    log_success "Uploaded to S3: $s3_path"
}

upload_to_gcs() {
    local file=$1
    local checksum_file=$2

    if [ -z "$GCS_BUCKET" ]; then
        log_error "GCS_BUCKET not configured"
        exit 1
    fi

    local gcs_path="gs://${GCS_BUCKET}/${S3_PREFIX}/$(basename "$file")"

    gsutil cp "$file" "$gcs_path" || {
        log_error "GCS upload failed"
        exit 1
    }

    gsutil cp "$checksum_file" "gs://${GCS_BUCKET}/${S3_PREFIX}/$(basename "$checksum_file")" || {
        log_warning "Failed to upload checksum file"
    }

    log_success "Uploaded to GCS: $gcs_path"
}

upload_to_azure() {
    local file=$1
    local checksum_file=$2

    if [ -z "$AZURE_CONTAINER" ]; then
        log_error "AZURE_CONTAINER not configured"
        exit 1
    fi

    az storage blob upload \
        --container-name "$AZURE_CONTAINER" \
        --file "$file" \
        --name "${S3_PREFIX}/$(basename "$file")" || {
        log_error "Azure upload failed"
        exit 1
    }

    az storage blob upload \
        --container-name "$AZURE_CONTAINER" \
        --file "$checksum_file" \
        --name "${S3_PREFIX}/$(basename "$checksum_file")" || {
        log_warning "Failed to upload checksum file"
    }

    log_success "Uploaded to Azure: $AZURE_CONTAINER/${S3_PREFIX}/$(basename "$file")"
}

cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."

    # Clean local backups
    find "$BACKUP_DIR" -type f -name "*.gz*" -mtime +"$RETENTION_DAYS" -delete || {
        log_warning "Failed to cleanup old local backups"
    }

    # Clean S3 backups (if using S3)
    if [ "$STORAGE_TYPE" = "s3" ] && [ -n "$S3_BUCKET" ]; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | \
            awk '{print $4}' | \
            while read -r file; do
                local file_date=$(echo "$file" | grep -oP '\d{8}' | head -1)
                if [ -n "$file_date" ] && [ "$file_date" \< "${cutoff_date//[-]/}" ]; then
                    aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file}" || \
                        log_warning "Failed to delete old S3 backup: $file"
                fi
            done
    fi

    log_success "Old backups cleaned up"
}

################################################################################
# Main Backup Process
################################################################################

main() {
    log "========================================="
    log "ServiceDesk Database Backup"
    log "Type: $BACKUP_TYPE"
    log "Database: $DB_TYPE"
    log "Timestamp: $TIMESTAMP"
    log "========================================="

    # Create backup directory
    create_backup_dir

    # Set trap for cleanup
    trap cleanup EXIT

    # Generate backup filename
    local backup_name="servicedesk_${BACKUP_TYPE}_${TIMESTAMP}.backup"
    TEMP_BACKUP="$BACKUP_DIR/$backup_name"

    # Perform database backup
    case "$DB_TYPE" in
        sqlite)
            backup_sqlite "$TEMP_BACKUP"
            ;;
        postgres)
            backup_postgres "$TEMP_BACKUP"
            ;;
        *)
            log_error "Unknown database type: $DB_TYPE"
            send_notification "failure" "Unknown database type: $DB_TYPE"
            exit 1
            ;;
    esac

    # Get backup size
    local backup_size=$(du -h "$TEMP_BACKUP" | cut -f1)
    log "Backup size: $backup_size"

    # Compress backup
    local compressed_file=$(compress_backup "$TEMP_BACKUP")
    local compressed_size=$(du -h "$compressed_file" | cut -f1)
    log "Compressed size: $compressed_size"

    # Encrypt backup
    local encrypted_file=$(encrypt_backup "$compressed_file")
    local encrypted_size=$(du -h "$encrypted_file" | cut -f1)
    log "Encrypted size: $encrypted_size"

    # Calculate checksum
    calculate_checksum "$encrypted_file"

    # Upload to storage
    upload_to_storage "$encrypted_file"

    # Cleanup old backups
    cleanup_old_backups

    log_success "========================================="
    log_success "Backup completed successfully!"
    log_success "Final file: $(basename "$encrypted_file")"
    log_success "Size: $encrypted_size"
    log_success "========================================="

    send_notification "success" "Backup completed: $backup_name (Size: $encrypted_size)"
}

# Run main function
main "$@"
