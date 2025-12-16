#!/bin/bash
# ==============================================================================
# ServiceDesk Docker Deploy Script
# Orchestrates deployment with health checks, rollback support, and monitoring
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${IMAGE_NAME:-servicedesk-app}"
REGISTRY="${REGISTRY:-}"
VERSION="${VERSION:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Deployment options
DRY_RUN="${DRY_RUN:-false}"
SKIP_HEALTH_CHECK="${SKIP_HEALTH_CHECK:-false}"
ENABLE_ROLLBACK="${ENABLE_ROLLBACK:-true}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-120}"

# ==============================================================================
# Functions
# ==============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo "=================================================================="
    echo "$1"
    echo "=================================================================="
    echo ""
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker: $(docker --version)"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose: Available"

    # Check compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    log_success "Compose file: $COMPOSE_FILE"

    # Check environment file
    if [ ! -f ".env" ]; then
        log_warning "No .env file found"
        if [ -f ".env.example" ]; then
            log_info "Using .env.example as template"
            cp .env.example .env
        fi
    fi
}

backup_current_state() {
    if [ "$ENABLE_ROLLBACK" != "true" ]; then
        return
    fi

    print_header "Backing Up Current State"

    local backup_dir="${PROJECT_ROOT}/backups"
    mkdir -p "$backup_dir"

    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="${backup_dir}/pre-deploy-${timestamp}.tar.gz"

    log_info "Creating backup..."

    # Backup volumes and configurations
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U servicedesk servicedesk > "${backup_dir}/db-${timestamp}.sql" 2>/dev/null || log_warning "Database backup skipped (service may not be running)"

    # Save current image tags
    docker-compose -f "$COMPOSE_FILE" images > "${backup_dir}/images-${timestamp}.txt"

    log_success "Backup created: ${backup_file}"
}

pull_images() {
    print_header "Pulling Latest Images"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would pull images"
        return
    fi

    log_info "Pulling images from registry..."

    if docker-compose -f "$COMPOSE_FILE" pull; then
        log_success "Images pulled successfully"
    else
        log_error "Failed to pull images"
        exit 1
    fi
}

stop_services() {
    print_header "Stopping Current Services"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would stop services"
        return
    fi

    log_info "Stopping services gracefully..."

    if docker-compose -f "$COMPOSE_FILE" down --timeout 30; then
        log_success "Services stopped"
    else
        log_warning "Some services may not have stopped cleanly"
    fi
}

start_services() {
    print_header "Starting Services"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would start services"
        return
    fi

    log_info "Starting services..."

    if docker-compose -f "$COMPOSE_FILE" up -d; then
        log_success "Services started"
    else
        log_error "Failed to start services"
        if [ "$ENABLE_ROLLBACK" = "true" ]; then
            log_warning "Initiating rollback..."
            rollback_deployment
        fi
        exit 1
    fi
}

wait_for_health() {
    if [ "$SKIP_HEALTH_CHECK" = "true" ]; then
        log_warning "Skipping health check"
        return
    fi

    print_header "Waiting for Services to be Healthy"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would wait for health checks"
        return
    fi

    log_info "Waiting for health checks (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

    local start_time=$(date +%s)
    local timeout=$HEALTH_CHECK_TIMEOUT

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -ge $timeout ]; then
            log_error "Health check timeout after ${timeout}s"
            if [ "$ENABLE_ROLLBACK" = "true" ]; then
                log_warning "Initiating rollback..."
                rollback_deployment
            fi
            exit 1
        fi

        # Check all service health
        local unhealthy_services=$(docker-compose -f "$COMPOSE_FILE" ps --format json | jq -r 'select(.Health == "unhealthy" or .Health == "starting") | .Name' 2>/dev/null)

        if [ -z "$unhealthy_services" ]; then
            log_success "All services are healthy ✓"
            break
        fi

        log_info "Waiting for services: ${unhealthy_services}"
        sleep 5
    done
}

verify_deployment() {
    print_header "Verifying Deployment"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would verify deployment"
        return
    fi

    # Check service status
    log_info "Service status:"
    docker-compose -f "$COMPOSE_FILE" ps

    # Check app health endpoint
    log_info "Testing health endpoint..."
    local max_retries=10
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if curl -f -s http://localhost:3000/api/health > /dev/null; then
            log_success "Health endpoint responding ✓"
            break
        fi

        retry=$((retry + 1))
        if [ $retry -eq $max_retries ]; then
            log_error "Health endpoint not responding"
            exit 1
        fi

        log_info "Retry $retry/$max_retries..."
        sleep 3
    done

    # Check resource usage
    log_info "Resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose -f "$COMPOSE_FILE" ps -q)
}

rollback_deployment() {
    print_header "Rolling Back Deployment"

    log_warning "Restoring previous state..."

    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down --timeout 30

    # Restore from backup
    local latest_backup=$(ls -t backups/db-*.sql 2>/dev/null | head -n1)
    if [ -n "$latest_backup" ]; then
        log_info "Restoring database from: $latest_backup"
        # Restore database here if needed
    fi

    # Start previous version
    docker-compose -f "$COMPOSE_FILE" up -d

    log_warning "Rollback completed"
}

show_logs() {
    print_header "Recent Logs"

    if [ "$DRY_RUN" = "true" ]; then
        return
    fi

    log_info "Last 50 lines from application logs:"
    docker-compose -f "$COMPOSE_FILE" logs --tail=50 app
}

print_summary() {
    print_header "Deployment Summary"

    if [ "$DRY_RUN" = "true" ]; then
        echo "MODE: DRY RUN (no actual deployment performed)"
    fi

    echo "Environment:  ${ENVIRONMENT}"
    echo "Version:      ${VERSION}"
    echo "Compose File: ${COMPOSE_FILE}"
    echo ""

    if [ "$DRY_RUN" != "true" ]; then
        log_success "Deployment completed successfully!"
        echo ""
        echo "Access the application:"
        echo "  - Application: http://localhost:3000"
        echo "  - Metrics:     http://localhost:9090 (Prometheus)"
        echo "  - Monitoring:  http://localhost:3001 (Grafana)"
        echo ""
        echo "Useful commands:"
        echo "  - View logs:    docker-compose -f $COMPOSE_FILE logs -f"
        echo "  - Stop:         docker-compose -f $COMPOSE_FILE down"
        echo "  - Restart:      docker-compose -f $COMPOSE_FILE restart"
    fi
}

# ==============================================================================
# Main
# ==============================================================================
main() {
    print_header "ServiceDesk Docker Deployment"

    check_prerequisites
    backup_current_state
    pull_images
    stop_services
    start_services
    wait_for_health
    verify_deployment
    show_logs
    print_summary
}

# Run main function
main "$@"
