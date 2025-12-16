#!/bin/bash
# ==============================================================================
# ServiceDesk Docker Health Check Script
# Comprehensive health verification for containerized services
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
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
VERBOSE="${VERBOSE:-false}"

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

check_docker() {
    print_header "Docker Daemon Health"

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or accessible"
        exit 1
    fi

    log_success "Docker daemon is running"

    # Check Docker version
    local docker_version=$(docker version --format '{{.Server.Version}}')
    log_info "Docker version: $docker_version"

    # Check Docker disk usage
    local disk_usage=$(docker system df --format "table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}")
    if [ "$VERBOSE" = "true" ]; then
        echo "$disk_usage"
    fi
}

check_services_running() {
    print_header "Service Status"

    if ! docker-compose -f "$COMPOSE_FILE" ps &> /dev/null; then
        log_warning "No services are running"
        return 1
    fi

    # List all services
    local services=$(docker-compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | jq -r '.Name' 2>/dev/null || docker-compose -f "$COMPOSE_FILE" ps --services)

    local all_healthy=true

    for service in $services; do
        local status=$(docker-compose -f "$COMPOSE_FILE" ps "$service" --format json 2>/dev/null | jq -r '.State' 2>/dev/null || echo "unknown")

        if [ "$status" = "running" ]; then
            log_success "Service '$service' is running"
        else
            log_error "Service '$service' is $status"
            all_healthy=false
        fi
    done

    if [ "$all_healthy" = "true" ]; then
        return 0
    else
        return 1
    fi
}

check_container_health() {
    print_header "Container Health Checks"

    local containers=$(docker-compose -f "$COMPOSE_FILE" ps -q 2>/dev/null)

    if [ -z "$containers" ]; then
        log_warning "No containers found"
        return 1
    fi

    local all_healthy=true

    for container in $containers; do
        local container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\/\///')
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no_healthcheck")

        case "$health_status" in
            "healthy")
                log_success "Container '$container_name' is healthy"
                ;;
            "unhealthy")
                log_error "Container '$container_name' is unhealthy"
                all_healthy=false

                # Show last health check log
                if [ "$VERBOSE" = "true" ]; then
                    local last_log=$(docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' "$container" | tail -n 5)
                    echo "  Last health check output:"
                    echo "$last_log" | sed 's/^/    /'
                fi
                ;;
            "starting")
                log_warning "Container '$container_name' is still starting"
                all_healthy=false
                ;;
            "no_healthcheck")
                log_info "Container '$container_name' has no health check defined"
                ;;
            *)
                log_warning "Container '$container_name' health status: $health_status"
                ;;
        esac
    done

    if [ "$all_healthy" = "true" ]; then
        return 0
    else
        return 1
    fi
}

check_application_endpoints() {
    print_header "Application Endpoints"

    # Check main application
    log_info "Checking application health endpoint..."
    if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
        log_success "Application health endpoint: OK (200)"
    else
        log_error "Application health endpoint: FAILED"
        return 1
    fi

    # Check application response time
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/api/health 2>/dev/null || echo "0")
    log_info "Response time: ${response_time}s"

    if (( $(echo "$response_time > 5.0" | bc -l) )); then
        log_warning "Response time is high (>${response_time}s)"
    fi
}

check_database_connection() {
    print_header "Database Health"

    local postgres_container=$(docker-compose -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null)

    if [ -z "$postgres_container" ]; then
        log_warning "PostgreSQL container not found"
        return 1
    fi

    # Check PostgreSQL is accepting connections
    if docker exec "$postgres_container" pg_isready -U servicedesk &> /dev/null; then
        log_success "PostgreSQL is accepting connections"
    else
        log_error "PostgreSQL is not accepting connections"
        return 1
    fi

    # Check database size
    if [ "$VERBOSE" = "true" ]; then
        local db_size=$(docker exec "$postgres_container" psql -U servicedesk -t -c "SELECT pg_size_pretty(pg_database_size('servicedesk'));" 2>/dev/null || echo "unknown")
        log_info "Database size: $db_size"

        # Check active connections
        local connections=$(docker exec "$postgres_container" psql -U servicedesk -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "unknown")
        log_info "Active connections: $connections"
    fi
}

check_redis_connection() {
    print_header "Redis Health"

    local redis_container=$(docker-compose -f "$COMPOSE_FILE" ps -q redis 2>/dev/null)

    if [ -z "$redis_container" ]; then
        log_warning "Redis container not found"
        return 1
    fi

    # Check Redis is responding
    if docker exec "$redis_container" redis-cli ping 2>/dev/null | grep -q "PONG"; then
        log_success "Redis is responding"
    else
        log_error "Redis is not responding"
        return 1
    fi

    if [ "$VERBOSE" = "true" ]; then
        # Check Redis memory usage
        local memory_used=$(docker exec "$redis_container" redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "unknown")
        log_info "Redis memory used: $memory_used"

        # Check connected clients
        local clients=$(docker exec "$redis_container" redis-cli info clients 2>/dev/null | grep "connected_clients" | cut -d: -f2 | tr -d '\r' || echo "unknown")
        log_info "Connected clients: $clients"
    fi
}

check_resource_usage() {
    print_header "Resource Usage"

    local containers=$(docker-compose -f "$COMPOSE_FILE" ps -q 2>/dev/null)

    if [ -z "$containers" ]; then
        log_warning "No containers found"
        return 1
    fi

    # Get resource stats
    local stats=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $containers)

    echo "$stats"
    echo ""

    # Check for high resource usage
    while read -r line; do
        if echo "$line" | grep -qE '[0-9]+\.[0-9]+%' && echo "$line" | grep -qE '([8-9][0-9]|100)\.[0-9]+%'; then
            log_warning "High resource usage detected: $line"
        fi
    done <<< "$stats"
}

check_logs_for_errors() {
    print_header "Recent Errors in Logs"

    local containers=$(docker-compose -f "$COMPOSE_FILE" ps -q 2>/dev/null)

    if [ -z "$containers" ]; then
        log_warning "No containers found"
        return 1
    fi

    local errors_found=false

    for container in $containers; do
        local container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\/\///')

        # Check for errors in last 100 lines
        local error_count=$(docker logs --tail=100 "$container" 2>&1 | grep -iE "(error|exception|fatal|critical)" | wc -l)

        if [ "$error_count" -gt 0 ]; then
            log_warning "Container '$container_name' has $error_count error(s) in recent logs"
            errors_found=true

            if [ "$VERBOSE" = "true" ]; then
                echo "  Recent errors:"
                docker logs --tail=100 "$container" 2>&1 | grep -iE "(error|exception|fatal|critical)" | tail -n 5 | sed 's/^/    /'
            fi
        else
            log_success "Container '$container_name' has no recent errors"
        fi
    done

    if [ "$errors_found" = "true" ]; then
        return 1
    fi
}

print_summary() {
    print_header "Health Check Summary"

    local status="HEALTHY"
    local exit_code=0

    # Aggregate results
    if ! check_services_running &> /dev/null; then
        status="DEGRADED"
        exit_code=1
    fi

    if ! check_container_health &> /dev/null; then
        status="UNHEALTHY"
        exit_code=2
    fi

    case "$status" in
        "HEALTHY")
            log_success "Overall Status: HEALTHY ✓"
            ;;
        "DEGRADED")
            log_warning "Overall Status: DEGRADED"
            ;;
        "UNHEALTHY")
            log_error "Overall Status: UNHEALTHY ✗"
            ;;
    esac

    return $exit_code
}

# ==============================================================================
# Main
# ==============================================================================
main() {
    print_header "ServiceDesk Health Check"

    local exit_code=0

    check_docker || exit_code=$?
    check_services_running || exit_code=$?
    check_container_health || exit_code=$?
    check_application_endpoints || exit_code=$?
    check_database_connection || exit_code=$?
    check_redis_connection || exit_code=$?
    check_resource_usage || exit_code=$?
    check_logs_for_errors || exit_code=$?
    print_summary || exit_code=$?

    exit $exit_code
}

# Run main function
main "$@"
