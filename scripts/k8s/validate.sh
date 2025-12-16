#!/bin/bash
# ServiceDesk Kubernetes Validation Script
# Validates all manifests and checks configuration

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
K8S_DIR="${PROJECT_ROOT}/k8s"

ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERRORS++))
}

print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     ServiceDesk Kubernetes Validation                     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # kubectl
    if command -v kubectl &> /dev/null; then
        VERSION=$(kubectl version --client --short 2>/dev/null | grep -oP 'v\d+\.\d+' || echo "unknown")
        log_success "kubectl installed: ${VERSION}"
    else
        log_error "kubectl not found"
    fi

    # kustomize
    if command -v kustomize &> /dev/null; then
        VERSION=$(kustomize version --short 2>/dev/null | grep -oP 'v\d+\.\d+\.\d+' || echo "unknown")
        log_success "kustomize installed: ${VERSION}"
    else
        log_warning "kustomize not found (will use kubectl kustomize)"
    fi

    # docker
    if command -v docker &> /dev/null; then
        VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' || echo "unknown")
        log_success "docker installed: ${VERSION}"
    else
        log_warning "docker not found (needed for building images)"
    fi
}

validate_yaml_syntax() {
    log_info "Validating YAML syntax..."

    local yaml_files=$(find "${K8S_DIR}" -type f -name "*.yaml" -not -path "*/node_modules/*")

    for file in ${yaml_files}; do
        if kubectl apply --dry-run=client -f "${file}" &> /dev/null; then
            log_success "Valid YAML: $(basename ${file})"
        else
            log_error "Invalid YAML: ${file}"
        fi
    done
}

validate_kustomizations() {
    log_info "Validating Kustomizations..."

    for env in dev staging production; do
        local overlay_dir="${K8S_DIR}/overlays/${env}"

        if [[ -f "${overlay_dir}/kustomization.yaml" ]]; then
            if kubectl kustomize "${overlay_dir}" &> /dev/null; then
                log_success "Valid kustomization: ${env}"
            else
                log_error "Invalid kustomization: ${env}"
            fi
        else
            log_error "Missing kustomization.yaml in ${env}"
        fi
    done
}

check_base_manifests() {
    log_info "Checking base manifests..."

    local required_files=(
        "deployment.yaml"
        "service.yaml"
        "ingress.yaml"
        "configmap.yaml"
        "secrets.yaml"
        "hpa.yaml"
        "network-policy.yaml"
        "kustomization.yaml"
    )

    for file in "${required_files[@]}"; do
        if [[ -f "${K8S_DIR}/base/${file}" ]]; then
            log_success "Found: ${file}"
        else
            log_error "Missing: ${file}"
        fi
    done
}

check_statefulsets() {
    log_info "Checking StatefulSets..."

    if [[ -f "${K8S_DIR}/statefulsets/postgres-statefulset.yaml" ]]; then
        log_success "Found: postgres-statefulset.yaml"
    else
        log_error "Missing: postgres-statefulset.yaml"
    fi

    if [[ -f "${K8S_DIR}/statefulsets/redis-statefulset.yaml" ]]; then
        log_success "Found: redis-statefulset.yaml"
    else
        log_error "Missing: redis-statefulset.yaml"
    fi
}

check_monitoring() {
    log_info "Checking monitoring manifests..."

    if [[ -f "${K8S_DIR}/monitoring/servicemonitor.yaml" ]]; then
        log_success "Found: servicemonitor.yaml"
    else
        log_warning "Missing: servicemonitor.yaml (optional if not using Prometheus Operator)"
    fi

    if [[ -f "${K8S_DIR}/monitoring/grafana-dashboard.yaml" ]]; then
        log_success "Found: grafana-dashboard.yaml"
    else
        log_warning "Missing: grafana-dashboard.yaml (optional)"
    fi
}

check_scripts() {
    log_info "Checking deployment scripts..."

    if [[ -f "${SCRIPT_DIR}/deploy.sh" && -x "${SCRIPT_DIR}/deploy.sh" ]]; then
        log_success "deploy.sh is executable"
    else
        log_error "deploy.sh missing or not executable"
    fi

    if [[ -f "${SCRIPT_DIR}/rollback.sh" && -x "${SCRIPT_DIR}/rollback.sh" ]]; then
        log_success "rollback.sh is executable"
    else
        log_error "rollback.sh missing or not executable"
    fi
}

check_documentation() {
    log_info "Checking documentation..."

    if [[ -f "${K8S_DIR}/README.md" ]]; then
        log_success "Found: k8s/README.md"
    else
        log_warning "Missing: k8s/README.md"
    fi

    if [[ -f "${K8S_DIR}/QUICK-START.md" ]]; then
        log_success "Found: k8s/QUICK-START.md"
    else
        log_warning "Missing: k8s/QUICK-START.md"
    fi

    if [[ -f "${PROJECT_ROOT}/docs/K8S-DEPLOYMENT-GUIDE.md" ]]; then
        log_success "Found: docs/K8S-DEPLOYMENT-GUIDE.md"
    else
        log_warning "Missing: docs/K8S-DEPLOYMENT-GUIDE.md"
    fi
}

check_security() {
    log_info "Checking security configuration..."

    # Check if secrets.yaml contains REPLACE_WITH
    if grep -q "REPLACE_WITH" "${K8S_DIR}/base/secrets.yaml" 2>/dev/null; then
        log_success "secrets.yaml is a template (good, contains REPLACE_WITH)"
    else
        log_error "secrets.yaml may contain real secrets!"
    fi

    # Check for hardcoded secrets in manifests
    local suspicious_patterns=("password:" "secret:" "token:" "key:")

    for pattern in "${suspicious_patterns[@]}"; do
        if grep -ri "${pattern}" "${K8S_DIR}" --include="*.yaml" | grep -v "REPLACE_WITH" | grep -v "secretRef" | grep -v "secretKeyRef" | grep -v "name:" &> /dev/null; then
            log_warning "Found potential hardcoded secrets with pattern: ${pattern}"
        fi
    done
}

print_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                    Validation Summary                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    if [[ ${ERRORS} -eq 0 && ${WARNINGS} -eq 0 ]]; then
        log_success "All checks passed! ✓"
        echo ""
        log_info "Next steps:"
        echo "  1. Build and push Docker image"
        echo "  2. Update image reference in kustomization.yaml"
        echo "  3. Create secrets: kubectl create secret ..."
        echo "  4. Deploy: ./scripts/k8s/deploy.sh production deploy"
        return 0
    elif [[ ${ERRORS} -eq 0 ]]; then
        echo -e "${YELLOW}Validation completed with ${WARNINGS} warning(s)${NC}"
        echo ""
        log_info "Warnings can usually be ignored, but review them before production deployment"
        return 0
    else
        echo -e "${RED}Validation failed with ${ERRORS} error(s) and ${WARNINGS} warning(s)${NC}"
        echo ""
        log_error "Fix errors before deploying to production"
        return 1
    fi
}

# Main execution
main() {
    print_banner
    check_prerequisites
    echo ""
    check_base_manifests
    echo ""
    check_statefulsets
    echo ""
    check_monitoring
    echo ""
    check_scripts
    echo ""
    check_documentation
    echo ""
    check_security
    echo ""
    validate_yaml_syntax
    echo ""
    validate_kustomizations
    echo ""
    print_summary
}

main
exit $?
