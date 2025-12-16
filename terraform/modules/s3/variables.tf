variable "project_name" { type = string }
variable "environment" { type = string }
variable "versioning_enabled" { type = bool; default = true }
variable "lifecycle_glacier_days" { type = number; default = 90 }
variable "lifecycle_expiration_days" { type = number; default = 365 }
variable "enable_access_logging" { type = bool; default = true }
variable "cors_allowed_origins" { type = list(string); default = ["*"] }
variable "tags" { type = map(string); default = {} }
