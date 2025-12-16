output "vpc_id" { value = module.vpc.vpc_id }
output "eks_cluster_endpoint" { value = module.eks.cluster_endpoint }
output "rds_endpoint" { value = module.rds.endpoint }
output "redis_endpoint" { value = module.elasticache.endpoint }
output "cdn_domain" { value = module.cloudfront.distribution_domain_name }
output "domain_name_servers" { value = module.route53.name_servers }
output "kubectl_config_command" { value = module.eks.kubeconfig_command }
