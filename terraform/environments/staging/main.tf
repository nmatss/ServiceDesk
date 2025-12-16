# Staging Environment - Production-like configuration with medium resources

terraform {
  backend "s3" {
    bucket         = "servicedesk-terraform-state"
    key            = "staging/terraform.tfstate"
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
  environment = "staging"
  common_tags = {
    Project     = var.project_name
    Environment = local.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }
}

module "vpc" {
  source             = "../../modules/vpc"
  project_name       = var.project_name
  environment        = local.environment
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway = true
  single_nat_gateway = false  # NAT per AZ
  tags               = local.common_tags
}

module "eks" {
  source              = "../../modules/eks"
  project_name        = var.project_name
  environment         = local.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  private_subnet_ids  = module.vpc.private_subnet_ids
  cluster_version     = "1.28"
  node_instance_types = ["t3.medium"]
  node_desired_size   = 3
  node_min_size       = 2
  node_max_size       = 6
  tags                = local.common_tags
}

module "rds" {
  source                      = "../../modules/rds"
  project_name                = var.project_name
  environment                 = local.environment
  vpc_id                      = module.vpc.vpc_id
  database_subnet_ids         = module.vpc.database_subnet_ids
  allowed_security_groups     = [module.eks.node_security_group_id]
  instance_class              = "db.t3.medium"
  allocated_storage           = 100
  max_allocated_storage       = 300
  multi_az                    = true
  backup_retention_period     = 14
  enable_performance_insights = true
  deletion_protection         = true
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
  node_type                  = "cache.t3.medium"
  num_cache_nodes            = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  snapshot_retention_limit   = 5
  alarm_actions              = [module.monitoring.sns_alerts_topic_arn]
  tags                       = local.common_tags
}

module "s3" {
  source             = "../../modules/s3"
  project_name       = var.project_name
  environment        = local.environment
  versioning_enabled = true
  tags               = local.common_tags
}

module "cloudfront" {
  source                             = "../../modules/cloudfront"
  project_name                       = var.project_name
  environment                        = local.environment
  static_bucket_id                   = module.s3.static_bucket_id
  static_bucket_arn                  = module.s3.static_bucket_arn
  static_bucket_regional_domain_name = module.s3.static_bucket_regional_domain_name
  price_class                        = "PriceClass_200"
  alarm_actions                      = [module.monitoring.sns_alerts_topic_arn]
  tags                               = local.common_tags
}

module "route53" {
  source                        = "../../modules/route53"
  project_name                  = var.project_name
  environment                   = local.environment
  domain_name                   = "staging.servicedesk.example.com"
  cloudfront_distribution_domain = module.cloudfront.distribution_domain_name
  cloudfront_hosted_zone_id     = module.cloudfront.distribution_hosted_zone_id
  alarm_actions                 = [module.monitoring.sns_alerts_topic_arn]
  tags                          = local.common_tags
}

module "monitoring" {
  source                        = "../../modules/monitoring"
  project_name                  = var.project_name
  environment                   = local.environment
  alarm_email                   = "ops@example.com"
  log_retention_days            = 30
  enable_cloudtrail             = true
  enable_guardduty              = true
  enable_cost_anomaly_detection = false
  tags                          = local.common_tags
}
