# S3 Module - Multi-Bucket Storage with Lifecycle Policies

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# Uploads Bucket
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.name_prefix}-uploads"
  tags = merge(var.tags, { Name = "${local.name_prefix}-uploads", Purpose = "User uploads and attachments" })
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "transition-to-intelligent-tiering"
    status = "Enabled"
    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    max_age_seconds = 3000
  }
}

# Backups Bucket
resource "aws_s3_bucket" "backups" {
  bucket = "${local.name_prefix}-backups"
  tags = merge(var.tags, { Name = "${local.name_prefix}-backups", Purpose = "Database and application backups" })
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "transition-and-expire"
    status = "Enabled"
    transition {
      days          = var.lifecycle_glacier_days
      storage_class = "GLACIER"
    }
    expiration {
      days = var.lifecycle_expiration_days
    }
  }
}

# Static Assets Bucket
resource "aws_s3_bucket" "static" {
  bucket = "${local.name_prefix}-static"
  tags = merge(var.tags, { Name = "${local.name_prefix}-static", Purpose = "Static website assets" })
}

resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "static" {
  bucket = aws_s3_bucket.static.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    max_age_seconds = 3000
  }
}

# KMS Key for S3 Encryption
resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption - ${local.name_prefix}"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  tags = merge(var.tags, { Name = "${local.name_prefix}-s3-kms" })
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.name_prefix}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# Logging Bucket
resource "aws_s3_bucket" "logs" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = "${local.name_prefix}-logs"
  tags = merge(var.tags, { Name = "${local.name_prefix}-logs", Purpose = "S3 access logs" })
}

resource "aws_s3_bucket_public_access_block" "logs" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id
  rule {
    id     = "expire-old-logs"
    status = "Enabled"
    expiration {
      days = 90
    }
  }
}

# Enable logging for main buckets
resource "aws_s3_bucket_logging" "uploads" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.uploads.id
  target_bucket = aws_s3_bucket.logs[0].id
  target_prefix = "uploads/"
}

resource "aws_s3_bucket_logging" "backups" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.backups.id
  target_bucket = aws_s3_bucket.logs[0].id
  target_prefix = "backups/"
}

resource "aws_s3_bucket_logging" "static" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.static.id
  target_bucket = aws_s3_bucket.logs[0].id
  target_prefix = "static/"
}
