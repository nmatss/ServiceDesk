# ElastiCache Module Outputs

output "replication_group_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "endpoint" {
  description = "Primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "configuration_endpoint" {
  description = "Configuration endpoint address (for cluster mode)"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
}

output "reader_endpoint" {
  description = "Reader endpoint address"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "security_group_id" {
  description = "Security group ID for ElastiCache"
  value       = aws_security_group.redis.id
}

output "kms_key_id" {
  description = "KMS key ID for Redis encryption"
  value       = var.at_rest_encryption_enabled ? aws_kms_key.redis[0].id : null
}

output "kms_key_arn" {
  description = "KMS key ARN for Redis encryption"
  value       = var.at_rest_encryption_enabled ? aws_kms_key.redis[0].arn : null
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis auth token"
  value       = var.transit_encryption_enabled ? aws_secretsmanager_secret.redis_auth_token[0].arn : null
}

output "secret_name" {
  description = "Name of the Secrets Manager secret containing Redis auth token"
  value       = var.transit_encryption_enabled ? aws_secretsmanager_secret.redis_auth_token[0].name : null
}

output "connection_string" {
  description = "Redis connection string"
  value       = var.transit_encryption_enabled ? "rediss://:AUTH_TOKEN@${aws_elasticache_replication_group.main.configuration_endpoint_address}:6379" : "redis://${aws_elasticache_replication_group.main.configuration_endpoint_address}:6379"
  sensitive   = true
}
