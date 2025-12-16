# Development Environment Configuration
# Small instances, single AZ for cost savings

terraform {
  backend "s3" {
    bucket         = "servicedesk-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "servicedesk-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}

locals {
  environment = "dev"
  common_tags = {
    Project     = var.project_name
    Environment = local.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = local.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]

  # Cost savings: single NAT gateway
  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_vpc_flow_logs   = false  # Disable for dev

  tags = local.common_tags
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  project_name       = var.project_name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids

  cluster_version       = "1.28"
  node_instance_types   = ["t3.small"]  # Small instances for dev
  node_desired_size     = 2
  node_min_size         = 1
  node_max_size         = 3

  enable_public_access  = true
  enabled_cluster_log_types = []  # Disable logs for dev
  log_retention_days    = 7

  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  project_name          = var.project_name
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  database_subnet_ids   = module.vpc.database_subnet_ids
  allowed_security_groups = [module.eks.node_security_group_id]

  engine_version        = "15.4"
  instance_class        = "db.t3.micro"  # Small instance for dev
  allocated_storage     = 20
  max_allocated_storage = 50

  multi_az                    = false  # Single AZ for dev
  backup_retention_period     = 7
  enable_enhanced_monitoring  = false  # Disable for dev
  enable_performance_insights = false  # Disable for dev
  deletion_protection         = false  # Allow deletion in dev

  alarm_actions = [module.monitoring.sns_alerts_topic_arn]
  tags          = local.common_tags
}

# ElastiCache Module
module "elasticache" {
  source = "../../modules/elasticache"

  project_name          = var.project_name
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  allowed_security_groups = [module.eks.node_security_group_id]

  engine_version        = "7.0"
  node_type             = "cache.t3.micro"  # Small instance for dev
  num_cache_nodes       = 1  # Single node for dev

  automatic_failover_enabled = false  # Disable for dev
  multi_az_enabled           = false  # Disable for dev
  snapshot_retention_limit   = 0      # No snapshots for dev

  alarm_actions = [module.monitoring.sns_alerts_topic_arn]
  tags          = local.common_tags
}

# S3 Module
module "s3" {
  source = "../../modules/s3"

  project_name            = var.project_name
  environment             = local.environment
  versioning_enabled      = false  # Disable for dev
  enable_access_logging   = false  # Disable for dev
  lifecycle_glacier_days  = 180
  lifecycle_expiration_days = 365

  tags = local.common_tags
}

# CloudFront Module
module "cloudfront" {
  source = "../../modules/cloudfront"

  project_name                       = var.project_name
  environment                        = local.environment
  static_bucket_id                   = module.s3.static_bucket_id
  static_bucket_arn                  = module.s3.static_bucket_arn
  static_bucket_regional_domain_name = module.s3.static_bucket_regional_domain_name

  price_class = "PriceClass_100"  # US, Canada, Europe only

  alarm_actions = [module.monitoring.sns_alerts_topic_arn]
  tags          = local.common_tags
}

# Route53 Module
module "route53" {
  source = "../../modules/route53"

  project_name                  = var.project_name
  environment                   = local.environment
  domain_name                   = "dev.servicedesk.example.com"
  create_hosted_zone            = false  # Disable for dev

  tags = local.common_tags
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"

  project_name     = var.project_name
  environment      = local.environment
  alarm_email      = "dev-team@example.com"
  log_retention_days = 7

  enable_cloudtrail              = false  # Disable for dev
  enable_guardduty               = false  # Disable for dev
  enable_cost_anomaly_detection  = false  # Disable for dev

  tags = local.common_tags
}
