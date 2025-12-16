#!/bin/bash

################################################################################
# Application State Backup Script - ServiceDesk
#
# Backs up:
# - File uploads (S3 sync)
# - Configuration files
# - Environment variables (encrypted)
# - Recent logs (last 7 days)
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/servicedesk/app-state}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="${LOG_DIR:-/var/log/servicedesk/backup}"
LOG_FILE="$LOG_DIR/app-state-backup_${TIMESTAMP}.log"

# Storage configuration
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/app-state}"
UPLOADS_DIR="${UPLOADS_DIR:-$PROJECT_ROOT/uploads}"
LOGS_DIR="${LOGS_DIR:-/var/log/servicedesk}"

# Encryption
ENCRYPT_BACKUPS="${ENCRYPT_BACKUPS:-true}"
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@servicedesk.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

################################################################################
# Backup Functions
################################################################################

backup_uploads() {
    log "Backing up file uploads..."

    if [ ! -d "$UPLOADS_DIR" ]; then
        log "Uploads directory not found, skipping: $UPLOADS_DIR"
        return 0
    fi

    local upload_count=$(find "$UPLOADS_DIR" -type f | wc -l)
    log "Found $upload_count files in uploads directory"

    if [ -n "$S3_BUCKET" ]; then
        # Sync to S3
        aws s3 sync "$UPLOADS_DIR" "s3://${S3_BUCKET}/uploads/" \
            --delete \
            --storage-class STANDARD_IA || {
            log_error "Failed to sync uploads to S3"
            return 1
        }
        log_success "Uploads synced to S3"
    else
        # Copy to backup directory
        local backup_uploads="$BACKUP_DIR/uploads_${TIMESTAMP}"
        mkdir -p "$backup_uploads"
        cp -r "$UPLOADS_DIR"/* "$backup_uploads/" || {
            log_error "Failed to backup uploads"
            return 1
        }

        # Create tarball
        tar -czf "${backup_uploads}.tar.gz" -C "$BACKUP_DIR" "uploads_${TIMESTAMP}" || {
            log_error "Failed to create uploads tarball"
            return 1
        }

        rm -rf "$backup_uploads"
        log_success "Uploads backed up to ${backup_uploads}.tar.gz"
    fi
}

backup_config() {
    log "Backing up configuration files..."

    local config_backup="$BACKUP_DIR/config_${TIMESTAMP}"
    mkdir -p "$config_backup"

    # Backup configuration files (excluding secrets)
    if [ -f "$PROJECT_ROOT/next.config.js" ]; then
        cp "$PROJECT_ROOT/next.config.js" "$config_backup/"
    fi

    if [ -f "$PROJECT_ROOT/tailwind.config.js" ]; then
        cp "$PROJECT_ROOT/tailwind.config.js" "$config_backup/"
    fi

    if [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
        cp "$PROJECT_ROOT/tsconfig.json" "$config_backup/"
    fi

    if [ -f "$PROJECT_ROOT/package.json" ]; then
        cp "$PROJECT_ROOT/package.json" "$config_backup/"
    fi

    if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
        cp "$PROJECT_ROOT/package-lock.json" "$config_backup/"
    fi

    # Create tarball
    tar -czf "${config_backup}.tar.gz" -C "$BACKUP_DIR" "config_${TIMESTAMP}" || {
        log_error "Failed to create config tarball"
        return 1
    }

    rm -rf "$config_backup"
    log_success "Configuration backed up to ${config_backup}.tar.gz"
}

backup_env() {
    log "Backing up environment variables (encrypted)..."

    local env_file="$PROJECT_ROOT/.env"
    if [ ! -f "$env_file" ]; then
        log "No .env file found, skipping"
        return 0
    fi

    local env_backup="$BACKUP_DIR/env_${TIMESTAMP}.enc"

    # Encrypt .env file
    if [ "$ENCRYPT_BACKUPS" = "true" ]; then
        gpg --batch --yes --trust-model always \
            --recipient "$GPG_RECIPIENT" \
            --encrypt --output "$env_backup" "$env_file" || {
            log_error "Failed to encrypt .env file"
            return 1
        }
        log_success "Environment variables backed up (encrypted): $env_backup"
    else
        cp "$env_file" "${env_backup}.txt"
        log_success "Environment variables backed up: ${env_backup}.txt"
    fi
}

backup_logs() {
    log "Backing up recent logs (last 7 days)..."

    if [ ! -d "$LOGS_DIR" ]; then
        log "Logs directory not found, skipping: $LOGS_DIR"
        return 0
    fi

    local logs_backup="$BACKUP_DIR/logs_${TIMESTAMP}"
    mkdir -p "$logs_backup"

    # Find and copy logs from last 7 days
    find "$LOGS_DIR" -type f -name "*.log" -mtime -7 -exec cp {} "$logs_backup/" \; || {
        log_error "Failed to backup logs"
        return 1
    }

    local log_count=$(find "$logs_backup" -type f | wc -l)
    log "Backed up $log_count log files"

    # Create tarball
    if [ "$log_count" -gt 0 ]; then
        tar -czf "${logs_backup}.tar.gz" -C "$BACKUP_DIR" "logs_${TIMESTAMP}" || {
            log_error "Failed to create logs tarball"
            return 1
        }
        log_success "Logs backed up to ${logs_backup}.tar.gz"
    fi

    rm -rf "$logs_backup"
}

upload_to_s3() {
    if [ -z "$S3_BUCKET" ]; then
        log "S3 not configured, skipping upload"
        return 0
    fi

    log "Uploading app state backups to S3..."

    aws s3 sync "$BACKUP_DIR" "s3://${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}/" \
        --exclude "*.tmp" \
        --storage-class STANDARD || {
        log_error "Failed to upload to S3"
        return 1
    }

    log_success "App state backups uploaded to S3"
}

cleanup_old_backups() {
    log "Cleaning up old app state backups (retention: 30 days)..."

    find "$BACKUP_DIR" -type f -mtime +30 -delete || {
        log "Failed to cleanup old backups"
    }

    log_success "Old backups cleaned up"
}

################################################################################
# Main Process
################################################################################

main() {
    log "========================================="
    log "ServiceDesk App State Backup"
    log "Timestamp: $TIMESTAMP"
    log "========================================="

    mkdir -p "$BACKUP_DIR" "$LOG_DIR"

    # Perform backups
    backup_uploads
    backup_config
    backup_env
    backup_logs

    # Upload to S3
    upload_to_s3

    # Cleanup
    cleanup_old_backups

    log_success "========================================="
    log_success "App state backup completed!"
    log_success "========================================="
}

main "$@"
