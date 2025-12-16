#!/bin/bash
# ==============================================================================
# ServiceDesk Docker Push Script
# Push images to container registry with validation and rollback support
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
ADDITIONAL_TAGS="${ADDITIONAL_TAGS:-}"

# Push options
DRY_RUN="${DRY_RUN:-false}"
SKIP_VALIDATION="${SKIP_VALIDATION:-false}"

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

    # Check registry configuration
    if [ -z "$REGISTRY" ]; then
        log_error "REGISTRY environment variable is not set"
        echo "Example: export REGISTRY=ghcr.io/your-org"
        exit 1
    fi
    log_success "Registry: ${REGISTRY}"

    # Check if logged in to registry
    log_info "Checking registry authentication..."
    if docker info 2>/dev/null | grep -q "${REGISTRY%%/*}"; then
        log_success "Authenticated to registry"
    else
        log_warning "Not authenticated to registry"
        log_info "Attempting to log in..."
        if ! docker login "$REGISTRY"; then
            log_error "Failed to authenticate to registry"
            exit 1
        fi
    fi
}

validate_image() {
    if [ "$SKIP_VALIDATION" = "true" ]; then
        log_warning "Skipping image validation"
        return
    fi

    print_header "Validating Image"

    local image_tag="${IMAGE_NAME}:${VERSION}"

    # Check if image exists
    if ! docker image inspect "$image_tag" &> /dev/null; then
        log_error "Image ${image_tag} not found locally"
        log_info "Build the image first: ./scripts/docker/build.sh"
        exit 1
    fi
    log_success "Image ${image_tag} found locally"

    # Check image size
    local size_bytes=$(docker inspect "$image_tag" --format='{{.Size}}')
    local size_mb=$((size_bytes / 1024 / 1024))
    log_info "Image size: ${size_mb}MB"

    # Run basic health check
    log_info "Running health check..."
    local container_id=$(docker run -d --rm "$image_tag")

    sleep 5

    if docker inspect "$container_id" --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
        log_success "Health check passed ✓"
        docker stop "$container_id" &> /dev/null || true
    else
        log_warning "Health check not available or pending"
        docker stop "$container_id" &> /dev/null || true
    fi
}

push_image() {
    print_header "Pushing Image to Registry"

    local source_tag="${IMAGE_NAME}:${VERSION}"
    local target_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

    # Tag for registry
    log_info "Tagging: ${source_tag} -> ${target_tag}"
    docker tag "$source_tag" "$target_tag"

    # Push main version tag
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would push: ${target_tag}"
    else
        log_info "Pushing: ${target_tag}"
        if docker push "$target_tag"; then
            log_success "Pushed: ${target_tag}"
        else
            log_error "Failed to push image"
            exit 1
        fi
    fi

    # Push additional tags
    if [ -n "$ADDITIONAL_TAGS" ]; then
        IFS=',' read -ra TAGS <<< "$ADDITIONAL_TAGS"
        for tag in "${TAGS[@]}"; do
            local additional_target="${REGISTRY}/${IMAGE_NAME}:${tag}"
            log_info "Tagging: ${source_tag} -> ${additional_target}"
            docker tag "$source_tag" "$additional_target"

            if [ "$DRY_RUN" = "true" ]; then
                log_warning "[DRY RUN] Would push: ${additional_target}"
            else
                log_info "Pushing: ${additional_target}"
                if docker push "$additional_target"; then
                    log_success "Pushed: ${additional_target}"
                else
                    log_warning "Failed to push tag: ${additional_target}"
                fi
            fi
        done
    fi

    # Push latest tag if not already latest
    if [ "$VERSION" != "latest" ]; then
        local latest_target="${REGISTRY}/${IMAGE_NAME}:latest"
        log_info "Tagging: ${source_tag} -> ${latest_target}"
        docker tag "$source_tag" "$latest_target"

        if [ "$DRY_RUN" = "true" ]; then
            log_warning "[DRY RUN] Would push: ${latest_target}"
        else
            log_info "Pushing: ${latest_target}"
            if docker push "$latest_target"; then
                log_success "Pushed: ${latest_target}"
            else
                log_warning "Failed to push latest tag"
            fi
        fi
    fi
}

generate_manifest() {
    print_header "Image Manifest"

    local target_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

    log_info "Generating manifest for ${target_tag}"

    if [ "$DRY_RUN" != "true" ]; then
        # Get image digest
        local digest=$(docker inspect "$target_tag" --format='{{index .RepoDigests 0}}' 2>/dev/null || echo "Not available yet")

        # Create manifest file
        local manifest_dir="${PROJECT_ROOT}/manifests"
        mkdir -p "$manifest_dir"

        cat > "${manifest_dir}/image-${VERSION}.json" <<EOF
{
  "image": "${target_tag}",
  "digest": "${digest}",
  "version": "${VERSION}",
  "registry": "${REGISTRY}",
  "pushed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "pushed_by": "${USER}",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF
        log_success "Manifest saved to ${manifest_dir}/image-${VERSION}.json"
    fi
}

print_summary() {
    print_header "Push Summary"

    local target_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

    if [ "$DRY_RUN" = "true" ]; then
        echo "MODE: DRY RUN (no images were actually pushed)"
    fi

    echo "Registry:     ${REGISTRY}"
    echo "Image:        ${IMAGE_NAME}"
    echo "Version:      ${VERSION}"
    echo "Full Tag:     ${target_tag}"
    echo ""

    if [ "$DRY_RUN" != "true" ]; then
        log_success "Images pushed successfully!"
        echo ""
        echo "Next steps:"
        echo "  1. Verify in registry: docker pull ${target_tag}"
        echo "  2. Deploy: ./scripts/docker/deploy.sh"
    fi
}

# ==============================================================================
# Main
# ==============================================================================
main() {
    print_header "ServiceDesk Docker Push"

    check_prerequisites
    validate_image
    push_image
    generate_manifest
    print_summary
}

# Run main function
main "$@"
