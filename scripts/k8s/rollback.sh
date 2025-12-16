#!/bin/bash
# ServiceDesk Kubernetes Rollback Script
# Usage: ./scripts/k8s/rollback.sh [environment] [revision]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-production}"
REVISION="${2:-0}"
NAMESPACE="servicedesk"

# Functions
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

print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     ServiceDesk Kubernetes Rollback                       ║"
    echo "║     Environment: ${ENVIRONMENT}                                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

set_namespace() {
    case "${ENVIRONMENT}" in
        dev)
            NAMESPACE="servicedesk-dev"
            ;;
        staging)
            NAMESPACE="servicedesk-staging"
            ;;
        production)
            NAMESPACE="servicedesk"
            ;;
        *)
            log_error "Invalid environment: ${ENVIRONMENT}"
            exit 1
            ;;
    esac
}

show_history() {
    log_info "Deployment history for ${ENVIRONMENT}:"
    echo ""
    kubectl rollout history deployment/servicedesk-app -n "${NAMESPACE}"
    echo ""
}

rollback() {
    log_warning "Rolling back deployment in ${ENVIRONMENT}"

    if [[ "${REVISION}" == "0" ]]; then
        log_info "Rolling back to previous revision..."
        kubectl rollout undo deployment/servicedesk-app -n "${NAMESPACE}"
    else
        log_info "Rolling back to revision ${REVISION}..."
        kubectl rollout undo deployment/servicedesk-app -n "${NAMESPACE}" --to-revision="${REVISION}"
    fi

    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/servicedesk-app -n "${NAMESPACE}" --timeout=300s

    log_success "Rollback completed successfully"
}

verify() {
    log_info "Verifying deployment..."
    echo ""

    # Check pods
    log_info "Pods:"
    kubectl get pods -n "${NAMESPACE}" -l app=servicedesk,component=app

    echo ""
    log_info "Deployment status:"
    kubectl get deployment servicedesk-app -n "${NAMESPACE}"

    echo ""
    log_info "Recent events:"
    kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' | tail -10
}

# Main execution
main() {
    print_banner
    set_namespace

    # Show history
    show_history

    # Confirm rollback
    if [[ "${REVISION}" == "0" ]]; then
        log_warning "This will rollback to the PREVIOUS revision"
    else
        log_warning "This will rollback to revision ${REVISION}"
    fi

    read -p "Are you sure? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi

    # Perform rollback
    rollback

    # Verify
    verify

    log_success "Rollback completed"
}

main
