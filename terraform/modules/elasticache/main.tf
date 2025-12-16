# ElastiCache Module - Redis Cluster with Multi-AZ and Auto-Failover

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-redis-subnet-group"
    }
  )
}

# Security Group for ElastiCache
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "Redis access from allowed security groups"
  }

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "Redis access from allowed CIDR blocks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-redis-sg"
    }
  )
}

# Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  name   = "${local.name_prefix}-redis-params"
  family = "redis${split(".", var.engine_version)[0]}"

  # Performance parameters
  parameter {
    name  = "maxmemory-policy"
    value = var.maxmemory_policy
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = var.tags
}

# KMS Key for Redis Encryption
resource "aws_kms_key" "redis" {
  count = var.at_rest_encryption_enabled ? 1 : 0

  description             = "KMS key for Redis cluster ${local.name_prefix} encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-redis-kms"
    }
  )
}

resource "aws_kms_alias" "redis" {
  count = var.at_rest_encryption_enabled ? 1 : 0

  name          = "alias/${local.name_prefix}-redis"
  target_key_id = aws_kms_key.redis[0].key_id
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name_prefix}-redis"
  replication_group_description = "Redis cluster for ${local.name_prefix}"
  engine                     = "redis"
  engine_version             = var.engine_version
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_nodes
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]

  # High Availability
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled

  # Encryption
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token_enabled         = var.transit_encryption_enabled ? true : false
  auth_token                 = var.transit_encryption_enabled ? random_password.auth_token[0].result : null
  kms_key_id                 = var.at_rest_encryption_enabled ? aws_kms_key.redis[0].arn : null

  # Backups
  snapshot_retention_limit   = var.snapshot_retention_limit
  snapshot_window            = var.snapshot_window
  maintenance_window         = var.maintenance_window
  final_snapshot_identifier  = var.create_final_snapshot ? "${local.name_prefix}-redis-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  # Notifications
  notification_topic_arn = var.notification_topic_arn

  # Auto minor version upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  # Apply changes immediately (use with caution)
  apply_immediately = var.apply_immediately

  # Logs
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-redis"
    }
  )

  lifecycle {
    ignore_changes = [
      auth_token,
      final_snapshot_identifier
    ]
  }
}

# Generate auth token for transit encryption
resource "random_password" "auth_token" {
  count = var.transit_encryption_enabled ? 1 : 0

  length  = 32
  special = true
}

# Store auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  count = var.transit_encryption_enabled ? 1 : 0

  name                    = "${local.name_prefix}-redis-auth-token"
  description             = "Auth token for Redis cluster ${local.name_prefix}"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  count = var.transit_encryption_enabled ? 1 : 0

  secret_id = aws_secretsmanager_secret.redis_auth_token[0].id
  secret_string = jsonencode({
    auth_token = random_password.auth_token[0].result
    endpoint   = aws_elasticache_replication_group.main.configuration_endpoint_address
    port       = 6379
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${local.name_prefix}/slow-log"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/${local.name_prefix}/engine-log"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cache_cpu" {
  alarm_name          = "${local.name_prefix}-redis-cpu-utilization"
  alarm_description   = "Redis CPU utilization is too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cache_memory" {
  alarm_name          = "${local.name_prefix}-redis-memory-usage"
  alarm_description   = "Redis memory usage is too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cache_evictions" {
  alarm_name          = "${local.name_prefix}-redis-evictions"
  alarm_description   = "Redis evictions are too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1000"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = var.tags
}
