# Production Environment - Full HA, Multi-AZ, Maximum Security

terraform {
  backend "s3" {
    bucket         = "servicedesk-terraform-state"
    key            = "production/terraform.tfstate"
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
  environment = "production"
  common_tags = {
    Project     = var.project_name
    Environment = local.environment
    ManagedBy   = "Terraform"
    Owner       = "Platform"
    CostCenter  = "Engineering"
    Compliance  = "Required"
  }
}

module "vpc" {
  source             = "../../modules/vpc"
  project_name       = var.project_name
  environment        = local.environment
  vpc_cidr           = "10.2.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway = true
  single_nat_gateway = false
  enable_vpc_flow_logs = true
  flow_logs_retention_days = 90
  tags = local.common_tags
}

module "eks" {
  source              = "../../modules/eks"
  project_name        = var.project_name
  environment         = local.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  private_subnet_ids  = module.vpc.private_subnet_ids
  cluster_version     = "1.28"
  node_instance_types = ["m5.xlarge"]
  node_desired_size   = 6
  node_min_size       = 3
  node_max_size       = 20
  enable_public_access = false  # Private only
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  log_retention_days  = 90
  enable_ebs_csi_driver = true
  tags = local.common_tags
}

module "rds" {
  source                      = "../../modules/rds"
  project_name                = var.project_name
  environment                 = local.environment
  vpc_id                      = module.vpc.vpc_id
  database_subnet_ids         = module.vpc.database_subnet_ids
  allowed_security_groups     = [module.eks.node_security_group_id]
  engine_version              = "15.4"
  instance_class              = "db.r6g.2xlarge"
  allocated_storage           = 500
  max_allocated_storage       = 2000
  storage_type                = "gp3"
  multi_az                    = true
  backup_retention_period     = 30
  deletion_protection         = true
  enable_enhanced_monitoring  = true
  enable_performance_insights = true
  performance_insights_retention_period = 731  # 2 years
  auto_minor_version_upgrade  = false  # Manual upgrades in production
  apply_immediately           = false
  alarm_actions               = [module.monitoring.sns_alerts_topic_arn]
  tags                        = local.common_tags
}

module "elasticache" {
  source                     = "../../modules/elasticache"
  project_name               = var.project_name
  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_groups    = [module.eks.node_security_group_id]
  engine_version             = "7.0"
  node_type                  = "cache.r6g.xlarge"
  num_cache_nodes            = 3
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  snapshot_retention_limit   = 14
  auto_minor_version_upgrade = false  # Manual upgrades in production
  apply_immediately          = false
  alarm_actions              = [module.monitoring.sns_alerts_topic_arn]
  tags                       = local.common_tags
}

module "s3" {
  source                    = "../../modules/s3"
  project_name              = var.project_name
  environment               = local.environment
  versioning_enabled        = true
  enable_access_logging     = true
  lifecycle_glacier_days    = 90
  lifecycle_expiration_days = 730  # 2 years
  cors_allowed_origins      = ["https://servicedesk.example.com"]
  tags                      = local.common_tags
}

module "cloudfront" {
  source                             = "../../modules/cloudfront"
  project_name                       = var.project_name
  environment                        = local.environment
  static_bucket_id                   = module.s3.static_bucket_id
  static_bucket_arn                  = module.s3.static_bucket_arn
  static_bucket_regional_domain_name = module.s3.static_bucket_regional_domain_name
  price_class                        = "PriceClass_All"  # All edge locations
  domain_aliases                     = ["cdn.servicedesk.example.com"]
  # acm_certificate_arn              = "arn:aws:acm:us-east-1:ACCOUNT:certificate/ID"  # Add your cert
  alarm_actions                      = [module.monitoring.sns_alerts_topic_arn]
  tags                               = local.common_tags
}

module "route53" {
  source                         = "../../modules/route53"
  project_name                   = var.project_name
  environment                    = local.environment
  domain_name                    = "servicedesk.example.com"
  cloudfront_distribution_domain = module.cloudfront.distribution_domain_name
  cloudfront_hosted_zone_id      = module.cloudfront.distribution_hosted_zone_id
  enable_health_checks           = true
  health_check_path              = "/health"
  alarm_actions                  = [module.monitoring.sns_alerts_topic_arn]
  tags                           = local.common_tags
}

module "monitoring" {
  source                        = "../../modules/monitoring"
  project_name                  = var.project_name
  environment                   = local.environment
  alarm_email                   = "production-alerts@example.com"
  log_retention_days            = 90
  enable_cloudtrail             = true
  enable_guardduty              = true
  enable_cost_anomaly_detection = true
  tags                          = local.common_tags
}
