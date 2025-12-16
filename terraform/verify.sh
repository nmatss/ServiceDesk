#!/bin/bash

# Terraform Infrastructure Verification Script
# This script validates that all Terraform files are properly configured

set -e

echo "=========================================="
echo "Terraform Infrastructure Verification"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "1. Checking Terraform installation..."
if command -v terraform &> /dev/null; then
    VERSION=$(terraform version | head -n1)
    success "Terraform is installed: $VERSION"
else
    error "Terraform is not installed"
fi
echo ""

echo "2. Checking AWS CLI installation..."
if command -v aws &> /dev/null; then
    VERSION=$(aws --version)
    success "AWS CLI is installed: $VERSION"
else
    error "AWS CLI is not installed"
fi
echo ""

echo "3. Checking module structure..."
MODULES=("vpc" "eks" "rds" "elasticache" "s3" "cloudfront" "route53" "monitoring")
for module in "${MODULES[@]}"; do
    if [ -d "modules/$module" ]; then
        success "Module $module exists"

        # Check for required files
        if [ -f "modules/$module/main.tf" ]; then
            success "  ├── main.tf found"
        else
            error "  ├── main.tf missing"
        fi

        if [ -f "modules/$module/variables.tf" ]; then
            success "  ├── variables.tf found"
        else
            error "  ├── variables.tf missing"
        fi

        if [ -f "modules/$module/outputs.tf" ]; then
            success "  └── outputs.tf found"
        else
            error "  └── outputs.tf missing"
        fi
    else
        error "Module $module is missing"
    fi
done
echo ""

echo "4. Checking environment configurations..."
ENVIRONMENTS=("dev" "staging" "production")
for env in "${ENVIRONMENTS[@]}"; do
    if [ -d "environments/$env" ]; then
        success "Environment $env exists"

        # Check for required files
        if [ -f "environments/$env/main.tf" ]; then
            success "  ├── main.tf found"
        else
            error "  ├── main.tf missing"
        fi

        if [ -f "environments/$env/variables.tf" ]; then
            success "  ├── variables.tf found"
        else
            error "  ├── variables.tf missing"
        fi

        if [ -f "environments/$env/outputs.tf" ]; then
            success "  └── outputs.tf found"
        else
            error "  └── outputs.tf missing"
        fi
    else
        error "Environment $env is missing"
    fi
done
echo ""

echo "5. Checking root configuration files..."
if [ -f "backend.tf" ]; then
    success "backend.tf found"
else
    error "backend.tf missing"
fi

if [ -f "variables.tf" ]; then
    success "variables.tf found"
else
    error "variables.tf missing"
fi

if [ -f "outputs.tf" ]; then
    success "outputs.tf found"
else
    error "outputs.tf missing"
fi
echo ""

echo "6. Validating Terraform syntax in each environment..."
for env in "${ENVIRONMENTS[@]}"; do
    if [ -d "environments/$env" ]; then
        echo "  Validating $env environment..."
        cd "environments/$env"

        # Initialize without backend (just to validate syntax)
        if terraform init -backend=false &> /dev/null; then
            success "  ├── Terraform init successful"
        else
            error "  ├── Terraform init failed"
        fi

        # Validate
        if terraform validate &> /dev/null; then
            success "  ├── Terraform validate successful"
        else
            error "  ├── Terraform validate failed"
        fi

        # Format check
        if terraform fmt -check &> /dev/null; then
            success "  └── Terraform format check passed"
        else
            warning "  └── Terraform format check failed (run 'terraform fmt' to fix)"
        fi

        cd - &> /dev/null
    fi
done
echo ""

echo "7. Checking documentation..."
if [ -f "README.md" ]; then
    success "README.md found"
else
    error "README.md missing"
fi

if [ -f "QUICK_REFERENCE.md" ]; then
    success "QUICK_REFERENCE.md found"
else
    warning "QUICK_REFERENCE.md missing"
fi

if [ -f "../docs/INFRASTRUCTURE.md" ]; then
    success "INFRASTRUCTURE.md found"
else
    error "INFRASTRUCTURE.md missing"
fi

if [ -f "../docs/TERRAFORM_DEPLOYMENT_GUIDE.md" ]; then
    success "TERRAFORM_DEPLOYMENT_GUIDE.md found"
else
    error "TERRAFORM_DEPLOYMENT_GUIDE.md missing"
fi
echo ""

echo "8. Checking CI/CD configuration..."
if [ -f "../.github/workflows/terraform.yml" ]; then
    success "GitHub Actions workflow found"
else
    warning "GitHub Actions workflow missing"
fi
echo ""

echo "9. Optional: Checking security scanning tools..."
if command -v tfsec &> /dev/null; then
    success "tfsec is installed"
else
    warning "tfsec is not installed (recommended for security scanning)"
fi

if command -v checkov &> /dev/null; then
    success "checkov is installed"
else
    warning "checkov is not installed (recommended for compliance scanning)"
fi

if command -v infracost &> /dev/null; then
    success "infracost is installed"
else
    warning "infracost is not installed (recommended for cost estimation)"
fi
echo ""

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
else
    echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Infrastructure is ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review and fix the issues above.${NC}"
    exit 1
fi
