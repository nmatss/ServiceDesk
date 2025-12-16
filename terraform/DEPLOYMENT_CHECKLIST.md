# Terraform Deployment Checklist

Use this checklist to ensure a successful infrastructure deployment.

## Pre-Deployment

### Tools & Access
- [ ] Terraform >= 1.5.0 installed
- [ ] AWS CLI v2 installed and configured
- [ ] kubectl installed
- [ ] tfsec installed (optional but recommended)
- [ ] checkov installed (optional but recommended)
- [ ] AWS account with appropriate permissions
- [ ] AWS credentials configured (`aws configure`)
- [ ] GitHub account for CI/CD (optional)

### AWS Account Setup
- [ ] AWS account billing enabled
- [ ] IAM user or role with AdministratorAccess
- [ ] AWS CLI tested: `aws sts get-caller-identity`
- [ ] Budget alerts configured
- [ ] Cost anomaly detection enabled (optional)

### Backend Preparation
- [ ] S3 bucket created for Terraform state
- [ ] S3 versioning enabled
- [ ] S3 encryption enabled (AES-256 or KMS)
- [ ] S3 public access blocked
- [ ] DynamoDB table created for state locking
- [ ] DynamoDB PITR enabled (optional)

### Configuration Review
- [ ] Review `backend.tf` - update bucket/table names if needed
- [ ] Review `variables.tf` - customize default values
- [ ] Update email addresses for alerts
- [ ] Update domain names (if deploying Route53)
- [ ] Review cost estimates for each environment
- [ ] Team notified of deployment schedule

## Development Environment Deployment

### Pre-Deploy Checks
- [ ] Navigate to `terraform/environments/dev`
- [ ] Review `main.tf` configuration
- [ ] Understand resource costs (~$120-180/month)
- [ ] Confirm this is non-production environment

### Deployment Steps
- [ ] Run `terraform init`
- [ ] Run `terraform validate`
- [ ] Run `terraform fmt -check`
- [ ] Run `tfsec .` (fix any HIGH/CRITICAL issues)
- [ ] Run `terraform plan -out=tfplan`
- [ ] Review plan output carefully
- [ ] Run `terraform apply tfplan`
- [ ] Wait for deployment (~20-30 minutes)
- [ ] Save outputs: `terraform output -json > outputs.json`

### Post-Deploy Validation
- [ ] Configure kubectl: `aws eks update-kubeconfig --name servicedesk-dev`
- [ ] Verify nodes: `kubectl get nodes`
- [ ] Test RDS connection
- [ ] Test Redis connection
- [ ] Verify S3 buckets created
- [ ] Check CloudWatch logs
- [ ] Review CloudWatch alarms
- [ ] Test application deployment (if ready)

### Documentation
- [ ] Document RDS endpoint
- [ ] Document Redis endpoint
- [ ] Document S3 bucket names
- [ ] Save credentials securely (Secrets Manager)
- [ ] Update team wiki with access info

## Staging Environment Deployment

### Pre-Deploy Checks
- [ ] Development environment successfully deployed
- [ ] Dev environment tested and working
- [ ] Navigate to `terraform/environments/staging`
- [ ] Review `main.tf` configuration
- [ ] Understand resource costs (~$370-500/month)
- [ ] Confirm Multi-AZ is enabled
- [ ] Confirm CloudTrail/GuardDuty enabled

### Deployment Steps
- [ ] Run `terraform init`
- [ ] Run `terraform validate`
- [ ] Run `terraform fmt -check`
- [ ] Run `tfsec .` (NO HIGH/CRITICAL issues allowed)
- [ ] Run `checkov -d .` (review findings)
- [ ] Run `terraform plan -out=tfplan`
- [ ] Review plan output with team
- [ ] Get approval from tech lead
- [ ] Run `terraform apply tfplan`
- [ ] Wait for deployment (~30-40 minutes)
- [ ] Save outputs: `terraform output -json > outputs.json`

### Post-Deploy Validation
- [ ] Configure kubectl: `aws eks update-kubeconfig --name servicedesk-staging`
- [ ] Verify all 3 nodes are running
- [ ] Test RDS Multi-AZ failover (optional)
- [ ] Test Redis failover (optional)
- [ ] Verify backups configured (14-day retention)
- [ ] Check CloudTrail logs
- [ ] Check GuardDuty findings
- [ ] Test CloudFront distribution
- [ ] Verify Route53 DNS (if configured)
- [ ] Performance testing

### DNS Configuration (if applicable)
- [ ] Get Route53 name servers: `terraform output route53_name_servers`
- [ ] Update domain registrar with name servers
- [ ] Wait for DNS propagation (up to 48 hours)
- [ ] Verify DNS: `dig staging.yourcompany.com`

## Production Environment Deployment

### Critical Pre-Deploy Checks
- [ ] Staging environment fully tested
- [ ] No critical issues in staging
- [ ] Security audit completed
- [ ] Team trained on operational procedures
- [ ] Incident response plan in place
- [ ] Backup and recovery procedures tested
- [ ] Navigate to `terraform/environments/production`
- [ ] Review `main.tf` configuration
- [ ] Understand resource costs (~$1,900-2,500/month)
- [ ] Confirm all security features enabled
- [ ] Confirm deletion protection enabled
- [ ] Get management approval

### Configuration Updates
- [ ] Update `alarm_email` to production alerts list
- [ ] Update `domain_name` to production domain
- [ ] Add ACM certificate ARN (if using CloudFront)
- [ ] Review and update all variables
- [ ] Commit changes to version control

### Deployment Steps
- [ ] Run `terraform init`
- [ ] Run `terraform validate`
- [ ] Run `terraform fmt -check`
- [ ] Run `tfsec .` (ZERO HIGH/CRITICAL issues)
- [ ] Run `checkov -d .` (resolve all critical findings)
- [ ] Run cost estimation: `infracost breakdown --path .`
- [ ] Run `terraform plan -out=tfplan`
- [ ] Export plan: `terraform show -no-color tfplan > production-plan.txt`
- [ ] Share plan with entire team
- [ ] Schedule deployment window (low-traffic period)
- [ ] Get final approval from CTO/Engineering Manager
- [ ] Run `terraform apply tfplan`
- [ ] Monitor deployment (~45-60 minutes)
- [ ] Save outputs: `terraform output -json > outputs-prod.json`

### Post-Deploy Validation
- [ ] Configure kubectl: `aws eks update-kubeconfig --name servicedesk-production`
- [ ] Verify all 6 nodes across 3 AZs
- [ ] Test RDS connectivity
- [ ] Test Redis connectivity
- [ ] Verify RDS Multi-AZ setup
- [ ] Verify Redis Multi-AZ setup
- [ ] Check 30-day backup retention
- [ ] Verify encryption at rest (all services)
- [ ] Verify encryption in transit
- [ ] Check VPC Flow Logs enabled
- [ ] Check CloudTrail enabled
- [ ] Check GuardDuty enabled
- [ ] Verify all CloudWatch alarms
- [ ] Test SNS email notifications
- [ ] Review CloudWatch dashboard

### DNS & SSL Configuration
- [ ] Get Route53 name servers: `terraform output route53_name_servers`
- [ ] Update production domain registrar
- [ ] Wait for DNS propagation
- [ ] Verify DNS: `dig servicedesk.yourcompany.com`
- [ ] Verify ACM certificate (if using CloudFront)
- [ ] Test HTTPS connectivity
- [ ] Verify SSL certificate validity

### Security Validation
- [ ] Run security scan on deployed infrastructure
- [ ] Verify IAM roles follow least privilege
- [ ] Check security groups are properly restricted
- [ ] Verify KMS keys are being used
- [ ] Check Secrets Manager integration
- [ ] Review GuardDuty findings (if any)
- [ ] Review CloudTrail logs
- [ ] Penetration testing (if required)

### Performance Testing
- [ ] Load testing on application
- [ ] Database performance testing
- [ ] Redis latency testing
- [ ] EKS cluster stress testing
- [ ] CloudFront cache hit ratio
- [ ] Network latency testing

### Monitoring Setup
- [ ] Subscribe to SNS alerts
- [ ] Configure Slack/Teams integration (optional)
- [ ] Set up PagerDuty integration (optional)
- [ ] Create runbooks for common issues
- [ ] Test alert notifications
- [ ] Configure CloudWatch dashboard
- [ ] Set up log aggregation
- [ ] Enable X-Ray tracing (optional)

### Disaster Recovery
- [ ] Document RDS snapshot locations
- [ ] Document Redis snapshot locations
- [ ] Test database restore procedure
- [ ] Test Redis restore procedure
- [ ] Document recovery time objectives (RTO)
- [ ] Document recovery point objectives (RPO)
- [ ] Schedule DR drills

### Documentation
- [ ] Update architecture diagrams
- [ ] Document all endpoints
- [ ] Document all credentials (stored in Secrets Manager)
- [ ] Update runbooks
- [ ] Create operational procedures
- [ ] Update team wiki
- [ ] Create on-call guide

## Post-Deployment

### Application Deployment
- [ ] Deploy application to EKS
- [ ] Configure Kubernetes secrets
- [ ] Set up ingress controllers
- [ ] Configure load balancer
- [ ] Deploy monitoring agents
- [ ] Configure log shipping
- [ ] Run smoke tests
- [ ] Run integration tests

### Database Migration
- [ ] Export data from SQLite
- [ ] Transform schema for PostgreSQL
- [ ] Import data to RDS
- [ ] Validate data integrity
- [ ] Run data consistency checks
- [ ] Update application connection strings
- [ ] Test application with new database

### Final Validation
- [ ] End-to-end testing
- [ ] User acceptance testing
- [ ] Performance benchmarking
- [ ] Security validation
- [ ] Compliance check
- [ ] Cost validation

### Team Handoff
- [ ] Train operations team
- [ ] Train support team
- [ ] Document escalation procedures
- [ ] Create troubleshooting guide
- [ ] Schedule knowledge transfer sessions
- [ ] Update on-call rotation

### Monitoring & Maintenance
- [ ] Set up weekly review process
- [ ] Schedule monthly cost reviews
- [ ] Plan quarterly security audits
- [ ] Schedule backup verification
- [ ] Create maintenance windows
- [ ] Document upgrade procedures

## Rollback Plan

### If Deployment Fails
- [ ] Capture error logs
- [ ] Document failure reason
- [ ] Run `terraform destroy` if needed
- [ ] Restore from previous state version
- [ ] Notify stakeholders
- [ ] Schedule post-mortem

### Rollback Procedure
1. [ ] Stop new deployments
2. [ ] Assess impact
3. [ ] Decide: fix forward or rollback
4. [ ] If rollback: Pull previous state from S3
5. [ ] Run `terraform state push <previous-state>`
6. [ ] Verify infrastructure matches previous state
7. [ ] Test thoroughly
8. [ ] Notify team

## Compliance Checklist

### Security Compliance
- [ ] All data encrypted at rest
- [ ] All data encrypted in transit
- [ ] Least-privilege IAM policies
- [ ] MFA enabled for admin access
- [ ] CloudTrail enabled
- [ ] GuardDuty enabled
- [ ] VPC Flow Logs enabled
- [ ] No public database access
- [ ] Security groups properly configured

### Operational Compliance
- [ ] Automated backups configured
- [ ] Backup retention meets requirements
- [ ] Disaster recovery tested
- [ ] Monitoring and alerting active
- [ ] Incident response plan documented
- [ ] Change management process followed
- [ ] Documentation up to date

### Cost Compliance
- [ ] Budget alerts configured
- [ ] Cost anomaly detection enabled
- [ ] Resource tagging complete
- [ ] Monthly cost reviews scheduled
- [ ] Cost optimization opportunities identified

## Sign-off

### Development
- [ ] Developer: _________________ Date: _______
- [ ] Tech Lead: ________________ Date: _______

### Staging
- [ ] Developer: _________________ Date: _______
- [ ] Tech Lead: ________________ Date: _______
- [ ] DevOps: ___________________ Date: _______

### Production
- [ ] Developer: _________________ Date: _______
- [ ] Tech Lead: ________________ Date: _______
- [ ] DevOps: ___________________ Date: _______
- [ ] Security: _________________ Date: _______
- [ ] CTO/Manager: ______________ Date: _______

---

**Remember:**
- Never rush production deployments
- Always have a rollback plan
- Test thoroughly in dev and staging first
- Get proper approvals before production
- Document everything
- Monitor closely after deployment
- Celebrate successful deployments!

**Emergency Contacts:**
- AWS Support: Enterprise Support
- On-Call DevOps: [Phone/Slack]
- Security Team: [Email/Slack]
- Platform Team: platform@example.com
