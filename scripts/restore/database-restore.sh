#!/bin/bash

################################################################################
# Database Restore Script - ServiceDesk
#
# Restore modes:
# - Full restore
# - Point-in-time restore (PITR)
# - Selective table restore
# - Dry-run mode (test only)
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/servicedesk}"
RESTORE_DIR="${RESTORE_DIR:-/var/restore/servicedesk}"
LOG_DIR="${LOG_DIR:-/var/log/servicedesk/restore}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/restore_${TIMESTAMP}.log"

# Database configuration
DB_TYPE="${DB_TYPE:-sqlite}"
DB_PATH="${DB_PATH:-$PROJECT_ROOT/servicedesk.db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-servicedesk}"
DB_USER="${DB_USER:-servicedesk}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Storage
STORAGE_TYPE="${STORAGE_TYPE:-s3}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/database}"

# Restore options
DRY_RUN="${DRY_RUN:-false}"
BACKUP_FILE="${BACKUP_FILE:-}"
PITR_TIMESTAMP="${PITR_TIMESTAMP:-}"
RESTORE_TABLES="${RESTORE_TABLES:-}"

# Encryption
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@servicedesk.com}"
AWS_KMS_KEY_ID="${AWS_KMS_KEY_ID:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

log_info() {
    echo -e "${BLUE}[INFO]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

confirm_action() {
    local message=$1

    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would execute: $message"
        return 0
    fi

    echo -e "${YELLOW}WARNING:${NC} $message"
    read -p "Are you sure? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Operation cancelled by user"
        exit 1
    fi
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$RESTORE_DIR"
}

################################################################################
# Backup Selection Functions
################################################################################

list_available_backups() {
    log "Available backups:"
    echo "========================================="

    case "$STORAGE_TYPE" in
        s3)
            aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | \
                grep -E '\.backup\.gz\.gpg$' | \
                awk '{print NR") " $1" "$2" "$4}' | \
                tail -20
            ;;
        local)
            find "$BACKUP_DIR" -type f -name "*.backup.gz.gpg" -o -name "*.backup.gz" | \
                sort -r | head -20 | nl
            ;;
    esac

    echo "========================================="
}

select_backup() {
    if [ -n "$BACKUP_FILE" ]; then
        echo "$BACKUP_FILE"
        return 0
    fi

    list_available_backups

    echo -e "\nEnter backup number or filename:"
    read -r selection

    if [[ "$selection" =~ ^[0-9]+$ ]]; then
        # User selected by number
        case "$STORAGE_TYPE" in
            s3)
                BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | \
                    grep -E '\.backup\.gz\.gpg$' | \
                    tail -20 | sed -n "${selection}p" | awk '{print $4}' | xargs basename)
                ;;
            local)
                BACKUP_FILE=$(find "$BACKUP_DIR" -type f -name "*.backup.gz.gpg" -o -name "*.backup.gz" | \
                    sort -r | head -20 | sed -n "${selection}p")
                ;;
        esac
    else
        BACKUP_FILE="$selection"
    fi

    echo "$BACKUP_FILE"
}

download_backup() {
    local backup_file=$1
    local destination=$2

    log "Downloading backup: $backup_file"

    case "$STORAGE_TYPE" in
        s3)
            aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${backup_file}" "$destination" || {
                log_error "Failed to download from S3"
                exit 1
            }

            # Download checksum file
            aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${backup_file}.sha256" "${destination}.sha256" || {
                log_warning "Checksum file not available"
            }
            ;;
        local)
            cp "$BACKUP_DIR/$backup_file" "$destination" || {
                log_error "Failed to copy backup file"
                exit 1
            }

            if [ -f "$BACKUP_DIR/${backup_file}.sha256" ]; then
                cp "$BACKUP_DIR/${backup_file}.sha256" "${destination}.sha256"
            fi
            ;;
    esac

    log_success "Backup downloaded"
}

verify_backup() {
    local backup_file=$1

    log "Verifying backup integrity..."

    # Verify checksum if available
    if [ -f "${backup_file}.sha256" ]; then
        cd "$(dirname "$backup_file")"
        sha256sum -c "$(basename "${backup_file}.sha256")" || {
            log_error "Checksum verification failed!"
            exit 1
        }
        cd - > /dev/null
        log_success "Checksum verified"
    else
        log_warning "No checksum file available, skipping verification"
    fi
}

decrypt_backup() {
    local encrypted_file=$1
    local output_file=$2

    if [[ "$encrypted_file" != *.gpg ]]; then
        log "Backup not encrypted, skipping decryption"
        cp "$encrypted_file" "$output_file"
        return 0
    fi

    log "Decrypting backup..."

    if [ -n "$AWS_KMS_KEY_ID" ]; then
        aws kms decrypt \
            --ciphertext-blob "fileb://$encrypted_file" \
            --output text \
            --query Plaintext | base64 -d > "$output_file" || {
            log_error "AWS KMS decryption failed"
            exit 1
        }
    else
        gpg --batch --yes --decrypt \
            --output "$output_file" "$encrypted_file" || {
            log_error "GPG decryption failed"
            exit 1
        }
    fi

    log_success "Backup decrypted"
}

decompress_backup() {
    local compressed_file=$1
    local output_file=$2

    log "Decompressing backup..."

    gunzip -c "$compressed_file" > "$output_file" || {
        log_error "Decompression failed"
        exit 1
    }

    log_success "Backup decompressed"
}

################################################################################
# Restore Functions
################################################################################

backup_current_database() {
    log "Creating backup of current database..."

    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would backup current database"
        return 0
    fi

    local current_backup="$BACKUP_DIR/pre-restore_${TIMESTAMP}.backup"

    case "$DB_TYPE" in
        sqlite)
            if [ -f "$DB_PATH" ]; then
                cp "$DB_PATH" "$current_backup"
                log_success "Current database backed up: $current_backup"
            fi
            ;;
        postgres)
            export PGPASSWORD="$DB_PASSWORD"
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
                -Fc -b -v -f "$current_backup" "$DB_NAME" || {
                log_error "Failed to backup current database"
                exit 1
            }
            unset PGPASSWORD
            log_success "Current database backed up: $current_backup"
            ;;
    esac
}

restore_sqlite() {
    local backup_file=$1

    log "Restoring SQLite database from: $backup_file"

    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would restore to $DB_PATH"
        return 0
    fi

    # Stop application if running
    log "Stopping application..."
    # Add your application stop command here
    # systemctl stop servicedesk || true

    # Restore database
    cp "$backup_file" "$DB_PATH" || {
        log_error "Failed to restore database"
        exit 1
    }

    # Verify restored database
    sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok" || {
        log_error "Restored database integrity check failed"
        exit 1
    }

    # Start application
    log "Starting application..."
    # systemctl start servicedesk || true

    log_success "SQLite database restored successfully"
}

restore_postgres() {
    local backup_file=$1

    log "Restoring PostgreSQL database from: $backup_file"

    export PGPASSWORD="$DB_PASSWORD"

    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would restore to database $DB_NAME"
        return 0
    fi

    # Stop application
    log "Stopping application..."
    # systemctl stop servicedesk || true

    # Terminate existing connections
    log "Terminating existing database connections..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" || true

    # Drop and recreate database
    log "Recreating database..."
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" || true
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" || {
        log_error "Failed to create database"
        exit 1
    }

    # Restore backup
    log "Restoring backup..."
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$DB_NAME" -v "$backup_file" || {
        log_error "Database restore failed"
        exit 1
    }

    # Start application
    log "Starting application..."
    # systemctl start servicedesk || true

    unset PGPASSWORD
    log_success "PostgreSQL database restored successfully"
}

restore_selective_tables() {
    local backup_file=$1
    local tables=$2

    log "Restoring selective tables: $tables"

    if [ "$DB_TYPE" != "postgres" ]; then
        log_error "Selective table restore only supported for PostgreSQL"
        exit 1
    fi

    export PGPASSWORD="$DB_PASSWORD"

    for table in ${tables//,/ }; do
        log "Restoring table: $table"

        if [ "$DRY_RUN" = "true" ]; then
            log_info "DRY RUN: Would restore table $table"
            continue
        fi

        pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -d "$DB_NAME" -t "$table" -v "$backup_file" || {
            log_error "Failed to restore table: $table"
        }
    done

    unset PGPASSWORD
    log_success "Selective table restore completed"
}

point_in_time_restore() {
    local target_time=$1

    log "Point-in-time restore to: $target_time"

    if [ "$DB_TYPE" != "postgres" ]; then
        log_error "PITR only supported for PostgreSQL with WAL archiving"
        exit 1
    fi

    log_error "PITR implementation requires PostgreSQL WAL archiving setup"
    log_error "Please refer to PostgreSQL documentation for PITR setup"
    exit 1
}

################################################################################
# Main Restore Process
################################################################################

main() {
    log "========================================="
    log "ServiceDesk Database Restore"
    log "Database Type: $DB_TYPE"
    log "Dry Run: $DRY_RUN"
    log "Timestamp: $TIMESTAMP"
    log "========================================="

    mkdir -p "$RESTORE_DIR" "$LOG_DIR"
    trap cleanup EXIT

    # Select backup to restore
    selected_backup=$(select_backup)

    if [ -z "$selected_backup" ]; then
        log_error "No backup selected"
        exit 1
    fi

    log "Selected backup: $selected_backup"

    # Confirm restore operation
    confirm_action "This will restore the database from backup: $selected_backup"

    # Download backup
    local_backup="$RESTORE_DIR/$(basename "$selected_backup")"
    download_backup "$selected_backup" "$local_backup"

    # Verify backup
    verify_backup "$local_backup"

    # Decrypt backup
    decrypted_backup="$RESTORE_DIR/decrypted.gz"
    decrypt_backup "$local_backup" "$decrypted_backup"

    # Decompress backup
    restored_backup="$RESTORE_DIR/restored.backup"
    decompress_backup "$decrypted_backup" "$restored_backup"

    # Backup current database
    backup_current_database

    # Perform restore
    if [ -n "$RESTORE_TABLES" ]; then
        restore_selective_tables "$restored_backup" "$RESTORE_TABLES"
    elif [ -n "$PITR_TIMESTAMP" ]; then
        point_in_time_restore "$PITR_TIMESTAMP"
    else
        case "$DB_TYPE" in
            sqlite)
                restore_sqlite "$restored_backup"
                ;;
            postgres)
                restore_postgres "$restored_backup"
                ;;
            *)
                log_error "Unknown database type: $DB_TYPE"
                exit 1
                ;;
        esac
    fi

    log_success "========================================="
    log_success "Database restore completed successfully!"
    log_success "========================================="
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup-file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --pitr)
            PITR_TIMESTAMP="$2"
            shift 2
            ;;
        --tables)
            RESTORE_TABLES="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--backup-file FILE] [--pitr TIMESTAMP] [--tables table1,table2]"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
