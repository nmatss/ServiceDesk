variable "project_name" { type = string }
variable "environment" { type = string }
variable "domain_name" { type = string }
variable "create_hosted_zone" { type = bool; default = true }
variable "cloudfront_distribution_domain" { type = string; default = null }
variable "cloudfront_hosted_zone_id" { type = string; default = null }
variable "enable_health_checks" { type = bool; default = true }
variable "health_check_path" { type = string; default = "/" }
variable "alarm_actions" { type = list(string); default = [] }
variable "tags" { type = map(string); default = {} }
