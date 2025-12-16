output "zone_id" { value = var.create_hosted_zone ? aws_route53_zone.main[0].zone_id : null }
output "name_servers" { value = var.create_hosted_zone ? aws_route53_zone.main[0].name_servers : [] }
output "zone_arn" { value = var.create_hosted_zone ? aws_route53_zone.main[0].arn : null }
