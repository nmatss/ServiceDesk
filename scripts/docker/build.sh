#!/bin/bash
# ==============================================================================
# ServiceDesk Docker Build Script
# Optimized build with layer caching, SBOM generation, and security scanning
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
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Build options
ENABLE_CACHE="${ENABLE_CACHE:-true}"
ENABLE_SBOM="${ENABLE_SBOM:-true}"
ENABLE_SECURITY_SCAN="${ENABLE_SECURITY_SCAN:-true}"
DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"

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

    # Check BuildKit
    if [ "$DOCKER_BUILDKIT" = "1" ]; then
        export DOCKER_BUILDKIT=1
        log_success "BuildKit: Enabled"
    fi

    # Check Trivy (optional)
    if [ "$ENABLE_SECURITY_SCAN" = "true" ]; then
        if ! command -v trivy &> /dev/null; then
            log_warning "Trivy not installed - security scanning will be skipped"
            ENABLE_SECURITY_SCAN="false"
        else
            log_success "Trivy: $(trivy --version | head -n1)"
        fi
    fi

    # Check syft for SBOM (optional)
    if [ "$ENABLE_SBOM" = "true" ]; then
        if ! command -v syft &> /dev/null; then
            log_warning "Syft not installed - SBOM generation will be skipped"
            ENABLE_SBOM="false"
        else
            log_success "Syft: $(syft version | head -n1)"
        fi
    fi
}

build_image() {
    print_header "Building Docker Image"

    local full_image_name="${IMAGE_NAME}:${VERSION}"
    if [ -n "$REGISTRY" ]; then
        full_image_name="${REGISTRY}/${full_image_name}"
    fi

    log_info "Image: ${full_image_name}"
    log_info "Build Date: ${BUILD_DATE}"
    log_info "Git Commit: ${GIT_COMMIT}"
    log_info "Git Branch: ${GIT_BRANCH}"

    # Build arguments
    local build_args=(
        --build-arg "NODE_ENV=production"
        --build-arg "BUILD_DATE=${BUILD_DATE}"
        --build-arg "GIT_COMMIT=${GIT_COMMIT}"
        --build-arg "GIT_BRANCH=${GIT_BRANCH}"
        --tag "${full_image_name}"
        --file "Dockerfile"
    )

    # Add cache options
    if [ "$ENABLE_CACHE" = "true" ]; then
        build_args+=(--cache-from "${full_image_name}")
    fi

    # Enable BuildKit features
    if [ "$DOCKER_BUILDKIT" = "1" ]; then
        build_args+=(
            --progress=plain
        )
    fi

    # Build
    log_info "Starting build..."
    local build_start=$(date +%s)

    if DOCKER_BUILDKIT=1 docker build "${build_args[@]}" .; then
        local build_end=$(date +%s)
        local build_duration=$((build_end - build_start))
        log_success "Build completed in ${build_duration}s"
    else
        log_error "Build failed"
        exit 1
    fi

    # Tag as latest
    if [ "$VERSION" != "latest" ]; then
        local latest_tag="${IMAGE_NAME}:latest"
        if [ -n "$REGISTRY" ]; then
            latest_tag="${REGISTRY}/${latest_tag}"
        fi
        docker tag "${full_image_name}" "${latest_tag}"
        log_success "Tagged as ${latest_tag}"
    fi
}

measure_image_size() {
    print_header "Image Size Analysis"

    local full_image_name="${IMAGE_NAME}:${VERSION}"
    if [ -n "$REGISTRY" ]; then
        full_image_name="${REGISTRY}/${full_image_name}"
    fi

    local image_size=$(docker images "${full_image_name}" --format "{{.Size}}")
    log_info "Final image size: ${image_size}"

    # Check if under target size (200MB)
    local size_bytes=$(docker inspect "${full_image_name}" --format='{{.Size}}')
    local size_mb=$((size_bytes / 1024 / 1024))

    if [ "$size_mb" -lt 200 ]; then
        log_success "Image size (${size_mb}MB) is under target (200MB) ✓"
    else
        log_warning "Image size (${size_mb}MB) exceeds target (200MB)"
    fi

    # Show layer breakdown
    log_info "Layer breakdown:"
    docker history "${full_image_name}" --human --no-trunc
}

generate_sbom() {
    if [ "$ENABLE_SBOM" != "true" ]; then
        return
    fi

    print_header "Generating SBOM (Software Bill of Materials)"

    local full_image_name="${IMAGE_NAME}:${VERSION}"
    if [ -n "$REGISTRY" ]; then
        full_image_name="${REGISTRY}/${full_image_name}"
    fi

    local sbom_dir="${PROJECT_ROOT}/sbom"
    mkdir -p "$sbom_dir"

    log_info "Generating SBOM with Syft..."
    syft "${full_image_name}" -o json > "${sbom_dir}/sbom-${VERSION}.json"
    syft "${full_image_name}" -o spdx > "${sbom_dir}/sbom-${VERSION}.spdx"
    syft "${full_image_name}" -o cyclonedx > "${sbom_dir}/sbom-${VERSION}.cyclonedx.json"

    log_success "SBOM generated in ${sbom_dir}/"
}

security_scan() {
    if [ "$ENABLE_SECURITY_SCAN" != "true" ]; then
        return
    fi

    print_header "Security Scanning with Trivy"

    local full_image_name="${IMAGE_NAME}:${VERSION}"
    if [ -n "$REGISTRY" ]; then
        full_image_name="${REGISTRY}/${full_image_name}"
    fi

    local scan_dir="${PROJECT_ROOT}/security-scans"
    mkdir -p "$scan_dir"

    log_info "Scanning for vulnerabilities..."

    # Scan for vulnerabilities
    if trivy image \
        --severity HIGH,CRITICAL \
        --format json \
        --output "${scan_dir}/trivy-${VERSION}.json" \
        "${full_image_name}"; then
        log_success "Vulnerability scan completed"
    else
        log_warning "Vulnerability scan found issues"
    fi

    # Generate human-readable report
    trivy image \
        --severity HIGH,CRITICAL \
        --format table \
        "${full_image_name}" | tee "${scan_dir}/trivy-${VERSION}.txt"

    # Check for critical vulnerabilities
    local critical_count=$(trivy image --severity CRITICAL --format json "${full_image_name}" 2>/dev/null | jq -r '.Results[].Vulnerabilities | length' | awk '{s+=$1} END {print s}')

    if [ "${critical_count:-0}" -gt 0 ]; then
        log_error "Found ${critical_count} CRITICAL vulnerabilities"
        log_warning "Review ${scan_dir}/trivy-${VERSION}.txt for details"
    else
        log_success "No CRITICAL vulnerabilities found ✓"
    fi
}

print_summary() {
    print_header "Build Summary"

    local full_image_name="${IMAGE_NAME}:${VERSION}"
    if [ -n "$REGISTRY" ]; then
        full_image_name="${REGISTRY}/${full_image_name}"
    fi

    echo "Image:        ${full_image_name}"
    echo "Size:         $(docker images "${full_image_name}" --format '{{.Size}}')"
    echo "Build Date:   ${BUILD_DATE}"
    echo "Git Commit:   ${GIT_COMMIT}"
    echo "Git Branch:   ${GIT_BRANCH}"
    echo ""

    log_success "Build completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Test the image: docker run --rm -p 3000:3000 ${full_image_name}"
    echo "  2. Push to registry: ./scripts/docker/push.sh"
    echo "  3. Deploy: ./scripts/docker/deploy.sh"
}

# ==============================================================================
# Main
# ==============================================================================
main() {
    print_header "ServiceDesk Docker Build"

    check_prerequisites
    build_image
    measure_image_size
    generate_sbom
    security_scan
    print_summary
}

# Run main function
main "$@"
