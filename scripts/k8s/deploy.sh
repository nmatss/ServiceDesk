#!/bin/bash
# ServiceDesk Kubernetes Deployment Script
# Usage: ./scripts/k8s/deploy.sh [environment] [action]
# Example: ./scripts/k8s/deploy.sh production deploy

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
K8S_DIR="${PROJECT_ROOT}/k8s"

# Default values
ENVIRONMENT="${1:-dev}"
ACTION="${2:-deploy}"
NAMESPACE="servicedesk"
DRY_RUN="${DRY_RUN:-false}"

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
    echo "║     ServiceDesk Kubernetes Deployment                     ║"
    echo "║     Environment: ${ENVIRONMENT}                                      ║"
    echo "║     Action: ${ACTION}                                           ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl first."
        exit 1
    fi

    # Check kustomize
    if ! command -v kustomize &> /dev/null; then
        log_warning "kustomize not found. Using kubectl kustomize..."
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

validate_environment() {
    case "${ENVIRONMENT}" in
        dev|staging|production)
            log_info "Environment: ${ENVIRONMENT}"
            ;;
        *)
            log_error "Invalid environment: ${ENVIRONMENT}"
            log_info "Valid environments: dev, staging, production"
            exit 1
            ;;
    esac

    # Set namespace based on environment
    if [[ "${ENVIRONMENT}" == "dev" ]]; then
        NAMESPACE="servicedesk-dev"
    elif [[ "${ENVIRONMENT}" == "staging" ]]; then
        NAMESPACE="servicedesk-staging"
    else
        NAMESPACE="servicedesk"
    fi
}

create_namespace() {
    log_info "Creating namespace: ${NAMESPACE}"

    if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        log_warning "Namespace ${NAMESPACE} already exists"
    else
        kubectl create namespace "${NAMESPACE}"
        log_success "Namespace ${NAMESPACE} created"
    fi

    # Label namespace
    kubectl label namespace "${NAMESPACE}" \
        environment="${ENVIRONMENT}" \
        app=servicedesk \
        --overwrite
}

create_secrets() {
    log_info "Creating secrets..."

    # Check if secrets already exist
    if kubectl get secret servicedesk-secrets -n "${NAMESPACE}" &> /dev/null; then
        log_warning "Secrets already exist. Skipping creation."
        log_info "To update secrets, use: kubectl delete secret servicedesk-secrets -n ${NAMESPACE}"
        return
    fi

    # Generate secrets if not exist
    JWT_SECRET=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)

    log_info "Generating secrets..."

    kubectl create secret generic servicedesk-secrets \
        --from-literal=JWT_SECRET="${JWT_SECRET}" \
        --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
        --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        --from-literal=DATABASE_URL="postgresql://servicedesk:CHANGE_ME@servicedesk-postgres:5432/servicedesk" \
        --from-literal=REDIS_PASSWORD="CHANGE_ME" \
        --namespace="${NAMESPACE}"

    log_success "Secrets created"
    log_warning "IMPORTANT: Update secrets with actual values using kubectl edit secret"
}

validate_manifests() {
    log_info "Validating manifests..."

    if [[ "${DRY_RUN}" == "true" ]]; then
        kubectl apply --dry-run=client -k "${K8S_DIR}/overlays/${ENVIRONMENT}/"
    else
        kubectl apply --dry-run=server -k "${K8S_DIR}/overlays/${ENVIRONMENT}/"
    fi

    log_success "Manifest validation passed"
}

deploy() {
    log_info "Deploying ServiceDesk to ${ENVIRONMENT}..."

    # Apply manifests
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be applied"
        kubectl apply --dry-run=client -k "${K8S_DIR}/overlays/${ENVIRONMENT}/"
    else
        kubectl apply -k "${K8S_DIR}/overlays/${ENVIRONMENT}/" --namespace="${NAMESPACE}"
    fi

    log_success "Deployment applied"

    # Wait for rollout
    if [[ "${DRY_RUN}" != "true" ]]; then
        log_info "Waiting for deployment to complete..."
        kubectl rollout status deployment/servicedesk-app -n "${NAMESPACE}" --timeout=300s
        log_success "Deployment completed successfully"
    fi
}

status() {
    log_info "Checking deployment status..."

    echo ""
    log_info "Pods:"
    kubectl get pods -n "${NAMESPACE}" -l app=servicedesk

    echo ""
    log_info "Services:"
    kubectl get services -n "${NAMESPACE}" -l app=servicedesk

    echo ""
    log_info "Ingress:"
    kubectl get ingress -n "${NAMESPACE}"

    echo ""
    log_info "HPA:"
    kubectl get hpa -n "${NAMESPACE}"

    echo ""
    log_info "PVC:"
    kubectl get pvc -n "${NAMESPACE}"
}

logs() {
    log_info "Fetching logs..."

    POD=$(kubectl get pods -n "${NAMESPACE}" -l app=servicedesk,component=app -o jsonpath='{.items[0].metadata.name}')

    if [[ -z "${POD}" ]]; then
        log_error "No pods found"
        exit 1
    fi

    log_info "Tailing logs from pod: ${POD}"
    kubectl logs -f "${POD}" -n "${NAMESPACE}"
}

delete() {
    log_warning "This will delete all ServiceDesk resources in ${ENVIRONMENT}"
    read -p "Are you sure? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Deletion cancelled"
        exit 0
    fi

    log_info "Deleting resources..."
    kubectl delete -k "${K8S_DIR}/overlays/${ENVIRONMENT}/" --namespace="${NAMESPACE}"

    log_success "Resources deleted"
}

restart() {
    log_info "Restarting deployment..."

    kubectl rollout restart deployment/servicedesk-app -n "${NAMESPACE}"
    kubectl rollout status deployment/servicedesk-app -n "${NAMESPACE}" --timeout=300s

    log_success "Deployment restarted"
}

scale() {
    REPLICAS="${3:-3}"

    log_info "Scaling deployment to ${REPLICAS} replicas..."

    kubectl scale deployment/servicedesk-app -n "${NAMESPACE}" --replicas="${REPLICAS}"

    log_success "Deployment scaled to ${REPLICAS} replicas"
}

# Main execution
main() {
    print_banner
    check_prerequisites
    validate_environment

    case "${ACTION}" in
        deploy)
            create_namespace
            create_secrets
            validate_manifests
            deploy
            status
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        delete)
            delete
            ;;
        restart)
            restart
            ;;
        scale)
            scale "$@"
            ;;
        validate)
            validate_manifests
            ;;
        *)
            log_error "Invalid action: ${ACTION}"
            echo ""
            echo "Usage: $0 [environment] [action]"
            echo ""
            echo "Environments: dev, staging, production"
            echo "Actions:"
            echo "  deploy    - Deploy application"
            echo "  status    - Show deployment status"
            echo "  logs      - Tail application logs"
            echo "  delete    - Delete all resources"
            echo "  restart   - Restart deployment"
            echo "  scale     - Scale deployment (requires replicas count)"
            echo "  validate  - Validate manifests"
            echo ""
            echo "Examples:"
            echo "  $0 production deploy"
            echo "  $0 staging status"
            echo "  $0 dev logs"
            echo "  $0 production scale 5"
            exit 1
            ;;
    esac
}

main "$@"
