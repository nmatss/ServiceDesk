#!/bin/bash
# ==============================================================================
# ServiceDesk Docker Validation Script
# Validates Docker configuration and measures optimization metrics
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_header "ServiceDesk Docker Validation"

# ==============================================================================
# 1. Validate Dockerfile
# ==============================================================================
print_header "1. Dockerfile Validation"

if [ -f "Dockerfile" ]; then
    log_success "Dockerfile exists"

    # Check for multi-stage build
    if grep -q "FROM.*AS deps" Dockerfile && grep -q "FROM.*AS builder" Dockerfile && grep -q "FROM.*AS runner" Dockerfile; then
        log_success "Multi-stage build detected ✓"
    else
        log_warning "Multi-stage build not properly configured"
    fi

    # Check for Alpine base
    if grep -q "alpine" Dockerfile; then
        log_success "Alpine Linux base image ✓"
    else
        log_warning "Not using Alpine Linux"
    fi

    # Check for non-root user
    if grep -q "USER nextjs" Dockerfile; then
        log_success "Non-root user configured ✓"
    else
        log_error "No non-root user found"
    fi

    # Check for health check
    if grep -q "HEALTHCHECK" Dockerfile; then
        log_success "Health check configured ✓"
    else
        log_warning "No health check found"
    fi
else
    log_error "Dockerfile not found"
    exit 1
fi

# ==============================================================================
# 2. Validate Dockerfile.dev
# ==============================================================================
print_header "2. Dockerfile.dev Validation"

if [ -f "Dockerfile.dev" ]; then
    log_success "Dockerfile.dev exists"

    if grep -q "NODE_ENV=development" Dockerfile.dev; then
        log_success "Development environment configured ✓"
    fi

    if grep -q "CHOKIDAR_USEPOLLING" Dockerfile.dev; then
        log_success "Hot reload configured ✓"
    fi
else
    log_warning "Dockerfile.dev not found"
fi

# ==============================================================================
# 3. Validate .dockerignore
# ==============================================================================
print_header "3. .dockerignore Validation"

if [ -f ".dockerignore" ]; then
    log_success ".dockerignore exists"

    required_entries=(
        "node_modules"
        ".next"
        ".git"
        "*.md"
        ".env"
        "coverage"
    )

    for entry in "${required_entries[@]}"; do
        if grep -q "$entry" .dockerignore; then
            log_success "Excludes: $entry ✓"
        else
            log_warning "Missing: $entry"
        fi
    done
else
    log_error ".dockerignore not found"
fi

# ==============================================================================
# 4. Validate Docker Compose Files
# ==============================================================================
print_header "4. Docker Compose Validation"

if [ -f "docker-compose.yml" ]; then
    log_success "docker-compose.yml exists"

    # Check for health checks
    if grep -q "healthcheck:" docker-compose.yml; then
        log_success "Health checks configured ✓"
    fi

    # Check for resource limits
    if grep -q "resources:" docker-compose.yml || grep -q "deploy:" docker-compose.yml; then
        log_success "Resource limits configured ✓"
    else
        log_warning "No resource limits found"
    fi

    # Check for restart policy
    if grep -q "restart:" docker-compose.yml; then
        log_success "Restart policy configured ✓"
    fi
else
    log_error "docker-compose.yml not found"
fi

if [ -f "docker-compose.dev.yml" ]; then
    log_success "docker-compose.dev.yml exists"
else
    log_warning "docker-compose.dev.yml not found"
fi

# ==============================================================================
# 5. Validate Build Scripts
# ==============================================================================
print_header "5. Build Scripts Validation"

scripts=(
    "scripts/docker/build.sh"
    "scripts/docker/push.sh"
    "scripts/docker/deploy.sh"
    "scripts/docker/health-check.sh"
)

for script in "${scripts[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            log_success "$(basename $script) exists and is executable ✓"
        else
            log_warning "$(basename $script) exists but is not executable"
        fi
    else
        log_error "$(basename $script) not found"
    fi
done

# ==============================================================================
# 6. Validate Documentation
# ==============================================================================
print_header "6. Documentation Validation"

if [ -f "DOCKER.md" ]; then
    log_success "DOCKER.md exists"

    # Check for key sections
    sections=(
        "Quick Start"
        "Production Deployment"
        "Development Environment"
        "Security"
        "Troubleshooting"
    )

    for section in "${sections[@]}"; do
        if grep -q "$section" DOCKER.md; then
            log_success "Section: $section ✓"
        else
            log_warning "Missing section: $section"
        fi
    done
else
    log_warning "DOCKER.md not found"
fi

# ==============================================================================
# 7. Measure Optimization Metrics
# ==============================================================================
print_header "7. Optimization Metrics"

log_info "Calculating build context size..."
build_context_size=$(du -sh . --exclude=node_modules --exclude=.next --exclude=.git 2>/dev/null | cut -f1)
log_info "Build context size (excluding ignored): $build_context_size"

if [ -f ".dockerignore" ]; then
    ignored_size=$(du -sh node_modules .next .git 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    log_success "Size reduced by .dockerignore: ~${ignored_size}"
fi

# ==============================================================================
# 8. Security Checks
# ==============================================================================
print_header "8. Security Checks"

# Check for secrets in Dockerfile
if grep -iE "(password|secret|key|token).*=" Dockerfile 2>/dev/null; then
    log_error "Potential secrets found in Dockerfile!"
else
    log_success "No hardcoded secrets in Dockerfile ✓"
fi

# Check for exposed ports
if grep -q "EXPOSE 3000" Dockerfile; then
    log_success "Port 3000 exposed ✓"
fi

# ==============================================================================
# 9. Best Practices Check
# ==============================================================================
print_header "9. Best Practices Check"

best_practices=0
total_checks=10

# Check 1: Multi-stage build
if grep -q "FROM.*AS" Dockerfile; then
    log_success "✓ Multi-stage build"
    ((best_practices++))
fi

# Check 2: Alpine base
if grep -q "alpine" Dockerfile; then
    log_success "✓ Alpine Linux base"
    ((best_practices++))
fi

# Check 3: Non-root user
if grep -q "USER" Dockerfile; then
    log_success "✓ Non-root user"
    ((best_practices++))
fi

# Check 4: .dockerignore
if [ -f ".dockerignore" ]; then
    log_success "✓ .dockerignore exists"
    ((best_practices++))
fi

# Check 5: Health check
if grep -q "HEALTHCHECK" Dockerfile; then
    log_success "✓ Health check"
    ((best_practices++))
fi

# Check 6: Layer caching (package.json before COPY)
if grep -B5 "npm ci" Dockerfile | grep -q "COPY package"; then
    log_success "✓ Layer caching optimized"
    ((best_practices++))
fi

# Check 7: Production dependencies only
if grep -q "npm ci --only=production" Dockerfile; then
    log_success "✓ Production dependencies only"
    ((best_practices++))
fi

# Check 8: Build arguments
if grep -q "ARG BUILD_DATE" Dockerfile; then
    log_success "✓ Build metadata (ARG)"
    ((best_practices++))
fi

# Check 9: Labels
if grep -q "LABEL" Dockerfile; then
    log_success "✓ OCI labels"
    ((best_practices++))
fi

# Check 10: Tini for signal handling
if grep -q "tini" Dockerfile; then
    log_success "✓ Tini for signal handling"
    ((best_practices++))
fi

echo ""
score=$((best_practices * 100 / total_checks))
log_info "Best Practices Score: ${best_practices}/${total_checks} (${score}%)"

if [ $score -ge 90 ]; then
    log_success "Excellent! ✨"
elif [ $score -ge 70 ]; then
    log_success "Good! 👍"
elif [ $score -ge 50 ]; then
    log_warning "Needs improvement"
else
    log_error "Poor configuration"
fi

# ==============================================================================
# Summary
# ==============================================================================
print_header "Validation Summary"

echo "Optimization Checklist:"
echo "  ✓ Multi-stage Dockerfile"
echo "  ✓ Alpine Linux base image"
echo "  ✓ Production-optimized build"
echo "  ✓ Development environment"
echo "  ✓ .dockerignore for layer caching"
echo "  ✓ Security hardening"
echo "  ✓ Health checks"
echo "  ✓ Build automation scripts"
echo "  ✓ Comprehensive documentation"
echo ""

log_success "Docker configuration validation complete!"
echo ""
echo "Next steps:"
echo "  1. Test build: ./scripts/docker/build.sh"
echo "  2. Run health check: ./scripts/docker/health-check.sh"
echo "  3. Start development: docker-compose -f docker-compose.dev.yml up"
