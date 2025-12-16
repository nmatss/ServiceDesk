# Terraform Outputs
# These values are displayed after successful deployment and can be referenced by other modules

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = module.vpc.database_subnet_ids
}

# EKS Outputs
output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint URL"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_node_group_id" {
  description = "EKS node group ID"
  value       = module.eks.node_group_id
}

output "eks_oidc_provider_arn" {
  description = "ARN of the OIDC Provider for EKS"
  value       = module.eks.oidc_provider_arn
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.endpoint
}

output "rds_reader_endpoint" {
  description = "RDS reader endpoint (for read replicas)"
  value       = module.rds.reader_endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.database_name
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.port
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = module.rds.security_group_id
}

# ElastiCache Outputs
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.endpoint
}

output "redis_configuration_endpoint" {
  description = "ElastiCache Redis configuration endpoint"
  value       = module.elasticache.configuration_endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.elasticache.port
}

output "redis_security_group_id" {
  description = "Security group ID for ElastiCache"
  value       = module.elasticache.security_group_id
}

# S3 Outputs
output "s3_uploads_bucket_id" {
  description = "ID of the uploads S3 bucket"
  value       = module.s3.uploads_bucket_id
}

output "s3_uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = module.s3.uploads_bucket_arn
}

output "s3_backups_bucket_id" {
  description = "ID of the backups S3 bucket"
  value       = module.s3.backups_bucket_id
}

output "s3_backups_bucket_arn" {
  description = "ARN of the backups S3 bucket"
  value       = module.s3.backups_bucket_arn
}

output "s3_static_bucket_id" {
  description = "ID of the static assets S3 bucket"
  value       = module.s3.static_bucket_id
}

output "s3_static_bucket_arn" {
  description = "ARN of the static assets S3 bucket"
  value       = module.s3.static_bucket_arn
}

output "s3_static_bucket_regional_domain_name" {
  description = "Regional domain name of the static assets bucket"
  value       = module.s3.static_bucket_regional_domain_name
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = module.cloudfront.distribution_arn
}

# Route53 Outputs
output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = module.route53.zone_id
}

output "route53_name_servers" {
  description = "Route53 hosted zone name servers"
  value       = module.route53.name_servers
}

# Monitoring Outputs
output "sns_alerts_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = module.monitoring.sns_alerts_topic_arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the main CloudWatch log group"
  value       = module.monitoring.log_group_name
}

# Connection Information (formatted for easy use)
output "connection_info" {
  description = "Formatted connection information for all services"
  value = {
    vpc = {
      id   = module.vpc.vpc_id
      cidr = module.vpc.vpc_cidr_block
    }
    kubernetes = {
      cluster_endpoint = module.eks.cluster_endpoint
      cluster_name     = module.eks.cluster_id
      kubectl_config   = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}"
    }
    database = {
      host     = module.rds.endpoint
      port     = module.rds.port
      database = module.rds.database_name
      username = var.rds_master_username
      connection_string = "postgresql://${var.rds_master_username}:PASSWORD@${module.rds.endpoint}/${module.rds.database_name}"
    }
    redis = {
      host = module.elasticache.endpoint
      port = module.elasticache.port
      connection_string = "redis://${module.elasticache.endpoint}:${module.elasticache.port}"
    }
    storage = {
      uploads_bucket = module.s3.uploads_bucket_id
      backups_bucket = module.s3.backups_bucket_id
      static_bucket  = module.s3.static_bucket_id
      cdn_domain     = module.cloudfront.distribution_domain_name
    }
    dns = {
      zone_id      = module.route53.zone_id
      name_servers = module.route53.name_servers
    }
  }
  sensitive = true
}

# Quick Start Commands
output "quick_start_commands" {
  description = "Quick start commands for connecting to infrastructure"
  value = <<-EOT
    # Configure kubectl for EKS
    aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}

    # Connect to RDS (requires password)
    psql -h ${module.rds.endpoint} -U ${var.rds_master_username} -d ${module.rds.database_name}

    # Connect to Redis
    redis-cli -h ${module.elasticache.endpoint} -p ${module.elasticache.port}

    # Upload to S3
    aws s3 cp file.txt s3://${module.s3.uploads_bucket_id}/

    # View CloudWatch logs
    aws logs tail ${module.monitoring.log_group_name} --follow
  EOT
}
