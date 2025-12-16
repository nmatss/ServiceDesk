# RDS Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where RDS will be deployed"
  type        = string
}

variable "database_subnet_ids" {
  description = "List of database subnet IDs"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "List of security group IDs allowed to access RDS"
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access RDS"
  type        = list(string)
  default     = []
}

# Database Configuration
variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "servicedesk"
}

variable "master_username" {
  description = "Master username for RDS"
  type        = string
  default     = "dbadmin"
  sensitive   = true
}

# Storage Configuration
variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage for auto-scaling in GB"
  type        = number
  default     = 500
}

variable "storage_type" {
  description = "Storage type (gp2, gp3, io1)"
  type        = string
  default     = "gp3"
}

variable "iops" {
  description = "IOPS for io1 storage type"
  type        = number
  default     = null
}

# High Availability
variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "publicly_accessible" {
  description = "Make RDS instance publicly accessible"
  type        = bool
  default     = false
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "delete_automated_backups" {
  description = "Delete automated backups immediately after DB deletion"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when deleting DB"
  type        = bool
  default     = false
}

# Monitoring Configuration
variable "enabled_cloudwatch_logs_exports" {
  description = "List of log types to enable for CloudWatch"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = true
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0, 1, 5, 10, 15, 30, 60)"
  type        = number
  default     = 60
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
}

# Parameter Group Settings
variable "log_statement" {
  description = "Log statement type (none, ddl, mod, all)"
  type        = string
  default     = "mod"
}

variable "log_min_duration_statement" {
  description = "Minimum duration in ms to log a statement (-1 to disable)"
  type        = string
  default     = "1000"
}

# Deletion Protection
variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "auto_minor_version_upgrade" {
  description = "Enable auto minor version upgrade"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Apply changes immediately (use with caution)"
  type        = bool
  default     = false
}

# Secrets Manager
variable "secret_recovery_window_days" {
  description = "Recovery window for secrets in days"
  type        = number
  default     = 7
}

# CloudWatch Alarms
variable "alarm_actions" {
  description = "List of ARNs to notify when alarm triggers"
  type        = list(string)
  default     = []
}

variable "max_connections_threshold" {
  description = "Maximum database connections threshold for alarm"
  type        = number
  default     = 80
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
