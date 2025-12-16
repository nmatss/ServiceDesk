# Route53 Module - DNS Management

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# Hosted Zone
resource "aws_route53_zone" "main" {
  count = var.create_hosted_zone ? 1 : 0
  name  = var.domain_name
  tags  = merge(var.tags, { Name = "${local.name_prefix}-zone" })
}

# A Record for CloudFront Distribution
resource "aws_route53_record" "cloudfront" {
  count   = var.cloudfront_distribution_domain != null && var.create_hosted_zone ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.cloudfront_distribution_domain
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# CNAME Record for www subdomain
resource "aws_route53_record" "www" {
  count   = var.cloudfront_distribution_domain != null && var.create_hosted_zone ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.cloudfront_distribution_domain]
}

# Health Check for main domain
resource "aws_route53_health_check" "main" {
  count             = var.enable_health_checks && var.create_hosted_zone ? 1 : 0
  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true

  tags = merge(var.tags, { Name = "${local.name_prefix}-health-check" })
}

# CloudWatch Alarm for Health Check
resource "aws_cloudwatch_metric_alarm" "health_check" {
  count               = var.enable_health_checks && var.create_hosted_zone ? 1 : 0
  alarm_name          = "${local.name_prefix}-route53-health-check"
  alarm_description   = "Route53 health check failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"

  dimensions = {
    HealthCheckId = aws_route53_health_check.main[0].id
  }

  alarm_actions = var.alarm_actions
  tags          = var.tags
}
