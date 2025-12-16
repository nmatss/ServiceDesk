variable "project_name" { type = string }
variable "environment" { type = string }
variable "alarm_email" { type = string; default = null }
variable "log_retention_days" { type = number; default = 30 }
variable "enable_cloudtrail" { type = bool; default = true }
variable "enable_guardduty" { type = bool; default = true }
variable "enable_cost_anomaly_detection" { type = bool; default = true }
variable "tags" { type = map(string); default = {} }
