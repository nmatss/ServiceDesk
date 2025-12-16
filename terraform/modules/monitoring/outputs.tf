output "sns_alerts_topic_arn" { value = aws_sns_topic.alerts.arn }
output "log_group_name" { value = aws_cloudwatch_log_group.application.name }
output "dashboard_name" { value = aws_cloudwatch_dashboard.main.dashboard_name }
output "cloudtrail_arn" { value = var.enable_cloudtrail ? aws_cloudtrail.main[0].arn : null }
output "guardduty_detector_id" { value = var.enable_guardduty ? aws_guardduty_detector.main[0].id : null }
