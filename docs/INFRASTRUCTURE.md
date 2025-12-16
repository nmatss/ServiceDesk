# Infrastructure Architecture Documentation

## Overview

The ServiceDesk platform is built on a cloud-native, microservices-based architecture deployed on AWS using Infrastructure as Code (Terraform). This document provides detailed information about the infrastructure design, components, networking, security, and operational procedures.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Internet                                    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   CloudFront CDN       │
                    │   (Global Edge Locs)   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Route53 DNS          │
                    │   Health Checks        │
                    └───────────┬────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│                          AWS Region (us-east-1)                              │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      VPC (10.x.0.0/16)                              │   │
│  │                                                                       │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │   │
│  │  │ AZ-1a            │  │ AZ-1b            │  │ AZ-1c            │ │   │
│  │  │                  │  │                  │  │                  │ │   │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │ │   │
│  │  │ │ Public      │ │  │ │ Public      │ │  │ │ Public      │ │ │   │
│  │  │ │ 10.x.0.0/24 │ │  │ │ 10.x.1.0/24 │ │  │ │ 10.x.2.0/24 │ │ │   │
│  │  │ │             │ │  │ │             │ │  │ │             │ │ │   │
│  │  │ │ - NAT GW    │ │  │ │ - NAT GW    │ │  │ │ - NAT GW    │ │ │   │
│  │  │ │ - ALB       │ │  │ │ - ALB       │ │  │ │ - ALB       │ │ │   │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │ │   │
│  │  │                  │  │                  │  │                  │ │   │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │ │   │
│  │  │ │ Private     │ │  │ │ Private     │ │  │ │ Private     │ │ │   │
│  │  │ │ 10.x.10.0/24│ │  │ │ 10.x.11.0/24│ │  │ │ 10.x.12.0/24│ │ │   │
│  │  │ │             │ │  │ │             │ │  │ │             │ │ │   │
│  │  │ │ - EKS Nodes │ │  │ │ - EKS Nodes │ │  │ │ - EKS Nodes │ │ │   │
│  │  │ │ - App Pods  │ │  │ │ - App Pods  │ │  │ │ - App Pods  │ │ │   │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │ │   │
│  │  │                  │  │                  │  │                  │ │   │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │ │   │
│  │  │ │ Database    │ │  │ │ Database    │ │  │ │ Database    │ │ │   │
│  │  │ │ 10.x.20.0/24│ │  │ │ 10.x.21.0/24│ │  │ │ 10.x.22.0/24│ │ │   │
│  │  │ │             │ │  │ │             │ │  │ │             │ │ │   │
│  │  │ │ - RDS       │ │  │ │ - RDS       │ │  │ │             │ │ │   │
│  │  │ │ - Redis     │ │  │ │ - Redis     │ │  │ │             │ │ │   │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │ │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Managed Services                              │   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │   EKS    │  │   RDS    │  │  Redis   │  │    S3    │           │   │
│  │  │ Control  │  │  Primary │  │  Cluster │  │ Buckets  │           │   │
│  │  │  Plane   │  │  +Read   │  │  Multi-  │  │ Uploads  │           │   │
│  │  │          │  │ Replicas │  │    AZ    │  │ Backups  │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   Security & Monitoring                              │   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │CloudWatch│  │CloudTrail│  │ GuardDuty│  │ Secrets  │           │   │
│  │  │  Logs &  │  │   API    │  │  Threat  │  │ Manager  │           │   │
│  │  │  Metrics │  │ Logging  │  │Detection │  │   KMS    │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Network Architecture

### VPC Design

**CIDR Allocation:**
- Development: `10.0.0.0/16`
- Staging: `10.1.0.0/16`
- Production: `10.2.0.0/16`

**Subnet Strategy:**

| Subnet Type | CIDR Pattern | Purpose | AZs |
|-------------|--------------|---------|-----|
| Public | `10.x.0-9.0/24` | NAT, Load Balancers, Bastion | 3 |
| Private | `10.x.10-19.0/24` | Application workloads, EKS nodes | 3 |
| Database | `10.x.20-29.0/24` | RDS, ElastiCache, isolated data | 3 |

### Network Components

#### Internet Gateway (IGW)
- Single IGW per VPC
- Attached to public subnets
- Enables outbound internet access

#### NAT Gateways
- **Development:** 1 NAT Gateway (cost savings)
- **Staging/Production:** 3 NAT Gateways (one per AZ for HA)
- Provides internet access for private subnets
- Highly available within each AZ

#### Route Tables

**Public Route Table:**
```
Destination       Target
10.x.0.0/16       local
0.0.0.0/0         igw-xxxxx
```

**Private Route Tables:**
```
Destination       Target
10.x.0.0/16       local
0.0.0.0/0         nat-xxxxx (per AZ)
```

**Database Route Table:**
```
Destination       Target
10.x.0.0/16       local
```

### Security Groups

#### EKS Cluster Security Group
```
Ingress:
  - Port 443 from Node SG (API access)
Egress:
  - All traffic to 0.0.0.0/0
```

#### EKS Node Security Group
```
Ingress:
  - All traffic from Node SG (inter-node)
  - Port 1025-65535 from Cluster SG (kubelet)
Egress:
  - All traffic to 0.0.0.0/0
```

#### RDS Security Group
```
Ingress:
  - Port 5432 from EKS Node SG
  - Port 5432 from Bastion SG (optional)
Egress:
  - All traffic to 0.0.0.0/0
```

#### Redis Security Group
```
Ingress:
  - Port 6379 from EKS Node SG
Egress:
  - All traffic to 0.0.0.0/0
```

### Network ACLs

**Public Subnet NACL:**
- Allow all inbound/outbound (stateless firewall)

**Private Subnet NACL:**
- Allow inbound from VPC CIDR
- Allow all outbound

**Database Subnet NACL:**
- Allow inbound only from VPC CIDR
- Allow outbound only to VPC CIDR

## Compute Infrastructure

### EKS Cluster

**Control Plane:**
- Managed by AWS
- Multi-AZ deployment
- Kubernetes version: 1.28
- API endpoint: Public (dev/staging), Private (production)

**Node Groups:**

| Environment | Instance Type | Desired | Min | Max | Disk |
|-------------|---------------|---------|-----|-----|------|
| Dev | t3.small | 2 | 1 | 3 | 50GB |
| Staging | t3.medium | 3 | 2 | 6 | 50GB |
| Production | m5.xlarge | 6 | 3 | 20 | 100GB |

**Add-ons:**
- VPC CNI (networking)
- kube-proxy (service routing)
- CoreDNS (DNS resolution)
- EBS CSI Driver (persistent volumes)

**Auto-Scaling:**
- Cluster Autoscaler enabled
- Scales based on pod resource requests
- Respects min/max node counts

## Database Infrastructure

### RDS PostgreSQL

**Configuration:**

| Environment | Instance | Storage | Multi-AZ | Backups |
|-------------|----------|---------|----------|---------|
| Dev | db.t3.micro | 20GB | No | 7 days |
| Staging | db.t3.medium | 100GB | Yes | 14 days |
| Production | db.r6g.2xlarge | 500GB | Yes | 30 days |

**Features:**
- Automated backups with point-in-time recovery
- Multi-AZ deployment for high availability
- Read replicas for read scaling
- Encryption at rest (AES-256 via KMS)
- Encryption in transit (SSL/TLS)
- Performance Insights enabled
- Enhanced Monitoring (60-second granularity)
- Automated minor version upgrades (dev/staging)
- Manual upgrades (production)

**Maintenance:**
- Backup window: 03:00-04:00 UTC
- Maintenance window: Sunday 04:00-05:00 UTC

### ElastiCache Redis

**Configuration:**

| Environment | Node Type | Nodes | Multi-AZ | Snapshots |
|-------------|-----------|-------|----------|-----------|
| Dev | cache.t3.micro | 1 | No | 0 days |
| Staging | cache.t3.medium | 2 | Yes | 5 days |
| Production | cache.r6g.xlarge | 3 | Yes | 14 days |

**Features:**
- Cluster mode enabled (sharding)
- Automatic failover
- Encryption at rest and in transit
- Auth token enabled (staging/production)
- Daily snapshots
- Multi-AZ with automatic failover

**Memory Policy:** `allkeys-lru` (evict least recently used keys)

## Storage Infrastructure

### S3 Buckets

**Uploads Bucket:**
- Purpose: User file uploads, ticket attachments
- Versioning: Enabled (staging/production)
- Lifecycle: Transition to Intelligent-Tiering after 30 days
- Encryption: KMS
- CORS: Enabled for application domains

**Backups Bucket:**
- Purpose: Database backups, application snapshots
- Versioning: Always enabled
- Lifecycle: Glacier after 90 days, expire after 365 days
- Encryption: KMS
- MFA Delete: Enabled (production)

**Static Assets Bucket:**
- Purpose: Website static files, CDN origin
- Versioning: Enabled (staging/production)
- Encryption: AES-256
- CloudFront OAC: Exclusive access

**Logs Bucket:**
- Purpose: S3 access logs
- Lifecycle: Expire after 90 days
- Encryption: AES-256

## CDN & DNS

### CloudFront Distribution

**Configuration:**
- Origin: S3 static assets bucket
- SSL/TLS: Minimum TLSv1.2
- Price Class: 100 (dev), 200 (staging), All (production)
- Compression: Enabled
- HTTP/2: Enabled
- IPv6: Enabled

**Cache Behavior:**
- Default TTL: 1 hour
- Max TTL: 24 hours
- Static assets (`/static/*`): 1 year max TTL

**Custom Domain:**
- Requires ACM certificate in us-east-1
- CNAME: cdn.servicedesk.example.com

### Route53

**Hosted Zone:** servicedesk.example.com

**Records:**
- A record: Alias to CloudFront
- www CNAME: CloudFront distribution
- Health checks: Every 30 seconds
- Failover routing: Active-passive (future multi-region)

## Security Architecture

### Encryption

**Data at Rest:**
- RDS: KMS encryption (AES-256)
- ElastiCache: KMS encryption
- S3: KMS or AES-256 encryption
- EBS volumes: KMS encryption
- EKS secrets: KMS encryption

**Data in Transit:**
- All services use TLS 1.2+
- Internal communication via VPC (private networking)
- Redis AUTH token required
- Database SSL connections enforced

### IAM & Access Control

**Principle of Least Privilege:**
- Separate IAM roles for each service
- No shared credentials
- Service accounts for applications

**EKS RBAC:**
- Namespace isolation
- Pod security policies
- Network policies

**Secrets Management:**
- AWS Secrets Manager for database credentials
- Automatic rotation enabled
- Application secrets via Kubernetes Secrets + KMS

### Threat Detection

**GuardDuty:**
- Enabled in staging/production
- Monitors CloudTrail, VPC Flow Logs, DNS logs
- Alerts on suspicious activity

**CloudTrail:**
- All API calls logged
- Multi-region trail
- Log file integrity validation
- S3 bucket with MFA delete

**VPC Flow Logs:**
- Enabled in production
- 30-90 day retention
- Analyze with CloudWatch Insights

### Compliance

**AWS Config:**
- Track resource configurations
- Compliance rules for:
  - Encryption at rest
  - Public access blocked
  - Multi-AZ enabled
  - Backup retention

**Auditing:**
- All changes tracked via CloudTrail
- Terraform state changes logged
- Access logs for S3 buckets

## Monitoring & Observability

### CloudWatch

**Log Groups:**
- Application logs: `/aws/servicedesk-{env}/application`
- EKS cluster logs: `/aws/eks/{cluster-name}/cluster`
- VPC Flow Logs: `/aws/vpc/{vpc-name}`
- RDS logs: PostgreSQL, upgrade logs
- Redis logs: Slow log, engine log

**Retention:**
- Development: 7 days
- Staging: 30 days
- Production: 90 days

### Metrics & Alarms

**EKS Metrics:**
- Node count
- Pod count
- CPU/Memory utilization
- API server latency

**RDS Alarms:**
- CPU utilization > 80%
- Freeable memory < 256MB
- Free storage < 5GB
- Database connections > threshold

**ElastiCache Alarms:**
- CPU utilization > 75%
- Memory usage > 90%
- Evictions > 1000/5min

**CloudFront Alarms:**
- 5xx error rate > 5%
- Request count anomalies

### SNS Notifications

**Alert Topics:**
- Development: dev-team@example.com
- Staging: ops@example.com
- Production: production-alerts@example.com

**Alert Types:**
- Critical infrastructure failures
- Resource utilization thresholds
- Security events
- Cost anomalies

### Dashboard

**CloudWatch Dashboard includes:**
- EKS cluster health
- RDS performance metrics
- ElastiCache performance
- CloudFront request/error rates
- Cost trends

## Disaster Recovery

### Backup Strategy

**RDS:**
- Automated daily snapshots
- Retention: 7-30 days (environment dependent)
- Manual snapshots before major changes
- Point-in-time recovery available

**ElastiCache:**
- Daily automated snapshots (staging/production)
- Retention: 5-14 days
- Manual snapshots supported

**S3:**
- Versioning enabled
- Cross-region replication (future enhancement)

### Recovery Procedures

**RTO (Recovery Time Objective):**
- Development: 24 hours
- Staging: 8 hours
- Production: 4 hours

**RPO (Recovery Point Objective):**
- Development: 24 hours
- Staging: 4 hours
- Production: 1 hour

**Recovery Steps:**
1. Create new environment from Terraform
2. Restore RDS from latest snapshot
3. Restore ElastiCache from snapshot
4. Redeploy applications from container registry
5. Verify data integrity
6. Update DNS records

## Cost Optimization

### Current Optimizations

1. **Auto-Scaling:** EKS nodes scale down during low usage
2. **S3 Intelligent-Tiering:** Automatic cost optimization
3. **RDS Storage Auto-Scaling:** Grows only when needed
4. **Single NAT Gateway:** Development environment
5. **Reserved Instances:** Production baseline (manual setup)

### Cost Monitoring

- **AWS Cost Explorer:** Daily cost tracking
- **Cost Anomaly Detection:** Automated alerts
- **Budget Alerts:** Monthly budget thresholds
- **Infracost:** CI/CD cost estimation

### Estimated Monthly Costs

| Environment | Compute | Database | Storage | Data Transfer | Monitoring | Total |
|-------------|---------|----------|---------|---------------|------------|-------|
| Dev | $50 | $30 | $20 | $10 | $10 | ~$120 |
| Staging | $150 | $100 | $50 | $30 | $40 | ~$370 |
| Production | $800 | $600 | $200 | $200 | $100 | ~$1,900 |

### Cost Reduction Recommendations

1. **Dev:** Stop resources during nights/weekends (save 60%)
2. **Staging:** Use Spot instances for non-critical workloads
3. **Production:** Purchase 1-year Reserved Instances (save 40%)
4. **All:** Review and delete unused snapshots monthly

## Operational Procedures

### Deployment Workflow

1. Developer creates PR with infrastructure changes
2. GitHub Actions runs:
   - Terraform validate
   - Terraform fmt check
   - tfsec security scan
   - Checkov compliance scan
   - Infracost estimation
   - Terraform plan
3. Team reviews plan and cost impact
4. On merge to main:
   - Auto-deploy to dev
   - Manual approval for staging
   - Manual approval for production

### Scaling Procedures

**Vertical Scaling (larger instances):**
```bash
# Update instance type in variables.tf
variable "eks_node_instance_types" {
  default = ["m5.2xlarge"]  # from m5.xlarge
}

terraform plan
terraform apply
```

**Horizontal Scaling (more instances):**
```bash
# Update desired/max size
variable "eks_node_desired_size" {
  default = 10  # from 6
}

terraform plan
terraform apply
```

### Incident Response

**High Priority Incidents:**

1. **RDS Failure:**
   - Automatic failover to standby (Multi-AZ)
   - Monitor via CloudWatch
   - Alert via SNS

2. **EKS Node Failure:**
   - Auto-scaling replaces failed nodes
   - Pods rescheduled automatically
   - Alert if cluster capacity < 50%

3. **S3 Outage:**
   - CloudFront serves cached content
   - S3 has 99.99% SLA

**Incident Communication:**
- Slack channel: #incidents
- Status page: status.servicedesk.example.com
- Email: production-alerts@example.com

### Maintenance Windows

**Production:**
- Weekly: Sunday 04:00-05:00 UTC
- Monthly: First Sunday 02:00-06:00 UTC

**Staging:**
- Any time (no SLA)

**Development:**
- Any time

### Patching Strategy

**OS Patching (EKS nodes):**
- Managed node groups auto-update
- Rolling update strategy
- Zero downtime

**Database Patching:**
- Auto minor version upgrades (dev/staging)
- Manual major version upgrades (all environments)
- Test in dev → staging → production

**Application Patching:**
- Continuous deployment via CI/CD
- Blue-green deployments
- Automated rollback on failure

## Future Enhancements

### Planned Improvements

1. **Multi-Region Deployment:**
   - Active-passive failover
   - Cross-region replication
   - Global accelerator

2. **Service Mesh:**
   - Istio or AWS App Mesh
   - Advanced traffic management
   - Enhanced observability

3. **GitOps:**
   - ArgoCD for Kubernetes deployments
   - Flux for automated sync

4. **Advanced Monitoring:**
   - Prometheus + Grafana
   - Distributed tracing (X-Ray, Jaeger)
   - Custom business metrics

5. **Cost Optimization:**
   - Karpenter for intelligent node scaling
   - Fargate for serverless workloads
   - Savings Plans

### Migration Path

**Current State:** SQLite (local development)
**Target State:** PostgreSQL on RDS (all environments)

**Migration Steps:**
1. Deploy infrastructure via Terraform
2. Export data from SQLite
3. Transform schema for PostgreSQL
4. Import data to RDS
5. Update application configuration
6. Validate data integrity
7. Cut over DNS
8. Monitor for 24 hours
9. Decommission old infrastructure

## Appendix

### Useful Commands

**AWS CLI:**
```bash
# List all resources in environment
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Environment,Values=production

# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier servicedesk-production-db

# View CloudWatch logs
aws logs tail /aws/servicedesk-production/application --follow
```

**kubectl:**
```bash
# Update kubeconfig
aws eks update-kubeconfig --name servicedesk-production

# View nodes
kubectl get nodes

# View all resources
kubectl get all -A
```

**Terraform:**
```bash
# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply

# Destroy (careful!)
terraform destroy
```

### References

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [EKS Best Practices Guide](https://aws.github.io/aws-eks-best-practices/)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [PostgreSQL on RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**Next Review:** 2025-11-18
**Owner:** Platform Engineering Team
