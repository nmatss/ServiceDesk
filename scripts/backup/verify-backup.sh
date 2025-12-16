#!/bin/bash

################################################################################
# Backup Verification Script - ServiceDesk
#
# Verifies backup integrity:
# - Checksum verification
# - Test restore in isolated environment
# - Completeness validation
# - Decryption test (if encrypted)
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/servicedesk}"
TEST_RESTORE_DIR="${TEST_RESTORE_DIR:-/tmp/servicedesk-restore-test}"
LOG_DIR="${LOG_DIR:-/var/log/servicedesk/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/verify_${TIMESTAMP}.log"

# Storage
STORAGE_TYPE="${STORAGE_TYPE:-s3}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups/database}"

# Encryption
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@servicedesk.com}"
AWS_KMS_KEY_ID="${AWS_KMS_KEY_ID:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verification results
VERIFICATION_PASSED=0
VERIFICATION_FAILED=0

################################################################################
# Helper Functions
################################################################################

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2
    ((VERIFICATION_FAILED++))
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} [$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
    ((VERIFICATION_PASSED++))
}

cleanup() {
    log "Cleaning up test environment..."
    rm -rf "$TEST_RESTORE_DIR"
}

################################################################################
# Verification Functions
################################################################################

list_backups() {
    log "Listing available backups..."

    case "$STORAGE_TYPE" in
        s3)
            if [ -z "$S3_BUCKET" ]; then
                log_error "S3_BUCKET not configured"
                return 1
            fi
            aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | \
                grep -E '\.(backup|gz|gpg)$' | \
                tail -10
            ;;
        local)
            find "$BACKUP_DIR" -type f -name "*.gz.gpg" -o -name "*.gz" | \
                sort -r | head -10
            ;;
        *)
            log_error "Unknown storage type: $STORAGE_TYPE"
            return 1
            ;;
    esac
}

download_backup() {
    local backup_file=$1
    local destination=$2

    log "Downloading backup: $backup_file"

    case "$STORAGE_TYPE" in
        s3)
            aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${backup_file}" "$destination" || {
                log_error "Failed to download from S3"
                return 1
            }
            ;;
        local)
            cp "$BACKUP_DIR/$backup_file" "$destination" || {
                log_error "Failed to copy backup file"
                return 1
            }
            ;;
    esac

    log_success "Backup downloaded: $destination"
}

verify_checksum() {
    local backup_file=$1

    log "Verifying checksum for: $backup_file"

    local checksum_file="${backup_file}.sha256"

    # Download checksum file
    case "$STORAGE_TYPE" in
        s3)
            aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$checksum_file")" "$checksum_file" || {
                log_error "Checksum file not found"
                return 1
            }
            ;;
        local)
            if [ ! -f "$checksum_file" ]; then
                log_error "Checksum file not found: $checksum_file"
                return 1
            fi
            ;;
    esac

    # Verify checksum
    cd "$(dirname "$backup_file")"
    sha256sum -c "$(basename "$checksum_file")" || {
        log_error "Checksum verification failed!"
        return 1
    }
    cd - > /dev/null

    log_success "Checksum verification passed"
}

test_decrypt() {
    local encrypted_file=$1
    local output_file=$2

    log "Testing decryption: $encrypted_file"

    if [[ "$encrypted_file" != *.gpg ]]; then
        log "File not encrypted, skipping decryption test"
        cp "$encrypted_file" "$output_file"
        return 0
    fi

    if [ -n "$AWS_KMS_KEY_ID" ]; then
        # Decrypt using AWS KMS
        aws kms decrypt \
            --ciphertext-blob "fileb://$encrypted_file" \
            --output text \
            --query Plaintext | base64 -d > "$output_file" || {
            log_error "AWS KMS decryption failed"
            return 1
        }
    else
        # Decrypt using GPG
        gpg --batch --yes --decrypt \
            --output "$output_file" "$encrypted_file" || {
            log_error "GPG decryption failed"
            return 1
        }
    fi

    log_success "Decryption test passed"
}

test_decompress() {
    local compressed_file=$1
    local output_file=$2

    log "Testing decompression: $compressed_file"

    gunzip -c "$compressed_file" > "$output_file" || {
        log_error "Decompression failed"
        return 1
    }

    log_success "Decompression test passed"
}

test_restore_sqlite() {
    local backup_file=$1

    log "Testing SQLite restore: $backup_file"

    local test_db="$TEST_RESTORE_DIR/test.db"

    # Restore database
    cp "$backup_file" "$test_db" || {
        log_error "Failed to copy backup file"
        return 1
    }

    # Test database integrity
    sqlite3 "$test_db" "PRAGMA integrity_check;" | grep -q "ok" || {
        log_error "SQLite integrity check failed"
        return 1
    }

    # Test basic queries
    local table_count=$(sqlite3 "$test_db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    log "Restored database has $table_count tables"

    if [ "$table_count" -eq 0 ]; then
        log_error "Restored database has no tables"
        return 1
    fi

    log_success "SQLite restore test passed"
}

test_restore_postgres() {
    local backup_file=$1

    log "Testing PostgreSQL restore: $backup_file"

    local test_db="test_restore_$(date +%s)"

    # Create test database
    export PGPASSWORD="${DB_PASSWORD:-}"
    createdb -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" "$test_db" || {
        log_error "Failed to create test database"
        return 1
    }

    # Restore backup
    pg_restore -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
        -U "${DB_USER:-postgres}" -d "$test_db" "$backup_file" || {
        log_error "PostgreSQL restore failed"
        dropdb -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" "$test_db" 2>/dev/null
        return 1
    }

    # Test database
    local table_count=$(psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
        -U "${DB_USER:-postgres}" -d "$test_db" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

    log "Restored database has $table_count tables"

    # Cleanup test database
    dropdb -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" "$test_db"

    if [ "$table_count" -eq 0 ]; then
        log_error "Restored database has no tables"
        return 1
    fi

    log_success "PostgreSQL restore test passed"
}

verify_backup_completeness() {
    local backup_file=$1

    log "Verifying backup completeness..."

    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file")
    local min_size=$((1024 * 100)) # Minimum 100KB

    if [ "$file_size" -lt "$min_size" ]; then
        log_error "Backup file too small: $file_size bytes (expected > $min_size)"
        return 1
    fi

    log "Backup size: $(numfmt --to=iec-i --suffix=B $file_size)"

    # Check if file is not corrupted
    file "$backup_file" | grep -qE "(SQLite|gzip|GPG)" || {
        log_error "Backup file type not recognized"
        return 1
    }

    log_success "Backup completeness check passed"
}

################################################################################
# Main Verification Process
################################################################################

verify_latest_backup() {
    log "========================================="
    log "Verifying Latest Backup"
    log "========================================="

    mkdir -p "$TEST_RESTORE_DIR" "$LOG_DIR"
    trap cleanup EXIT

    # Get latest backup file
    local latest_backup=""
    case "$STORAGE_TYPE" in
        s3)
            latest_backup=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | \
                grep -E '\.backup\.gz\.gpg$' | \
                sort -r | head -1 | awk '{print $4}' | xargs basename)
            ;;
        local)
            latest_backup=$(find "$BACKUP_DIR" -type f -name "*.backup.gz.gpg" | \
                sort -r | head -1 | xargs basename)
            ;;
    esac

    if [ -z "$latest_backup" ]; then
        log_error "No backups found"
        exit 1
    fi

    log "Latest backup: $latest_backup"

    # Download backup
    local local_backup="$TEST_RESTORE_DIR/$latest_backup"
    download_backup "$latest_backup" "$local_backup"

    # Verify checksum
    verify_checksum "$local_backup"

    # Verify completeness
    verify_backup_completeness "$local_backup"

    # Test decryption
    local decrypted_file="$TEST_RESTORE_DIR/decrypted.gz"
    test_decrypt "$local_backup" "$decrypted_file"

    # Test decompression
    local decompressed_file="$TEST_RESTORE_DIR/restored.backup"
    test_decompress "$decrypted_file" "$decompressed_file"

    # Test restore based on database type
    if echo "$latest_backup" | grep -q "sqlite"; then
        test_restore_sqlite "$decompressed_file"
    else
        test_restore_postgres "$decompressed_file"
    fi

    log "========================================="
    log "Verification Summary:"
    log "Checks Passed: $VERIFICATION_PASSED"
    log "Checks Failed: $VERIFICATION_FAILED"
    log "========================================="

    if [ "$VERIFICATION_FAILED" -eq 0 ]; then
        log_success "All verification checks passed!"
        exit 0
    else
        log_error "Some verification checks failed!"
        exit 1
    fi
}

# Main execution
case "${1:-latest}" in
    latest)
        verify_latest_backup
        ;;
    list)
        list_backups
        ;;
    *)
        echo "Usage: $0 {latest|list}"
        exit 1
        ;;
esac
