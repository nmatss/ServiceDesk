variable "project_name" { type = string }
variable "environment" { type = string }
variable "static_bucket_id" { type = string }
variable "static_bucket_arn" { type = string }
variable "static_bucket_regional_domain_name" { type = string }
variable "price_class" { type = string; default = "PriceClass_100" }
variable "min_ttl" { type = number; default = 0 }
variable "default_ttl" { type = number; default = 3600 }
variable "max_ttl" { type = number; default = 86400 }
variable "domain_aliases" { type = list(string); default = [] }
variable "acm_certificate_arn" { type = string; default = null }
variable "geo_restriction_type" { type = string; default = "none" }
variable "geo_restriction_locations" { type = list(string); default = [] }
variable "alarm_actions" { type = list(string); default = [] }
variable "tags" { type = map(string); default = {} }
