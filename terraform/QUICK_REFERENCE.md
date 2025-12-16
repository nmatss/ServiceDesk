# Terraform Quick Reference Card

## Essential Commands

### Initialization
```bash
terraform init                 # Initialize working directory
terraform init -upgrade        # Upgrade providers to latest versions
terraform init -reconfigure    # Reconfigure backend
```

### Planning & Validation
```bash
terraform validate             # Validate configuration syntax
terraform fmt                  # Format code to canonical style
terraform fmt -check           # Check if formatting is needed
terraform plan                 # Show execution plan
terraform plan -out=tfplan     # Save plan to file
terraform show tfplan          # Display saved plan
```

### Applying Changes
```bash
terraform apply                # Apply changes (with confirmation)
terraform apply tfplan         # Apply saved plan (no confirmation)
terraform apply -auto-approve  # Apply without confirmation (USE CAREFULLY!)
terraform apply -target=module.vpc  # Apply specific module only
```

### Destroying Resources
```bash
terraform destroy              # Destroy all resources (with confirmation)
terraform destroy -auto-approve  # Destroy without confirmation (DANGEROUS!)
terraform destroy -target=resource  # Destroy specific resource
```

### State Management
```bash
terraform state list           # List all resources in state
terraform state show <resource>  # Show details of specific resource
terraform state mv <src> <dst>  # Move resource in state
terraform state rm <resource>  # Remove resource from state
terraform state pull           # Download remote state
terraform state push           # Upload local state
terraform refresh              # Sync state with real infrastructure
```

### Outputs
```bash
terraform output               # Show all outputs
terraform output <name>        # Show specific output
terraform output -json         # Output in JSON format
terraform output -raw <name>   # Output raw value (no quotes)
```

### Import
```bash
terraform import <resource> <id>  # Import existing infrastructure
# Example:
terraform import module.vpc.aws_vpc.main vpc-12345678
```

### Workspace Management
```bash
terraform workspace list       # List workspaces
terraform workspace new <name>  # Create new workspace
terraform workspace select <name>  # Switch workspace
terraform workspace show       # Show current workspace
```

## Security Scanning

```bash
# tfsec - Security scanner
tfsec .                        # Scan current directory
tfsec . --minimum-severity MEDIUM  # Only show MEDIUM+ issues
tfsec . --format json          # Output as JSON

# Checkov - Policy scanner
checkov -d .                   # Scan directory
checkov -d . --framework terraform  # Scan Terraform only
checkov -d . --soft-fail       # Don't fail on issues

# Infracost - Cost estimation
infracost breakdown --path .   # Show cost breakdown
infracost diff --path .        # Show cost diff from baseline
```

## Environment-Specific Commands

### Development
```bash
cd terraform/environments/dev
terraform init
terraform plan -out=tfplan
terraform apply tfplan
aws eks update-kubeconfig --region us-east-1 --name servicedesk-dev
```

### Staging
```bash
cd terraform/environments/staging
terraform init
terraform plan -out=tfplan
terraform apply tfplan
aws eks update-kubeconfig --region us-east-1 --name servicedesk-staging
```

### Production
```bash
cd terraform/environments/production
terraform init

# ALWAYS scan before production deploy!
tfsec .
checkov -d .

terraform plan -out=tfplan
# Review plan with team before applying!
terraform apply tfplan
aws eks update-kubeconfig --region us-east-1 --name servicedesk-production
```

## Debugging

```bash
# Enable debug logging
export TF_LOG=DEBUG
export TF_LOG_PATH=./terraform.log

# Detailed crash logs
export TF_LOG=TRACE

# Reset logging
unset TF_LOG
unset TF_LOG_PATH

# Validate providers
terraform providers

# Dependency graph
terraform graph | dot -Tpng > graph.png
```

## AWS CLI Commands

### Check Resources
```bash
# EKS
aws eks describe-cluster --name servicedesk-production
aws eks list-clusters

# RDS
aws rds describe-db-instances --db-instance-identifier servicedesk-production-db

# ElastiCache
aws elasticache describe-replication-groups --replication-group-id servicedesk-production-redis

# S3
aws s3 ls s3://servicedesk-production-uploads/

# VPC
aws ec2 describe-vpcs --filters "Name=tag:Environment,Values=production"
```

### Get Secrets
```bash
# RDS password
aws secretsmanager get-secret-value \
  --secret-id servicedesk-production-rds-master-password \
  --query SecretString --output text | jq -r .password

# Redis auth token
aws secretsmanager get-secret-value \
  --secret-id servicedesk-production-redis-auth-token \
  --query SecretString --output text | jq -r .auth_token
```

### CloudWatch Logs
```bash
# Tail logs
aws logs tail /aws/servicedesk-production/application --follow

# List log groups
aws logs describe-log-groups --log-group-name-prefix /aws/servicedesk
```

## kubectl Commands

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name <cluster-name>

# Get nodes
kubectl get nodes
kubectl get nodes -o wide

# Get all resources
kubectl get all -A

# Get pods in namespace
kubectl get pods -n default

# Describe resource
kubectl describe node <node-name>
kubectl describe pod <pod-name>

# Logs
kubectl logs <pod-name>
kubectl logs -f <pod-name>  # Follow logs

# Execute command in pod
kubectl exec -it <pod-name> -- /bin/bash

# Get cluster info
kubectl cluster-info
```

## Database Commands

### PostgreSQL (RDS)
```bash
# Get endpoint
PGHOST=$(terraform output -raw rds_endpoint | cut -d: -f1)
PGPASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id servicedesk-production-rds-master-password \
  --query SecretString --output text | jq -r .password)

# Connect
psql -h $PGHOST -U dbadmin -d servicedesk

# Backup
pg_dump -h $PGHOST -U dbadmin -d servicedesk > backup.sql

# Restore
psql -h $PGHOST -U dbadmin -d servicedesk < backup.sql
```

### Redis (ElastiCache)
```bash
# Get endpoint
REDIS_HOST=$(terraform output -raw redis_endpoint | cut -d: -f1)
REDIS_AUTH=$(aws secretsmanager get-secret-value \
  --secret-id servicedesk-production-redis-auth-token \
  --query SecretString --output text | jq -r .auth_token)

# Connect
redis-cli -h $REDIS_HOST -p 6379 -a $REDIS_AUTH

# Test
redis-cli -h $REDIS_HOST -p 6379 -a $REDIS_AUTH PING
# Expected: PONG

# Monitor
redis-cli -h $REDIS_HOST -p 6379 -a $REDIS_AUTH --latency
```

## Troubleshooting

### State Lock
```bash
# If terraform apply hangs with "Acquiring state lock"
terraform force-unlock <LOCK_ID>

# Get lock ID from error message
# WARNING: Only use if you're sure no other apply is running!
```

### Provider Cache
```bash
# Clear provider cache
rm -rf .terraform/
terraform init
```

### Backend Issues
```bash
# Migrate state to new backend
terraform init -migrate-state

# Reconfigure backend
terraform init -reconfigure

# Force copy state
terraform init -force-copy
```

### Corrupt State
```bash
# Pull current state
terraform state pull > terraform.tfstate.backup

# Fix state file manually
# Then push it back
terraform state push terraform.tfstate.backup
```

## Emergency Procedures

### Rollback Changes
```bash
# Revert to previous state version (S3 versioning)
aws s3api list-object-versions \
  --bucket servicedesk-terraform-state \
  --prefix production/terraform.tfstate

# Download specific version
aws s3api get-object \
  --bucket servicedesk-terraform-state \
  --key production/terraform.tfstate \
  --version-id <VERSION_ID> \
  terraform.tfstate

# Push to current state
terraform state push terraform.tfstate
```

### Disaster Recovery
```bash
# 1. Create new environment from Terraform
cd terraform/environments/production
terraform apply

# 2. Restore RDS from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier servicedesk-production-db-restored \
  --db-snapshot-identifier <snapshot-id>

# 3. Restore Redis from snapshot
aws elasticache create-replication-group \
  --replication-group-id servicedesk-production-redis-restored \
  --snapshot-name <snapshot-name>

# 4. Update DNS
# Update Route53 records to point to new infrastructure
```

## Cost Management

```bash
# View current month costs
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# Create budget
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

## Common File Locations

```
terraform/
├── backend.tf                      # Backend config
├── variables.tf                    # Global variables
├── outputs.tf                      # Global outputs
├── modules/                        # Reusable modules
│   ├── vpc/                        # Network
│   ├── eks/                        # Kubernetes
│   ├── rds/                        # Database
│   ├── elasticache/                # Cache
│   ├── s3/                         # Storage
│   ├── cloudfront/                 # CDN
│   ├── route53/                    # DNS
│   └── monitoring/                 # Observability
└── environments/
    ├── dev/main.tf                 # Dev config
    ├── staging/main.tf             # Staging config
    └── production/main.tf          # Production config
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# Terraform aliases
alias tf='terraform'
alias tfi='terraform init'
alias tfp='terraform plan'
alias tfa='terraform apply'
alias tfd='terraform destroy'
alias tfo='terraform output'
alias tfv='terraform validate'
alias tff='terraform fmt'
alias tfs='terraform state'

# Combined workflows
alias tfpa='terraform plan -out=tfplan && terraform apply tfplan'
alias tfcheck='terraform fmt -check && terraform validate && tfsec .'

# Environment switching
alias tfdev='cd terraform/environments/dev'
alias tfstaging='cd terraform/environments/staging'
alias tfprod='cd terraform/environments/production'
```

## Tags for Resource Management

All resources are tagged with:
```
Project     = servicedesk
Environment = dev|staging|production
ManagedBy   = Terraform
Owner       = <team>
```

Search by tags:
```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Environment,Values=production Key=Project,Values=servicedesk
```

## Version Information

- **Terraform:** >= 1.5.0
- **AWS Provider:** ~> 5.0
- **Kubernetes Version:** 1.28
- **PostgreSQL:** 15.4
- **Redis:** 7.0

---

**Pro Tips:**
1. Always run `terraform plan` before `apply`
2. Use `-out=tfplan` to review plans before applying
3. Enable debug logs when troubleshooting
4. Never run `terraform destroy` on production without approval
5. Always scan with tfsec/checkov before production deploys
6. Keep Terraform and providers updated
7. Use workspaces or separate state files per environment
8. Tag all resources for easy management
9. Enable state locking with DynamoDB
10. Backup state files regularly

**Need Help?**
- Terraform Docs: `/terraform/README.md`
- Architecture: `/docs/INFRASTRUCTURE.md`
- Deployment Guide: `/docs/TERRAFORM_DEPLOYMENT_GUIDE.md`
- Summary: `/TERRAFORM_SUMMARY.md`
