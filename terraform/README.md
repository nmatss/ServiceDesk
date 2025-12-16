# ServiceDesk Infrastructure as Code (Terraform)

Complete AWS infrastructure provisioning using Terraform with modular design, multi-environment support, and enterprise security.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Module Structure](#module-structure)
- [Environment Configurations](#environment-configurations)
- [Deployment Guide](#deployment-guide)
- [Security](#security)
- [Cost Optimization](#cost-optimization)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  VPC (10.x.0.0/16) - Multi-AZ                        │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │  Public      │  │  Private     │  │  Database  │ │  │
│  │  │  Subnets     │  │  Subnets     │  │  Subnets   │ │  │
│  │  │              │  │              │  │            │ │  │
│  │  │  - NAT GW    │  │  - EKS Nodes │  │  - RDS     │ │  │
│  │  │  - ALB       │  │  - Apps      │  │  - Redis   │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  EKS         │  │  RDS         │  │  ElastiCache │     │
│  │  Kubernetes  │  │  PostgreSQL  │  │  Redis       │     │
│  │  Cluster     │  │  Multi-AZ    │  │  Multi-AZ    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  S3          │  │  CloudFront  │  │  Route53     │     │
│  │  Storage     │  │  CDN         │  │  DNS         │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Monitoring: CloudWatch + GuardDuty + CloudTrail    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools

1. **Terraform** >= 1.5.0
   ```bash
   brew install terraform  # macOS
   # or
   wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
   ```

2. **AWS CLI** >= 2.0
   ```bash
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

3. **kubectl** (for EKS management)
   ```bash
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   ```

4. **Security Scanning Tools** (optional but recommended)
   ```bash
   # tfsec
   brew install tfsec

   # checkov
   pip3 install checkov

   # infracost
   brew install infracost
   ```

### AWS Account Setup

1. **AWS Account with appropriate permissions**
2. **AWS IAM User or Role** with AdministratorAccess (or custom policy)
3. **AWS CLI configured**
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
   ```

### Backend Initialization

Before using Terraform, create the S3 bucket and DynamoDB table for state management:

```bash
# Create S3 bucket for state
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
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket servicedesk-terraform-state \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name servicedesk-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Quick Start

### 1. Deploy Development Environment

```bash
# Navigate to dev environment
cd terraform/environments/dev

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply

# View outputs
terraform output
```

### 2. Configure kubectl for EKS

```bash
# Get the kubectl config command from outputs
terraform output kubectl_config_command

# Or manually:
aws eks update-kubeconfig --region us-east-1 --name servicedesk-dev

# Test connection
kubectl get nodes
```

### 3. Connect to Database

```bash
# Get RDS endpoint
terraform output rds_endpoint

# Get password from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id servicedesk-dev-rds-master-password \
  --query SecretString --output text | jq -r .password

# Connect
psql -h <rds-endpoint> -U dbadmin -d servicedesk
```

## Module Structure

```
terraform/
├── backend.tf                 # Remote state configuration
├── variables.tf               # Global variables
├── outputs.tf                 # Global outputs
├── modules/                   # Reusable infrastructure modules
│   ├── vpc/                   # Multi-AZ VPC with subnets
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── eks/                   # Kubernetes cluster
│   ├── rds/                   # PostgreSQL database
│   ├── elasticache/           # Redis cluster
│   ├── s3/                    # Object storage buckets
│   ├── cloudfront/            # CDN distribution
│   ├── route53/               # DNS management
│   └── monitoring/            # CloudWatch, GuardDuty, CloudTrail
└── environments/              # Environment-specific configs
    ├── dev/
    ├── staging/
    └── production/
```

### Module Descriptions

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **vpc** | Network infrastructure | Multi-AZ, NAT Gateway, Flow Logs, Network ACLs |
| **eks** | Kubernetes cluster | Auto-scaling, OIDC, KMS encryption, Add-ons |
| **rds** | PostgreSQL database | Multi-AZ, auto-backups, Performance Insights |
| **elasticache** | Redis cache | Cluster mode, auto-failover, encryption |
| **s3** | Object storage | Versioning, lifecycle, encryption, CORS |
| **cloudfront** | CDN | HTTPS, custom domains, cache policies |
| **route53** | DNS | Health checks, A records, failover |
| **monitoring** | Observability | Logs, metrics, alarms, cost anomaly detection |

## Environment Configurations

### Development

**Purpose:** Rapid iteration, minimal cost
- Single NAT Gateway
- Small instances (t3.micro, t3.small)
- Single-AZ for non-critical resources
- Reduced backup retention (7 days)
- No enhanced monitoring

**Estimated Monthly Cost:** ~$200-300

### Staging

**Purpose:** Pre-production testing, production-like
- Multi-AZ deployment
- Medium instances (t3.medium)
- Multi-AZ for all critical resources
- 14-day backup retention
- Full monitoring enabled

**Estimated Monthly Cost:** ~$500-700

### Production

**Purpose:** Live workloads, maximum availability
- Multi-AZ across 3 zones
- Large instances (m5.xlarge, r6g.2xlarge)
- Private EKS cluster
- 30-day backup retention
- Full security suite (GuardDuty, CloudTrail)
- VPC Flow Logs
- Performance Insights

**Estimated Monthly Cost:** ~$2,000-3,000

## Deployment Guide

### Step-by-Step Deployment

#### 1. Development Environment

```bash
cd terraform/environments/dev

# Initialize
terraform init

# Validate configuration
terraform validate

# Check formatting
terraform fmt -check

# Security scan (optional)
tfsec .
checkov -d .

# Plan with output
terraform plan -out=tfplan

# Review plan carefully
terraform show tfplan

# Apply
terraform apply tfplan

# Save outputs
terraform output -json > outputs.json
```

#### 2. Staging Environment

```bash
cd terraform/environments/staging

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

#### 3. Production Environment

**IMPORTANT:** Production requires manual approval and additional safeguards.

```bash
cd terraform/environments/production

# Plan
terraform plan -out=tfplan

# Review plan with team
# Ensure deletion protection is enabled
# Verify backup configurations
# Check cost estimates

# Apply (requires confirmation)
terraform apply tfplan
```

### Updating Infrastructure

```bash
# Make changes to .tf files

# Format code
terraform fmt -recursive

# Plan changes
terraform plan -out=tfplan

# Review changes carefully
terraform show tfplan

# Apply only if changes are expected
terraform apply tfplan
```

### Destroying Infrastructure

**WARNING:** Destroying production infrastructure is irreversible!

```bash
# Development (safe to destroy)
cd terraform/environments/dev
terraform destroy

# Staging (requires confirmation)
cd terraform/environments/staging
terraform destroy

# Production (NOT RECOMMENDED - use only for decommissioning)
cd terraform/environments/production
# Disable deletion protection first
terraform destroy  # Requires multiple confirmations
```

## Security

### Encryption

All resources use encryption by default:

- **RDS:** AES-256 encryption at rest via KMS
- **ElastiCache:** Encryption at rest and in transit
- **S3:** Server-side encryption with KMS
- **EKS:** Secrets encryption with KMS
- **CloudWatch Logs:** KMS encryption

### Network Security

- **Private Subnets:** Application and database resources in private subnets
- **Security Groups:** Least-privilege firewall rules
- **Network ACLs:** Additional network layer protection
- **VPC Flow Logs:** Network traffic monitoring (staging/production)

### Access Control

- **IAM Roles:** Service-specific IAM roles with minimal permissions
- **OIDC Provider:** Kubernetes service account authentication
- **Secrets Manager:** Encrypted credential storage
- **Multi-Factor Authentication:** Required for production access

### Compliance & Auditing

- **CloudTrail:** API call logging and auditing
- **GuardDuty:** Threat detection
- **AWS Config:** Resource compliance tracking
- **Cost Anomaly Detection:** Unusual spending alerts

## Cost Optimization

### Built-in Optimizations

1. **Auto-Scaling:** EKS nodes scale based on demand
2. **RDS Storage Auto-Scaling:** Grows only when needed
3. **S3 Intelligent-Tiering:** Automatic cost optimization
4. **Reserved Instances:** Use for production (manual setup)
5. **Spot Instances:** Available for non-critical EKS workloads

### Cost Monitoring

```bash
# Enable cost anomaly detection (production)
# Configured in monitoring module

# View estimated costs (requires Infracost)
cd terraform/environments/production
infracost breakdown --path .

# Compare environments
infracost diff --path terraform/environments/dev \
               --compare-to terraform/environments/production
```

### Cost Reduction Tips

- **Dev Environment:** Use single NAT Gateway, disable monitoring
- **Staging:** Scale down during off-hours
- **Production:** Use Reserved Instances for baseline capacity
- **General:** Set up AWS Budgets and alerts

## Troubleshooting

### Common Issues

#### 1. Backend Initialization Failed

```bash
Error: Failed to get existing workspaces: S3 bucket does not exist
```

**Solution:** Create backend resources (see Backend Initialization section)

#### 2. Insufficient Permissions

```bash
Error: AccessDenied: User is not authorized to perform: eks:CreateCluster
```

**Solution:** Ensure IAM user/role has required permissions

#### 3. Resource Already Exists

```bash
Error: Error creating DB Instance: DBInstanceAlreadyExists
```

**Solution:** Import existing resource or use different identifier
```bash
terraform import module.rds.aws_db_instance.main existing-db-id
```

#### 4. EKS Cluster Unreachable

```bash
Error: Kubernetes cluster unreachable
```

**Solution:** Update kubeconfig
```bash
aws eks update-kubeconfig --region us-east-1 --name servicedesk-production
```

#### 5. State Lock Acquired

```bash
Error: Error acquiring the state lock
```

**Solution:** Force unlock (use carefully)
```bash
terraform force-unlock <LOCK_ID>
```

### Debugging Tips

```bash
# Enable detailed logging
export TF_LOG=DEBUG
export TF_LOG_PATH=./terraform.log

# Validate configuration
terraform validate

# Check state
terraform state list
terraform state show <resource>

# Refresh state
terraform refresh

# Targeted plan
terraform plan -target=module.vpc

# Graph dependencies
terraform graph | dot -Tpng > graph.png
```

### Getting Help

1. **Check Terraform Logs:** Review `terraform.log` for detailed errors
2. **AWS Console:** Verify resource creation in AWS console
3. **CloudWatch Logs:** Check application and infrastructure logs
4. **Module Documentation:** Review individual module README files
5. **Community:** Terraform community forums and AWS support

## Maintenance

### Regular Tasks

- **Weekly:** Review CloudWatch alarms and logs
- **Monthly:** Update Terraform modules to latest versions
- **Quarterly:** Review and optimize costs
- **Annually:** Renew certificates, review security policies

### Backup Verification

```bash
# Check RDS backups
aws rds describe-db-snapshots --db-instance-identifier servicedesk-production-db

# Check S3 versioning
aws s3api get-bucket-versioning --bucket servicedesk-production-backups

# Check ElastiCache snapshots
aws elasticache describe-snapshots --replication-group-id servicedesk-production-redis
```

### Disaster Recovery

All environments include:
- Automated RDS snapshots (7-30 days retention)
- ElastiCache snapshots (0-14 days retention)
- S3 versioning and lifecycle policies
- Infrastructure as Code for rapid rebuild

**Recovery Time Objective (RTO):** < 4 hours
**Recovery Point Objective (RPO):** < 1 hour

## CI/CD Integration

GitHub Actions workflow included at `.github/workflows/terraform.yml`

**Features:**
- Automatic validation on PR
- Security scanning (tfsec, Checkov)
- Cost estimation (Infracost)
- Automated apply on merge
- Manual destroy with approval

**Setup:**
1. Add AWS credentials to GitHub Secrets
2. Configure OIDC provider for GitHub Actions
3. Set `AWS_ROLE_TO_ASSUME` secret
4. Enable branch protection for main

## Next Steps

1. **Customize Variables:** Update `variables.tf` for your organization
2. **Configure DNS:** Update domain names in Route53 module
3. **Add SSL Certificates:** Create ACM certificates for CloudFront
4. **Set Up Monitoring:** Configure SNS email subscriptions
5. **Deploy Applications:** Use kubectl to deploy workloads to EKS
6. **Set Up CI/CD:** Configure GitHub Actions workflows

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)

---

**Version:** 1.0.0
**Last Updated:** 2025-10-18
**Maintained By:** DevOps Team
