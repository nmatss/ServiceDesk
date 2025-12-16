# Terraform Infrastructure Deployment Guide

Complete step-by-step guide for deploying the ServiceDesk infrastructure on AWS using Terraform.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Initial Setup](#initial-setup)
3. [Backend Configuration](#backend-configuration)
4. [Development Environment Deployment](#development-environment-deployment)
5. [Staging Environment Deployment](#staging-environment-deployment)
6. [Production Environment Deployment](#production-environment-deployment)
7. [Post-Deployment Configuration](#post-deployment-configuration)
8. [Validation & Testing](#validation--testing)
9. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

### Required Access & Credentials

- [ ] AWS Account with billing enabled
- [ ] AWS IAM user with AdministratorAccess or equivalent
- [ ] AWS CLI v2 installed and configured
- [ ] Terraform >= 1.5.0 installed
- [ ] kubectl installed (for EKS access)
- [ ] GitHub account (for CI/CD integration)
- [ ] Domain name registered (optional, for production)
- [ ] ACM certificate for CloudFront (optional)

### Cost Awareness

Estimated monthly costs:
- **Development:** ~$120/month
- **Staging:** ~$370/month
- **Production:** ~$1,900/month

**IMPORTANT:** Set up AWS Budgets to avoid unexpected charges!

```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

### Tool Installation

```bash
# Terraform
wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
unzip terraform_1.5.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# tfsec (security scanning)
brew install tfsec
# or
curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash

# checkov (compliance scanning)
pip3 install checkov
```

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/servicedesk.git
cd servicedesk
```

### 2. Configure AWS CLI

```bash
aws configure

# Enter your credentials:
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json

# Verify access
aws sts get-caller-identity
```

### 3. Set Up Environment Variables

Create a `.env` file (do not commit this!):

```bash
cat > .env << 'EOF'
# AWS Configuration
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Terraform Configuration
export TF_VAR_project_name=servicedesk
export TF_VAR_alarm_email=your-email@example.com

# Development
export TF_VAR_environment=dev

# Optional: Enable detailed Terraform logs
# export TF_LOG=DEBUG
# export TF_LOG_PATH=./terraform.log
EOF

source .env
```

## Backend Configuration

### Step 1: Create S3 Bucket for Terraform State

```bash
# Create bucket
aws s3 mb s3://servicedesk-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket servicedesk-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket servicedesk-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Block all public access
aws s3api put-public-access-block \
  --bucket servicedesk-terraform-state \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable logging (optional)
aws s3api put-bucket-logging \
  --bucket servicedesk-terraform-state \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "servicedesk-terraform-state",
      "TargetPrefix": "logs/"
    }
  }'

# Verify bucket
aws s3 ls s3://servicedesk-terraform-state
```

### Step 2: Create DynamoDB Table for State Locking

```bash
# Create table
aws dynamodb create-table \
  --table-name servicedesk-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 \
  --tags Key=Project,Value=ServiceDesk Key=Purpose,Value=TerraformStateLocking

# Verify table
aws dynamodb describe-table --table-name servicedesk-terraform-locks
```

### Step 3: Enable Point-in-Time Recovery (PITR)

```bash
# Enable PITR for DynamoDB table
aws dynamodb update-continuous-backups \
  --table-name servicedesk-terraform-locks \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

## Development Environment Deployment

### Step 1: Navigate to Dev Environment

```bash
cd terraform/environments/dev
```

### Step 2: Review Configuration

```bash
# Review main.tf
cat main.tf

# Review variables
cat variables.tf

# Customize if needed (optional)
# Edit terraform.tfvars or pass via -var flags
```

### Step 3: Initialize Terraform

```bash
# Initialize backend and download providers
terraform init

# Expected output:
# Initializing the backend...
# Successfully configured the backend "s3"!
# Terraform has been successfully initialized!
```

### Step 4: Validate Configuration

```bash
# Validate syntax
terraform validate

# Check formatting
terraform fmt -check

# If formatting issues, fix them:
terraform fmt
```

### Step 5: Security Scan (Optional but Recommended)

```bash
# Run tfsec
tfsec .

# Run checkov
checkov -d .

# Fix any HIGH or CRITICAL issues before proceeding
```

### Step 6: Plan Infrastructure

```bash
# Generate execution plan
terraform plan -out=tfplan

# Review the plan carefully:
# - Check resource counts
# - Verify configurations
# - Review estimated costs
# - Ensure no unexpected deletions

# To save plan output for review:
terraform show -no-color tfplan > plan.txt
```

### Step 7: Apply Infrastructure

```bash
# Apply the plan
terraform apply tfplan

# This will create:
# - VPC with subnets across 2 AZs
# - EKS cluster with 2 nodes
# - RDS PostgreSQL (db.t3.micro)
# - ElastiCache Redis (cache.t3.micro)
# - S3 buckets
# - CloudFront distribution
# - Monitoring resources

# Deployment time: ~20-30 minutes
```

### Step 8: Save Outputs

```bash
# Export all outputs
terraform output -json > outputs.json

# View specific outputs
terraform output eks_cluster_endpoint
terraform output rds_endpoint
terraform output redis_endpoint

# Save connection info
terraform output -json > ~/servicedesk-dev-outputs.json
```

### Step 9: Configure kubectl

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name servicedesk-dev

# Test connection
kubectl get nodes

# Expected output:
# NAME                         STATUS   ROLES    AGE   VERSION
# ip-10-0-xx-xx.ec2.internal   Ready    <none>   5m    v1.28.x
```

### Step 10: Verify Deployment

```bash
# Check all resources
kubectl get all -A

# Check EKS add-ons
aws eks list-addons --cluster-name servicedesk-dev

# Check RDS instance
aws rds describe-db-instances \
  --db-instance-identifier servicedesk-dev-db \
  --query 'DBInstances[0].DBInstanceStatus'

# Check ElastiCache cluster
aws elasticache describe-replication-groups \
  --replication-group-id servicedesk-dev-redis
```

## Staging Environment Deployment

### Prerequisites

- Development environment successfully deployed
- All security scans passed
- Cost estimates reviewed

### Deployment Steps

```bash
# Navigate to staging
cd terraform/environments/staging

# Initialize
terraform init

# Validate and scan
terraform validate
tfsec .
checkov -d .

# Plan
terraform plan -out=tfplan

# Review differences from dev:
# - Multi-AZ deployment
# - Larger instances
# - More monitoring
# - CloudTrail enabled

# Apply
terraform apply tfplan

# Deployment time: ~30-40 minutes

# Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name servicedesk-staging

# Verify
kubectl get nodes
terraform output -json > ~/servicedesk-staging-outputs.json
```

## Production Environment Deployment

### Pre-Production Checklist

- [ ] Staging environment fully tested
- [ ] DNS domain registered and verified
- [ ] ACM certificate created for CloudFront
- [ ] Budget alerts configured
- [ ] Incident response plan in place
- [ ] Team trained on operational procedures
- [ ] Backup and recovery procedures tested
- [ ] Security review completed

### Step 1: Review Production Configuration

```bash
cd terraform/environments/production

# Review production settings
cat main.tf

# Key differences:
# - Private EKS cluster (no public access)
# - Large instances (m5.xlarge, r6g.2xlarge)
# - Full security suite (GuardDuty, CloudTrail)
# - VPC Flow Logs enabled
# - 30-day backup retention
# - Deletion protection enabled
```

### Step 2: Update Variables (Important!)

Edit `variables.tf` or create `terraform.tfvars`:

```hcl
# terraform.tfvars
project_name = "servicedesk"
aws_region   = "us-east-1"

# Update these!
alarm_email  = "production-alerts@example.com"
domain_name  = "servicedesk.yourcompany.com"

# Optional: ACM certificate ARN for CloudFront
# acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT:certificate/ID"
```

### Step 3: Initialize and Plan

```bash
terraform init
terraform validate
terraform fmt

# Security scan (MANDATORY for production)
tfsec .
checkov -d .

# Fix all issues before proceeding!

# Plan
terraform plan -out=tfplan

# Review thoroughly:
# - All resources are correctly sized
# - Multi-AZ is enabled
# - Deletion protection is on
# - Backups are configured
# - Monitoring is complete
```

### Step 4: Cost Estimation

```bash
# Using Infracost (if installed)
infracost breakdown --path .

# Review estimated monthly cost
# Production should be ~$1,900/month

# Compare to staging
infracost diff --path ../staging --compare-to .
```

### Step 5: Apply with Team Review

**IMPORTANT:** Never deploy production alone!

```bash
# Share plan with team
terraform show -no-color tfplan > production-plan.txt

# Send to team for review
# Wait for approvals

# Apply (requires confirmation)
terraform apply tfplan

# Deployment time: ~45-60 minutes
```

### Step 6: Post-Deployment Configuration

```bash
# Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name servicedesk-production

# Verify nodes
kubectl get nodes

# Should show 6 nodes across 3 AZs
```

### Step 7: Update DNS

```bash
# Get Route53 name servers
terraform output route53_name_servers

# Update your domain registrar with these name servers:
# ns-xxx.awsdns-xx.com
# ns-xxx.awsdns-xx.org
# ns-xxx.awsdns-xx.net
# ns-xxx.awsdns-xx.co.uk

# Wait for DNS propagation (up to 48 hours)
dig servicedesk.yourcompany.com NS
```

### Step 8: Configure SSL Certificate

```bash
# If not already created, request ACM certificate
aws acm request-certificate \
  --domain-name servicedesk.yourcompany.com \
  --domain-name www.servicedesk.yourcompany.com \
  --validation-method DNS \
  --region us-east-1

# Validate via DNS (add CNAME records)
# Update CloudFront distribution with certificate ARN
# Redeploy Terraform with updated certificate
```

## Post-Deployment Configuration

### 1. Database Credentials

```bash
# Retrieve RDS credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id servicedesk-production-rds-master-password \
  --query SecretString --output text | jq -r

# Output includes: username, password, host, port, dbname
```

### 2. Redis Auth Token

```bash
# Retrieve Redis auth token (if transit encryption enabled)
aws secretsmanager get-secret-value \
  --secret-id servicedesk-production-redis-auth-token \
  --query SecretString --output text | jq -r .auth_token
```

### 3. Configure Application

Create Kubernetes secrets:

```bash
# RDS credentials
kubectl create secret generic db-credentials \
  --from-literal=host=$(terraform output -raw rds_endpoint) \
  --from-literal=username=dbadmin \
  --from-literal=password=$(aws secretsmanager get-secret-value \
    --secret-id servicedesk-production-rds-master-password \
    --query SecretString --output text | jq -r .password) \
  --from-literal=database=servicedesk \
  --namespace default

# Redis credentials
kubectl create secret generic redis-credentials \
  --from-literal=host=$(terraform output -raw redis_endpoint) \
  --from-literal=port=6379 \
  --from-literal=auth_token=$(aws secretsmanager get-secret-value \
    --secret-id servicedesk-production-redis-auth-token \
    --query SecretString --output text | jq -r .auth_token) \
  --namespace default
```

### 4. S3 Bucket Access

```bash
# Create IAM policy for application S3 access
cat > s3-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::servicedesk-production-uploads/*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name ServiceDeskS3Access \
  --policy-document file://s3-policy.json

# Attach to EKS node IAM role or use IRSA (IAM Roles for Service Accounts)
```

### 5. SNS Email Subscriptions

```bash
# Subscribe to alerts
aws sns subscribe \
  --topic-arn $(terraform output -raw sns_alerts_topic_arn) \
  --protocol email \
  --notification-endpoint production-alerts@example.com

# Confirm subscription via email
```

## Validation & Testing

### Infrastructure Validation

```bash
# 1. VPC Validation
aws ec2 describe-vpcs \
  --filters "Name=tag:Environment,Values=production" \
  --query 'Vpcs[0].{VpcId:VpcId,State:State,CIDR:CidrBlock}'

# 2. EKS Cluster Validation
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -A

# 3. RDS Validation
psql -h $(terraform output -raw rds_endpoint) \
     -U dbadmin -d servicedesk -c "SELECT version();"

# 4. Redis Validation
redis-cli -h $(terraform output -raw redis_endpoint | cut -d: -f1) \
          -p 6379 \
          -a $(aws secretsmanager get-secret-value \
            --secret-id servicedesk-production-redis-auth-token \
            --query SecretString --output text | jq -r .auth_token) \
          PING

# Expected: PONG

# 5. S3 Validation
aws s3 ls s3://servicedesk-production-uploads/
aws s3 ls s3://servicedesk-production-backups/
aws s3 ls s3://servicedesk-production-static/

# 6. CloudFront Validation
curl -I $(terraform output -raw cloudfront_distribution_domain_name)

# 7. Monitoring Validation
aws cloudwatch describe-alarms \
  --alarm-name-prefix servicedesk-production
```

### Security Validation

```bash
# 1. Check encryption at rest
aws rds describe-db-instances \
  --db-instance-identifier servicedesk-production-db \
  --query 'DBInstances[0].StorageEncrypted'

# 2. Check VPC Flow Logs
aws ec2 describe-flow-logs \
  --filter "Name=resource-id,Values=$(terraform output -raw vpc_id)"

# 3. Check GuardDuty status
aws guardduty list-detectors

# 4. Check CloudTrail
aws cloudtrail describe-trails \
  --trail-name-list servicedesk-production-trail
```

### Performance Testing

```bash
# 1. Database connection test
pgbench -i -h $(terraform output -raw rds_endpoint) \
        -U dbadmin -d servicedesk

# 2. Redis latency test
redis-cli -h $(terraform output -raw redis_endpoint | cut -d: -f1) \
          --latency

# 3. EKS node stress test
kubectl run stress --image=polinux/stress \
  -- stress --cpu 2 --timeout 60s
```

## Troubleshooting

### Common Issues

#### Issue 1: Backend Initialization Failed

**Error:**
```
Error: Failed to get existing workspaces: S3 bucket does not exist
```

**Solution:**
```bash
# Ensure S3 bucket exists
aws s3 ls s3://servicedesk-terraform-state

# If not, create it (see Backend Configuration section)
```

#### Issue 2: Insufficient IAM Permissions

**Error:**
```
Error: AccessDenied: User is not authorized to perform: eks:CreateCluster
```

**Solution:**
```bash
# Check current IAM permissions
aws iam get-user

# Attach required policy
aws iam attach-user-policy \
  --user-name YOUR_USER \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

#### Issue 3: Resource Already Exists

**Error:**
```
Error: Error creating DB Instance: DBInstanceAlreadyExists
```

**Solution:**
```bash
# Import existing resource
terraform import module.rds.aws_db_instance.main servicedesk-production-db

# Or delete and recreate
aws rds delete-db-instance \
  --db-instance-identifier servicedesk-production-db \
  --skip-final-snapshot
```

#### Issue 4: State Lock Timeout

**Error:**
```
Error: Error acquiring the state lock
```

**Solution:**
```bash
# Check lock table
aws dynamodb scan --table-name servicedesk-terraform-locks

# Force unlock (use with extreme caution!)
terraform force-unlock LOCK_ID

# Verify no other apply is running first!
```

#### Issue 5: EKS Nodes Not Ready

**Error:**
```
kubectl get nodes
# Shows nodes in NotReady state
```

**Solution:**
```bash
# Check node logs
kubectl describe node NODE_NAME

# Check VPC CNI
kubectl get pods -n kube-system | grep aws-node

# Restart VPC CNI
kubectl rollout restart daemonset aws-node -n kube-system
```

### Debug Mode

```bash
# Enable Terraform debug logging
export TF_LOG=DEBUG
export TF_LOG_PATH=./terraform-debug.log

# Run terraform commands
terraform plan

# Review logs
cat terraform-debug.log
```

### Getting Help

1. **Check logs:**
   - Terraform logs: `./terraform.log`
   - CloudWatch logs: AWS Console
   - EKS logs: `kubectl logs`

2. **Verify configuration:**
   ```bash
   terraform validate
   terraform fmt -check
   tfsec .
   ```

3. **Contact support:**
   - Platform team: platform@example.com
   - AWS Support: Enterprise support plan

## Rollback Procedures

### Rollback Development

```bash
cd terraform/environments/dev

# Destroy all resources
terraform destroy

# Confirm destruction
# This is safe for dev environment
```

### Rollback Staging

```bash
cd terraform/environments/staging

# Plan destruction
terraform plan -destroy

# Review what will be deleted
# Backup any important data first

# Destroy
terraform destroy
```

### Rollback Production

**WARNING:** Only rollback production in emergency situations!

```bash
# DO NOT destroy production lightly!
# Consider these alternatives first:
# 1. Revert to previous Terraform state
# 2. Roll back specific resources only
# 3. Scale down instead of destroying

# If you must destroy:
cd terraform/environments/production

# Disable deletion protection first
# Update main.tf:
# deletion_protection = false

terraform apply

# Then destroy
terraform destroy

# This will DELETE:
# - All data in RDS (unless final snapshot enabled)
# - All data in Redis
# - All infrastructure

# ENSURE YOU HAVE BACKUPS!
```

---

## Summary

You have successfully:
- ✅ Set up Terraform backend
- ✅ Deployed development environment
- ✅ Deployed staging environment
- ✅ Deployed production environment
- ✅ Configured monitoring and alerts
- ✅ Validated infrastructure security
- ✅ Tested connectivity to all services

**Next Steps:**
1. Deploy application workloads to EKS
2. Configure CI/CD pipelines
3. Set up log aggregation
4. Enable backup verification
5. Conduct disaster recovery drills

**Resources:**
- Terraform Documentation: `/terraform/README.md`
- Infrastructure Architecture: `/docs/INFRASTRUCTURE.md`
- Operational Runbook: `/docs/OPERATIONS.md` (TBD)

---

**Last Updated:** 2025-10-18
**Version:** 1.0.0
**Maintained By:** Platform Engineering
