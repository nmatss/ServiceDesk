# Terraform Backend Configuration
# Stores state in S3 with DynamoDB locking for safe concurrent operations

terraform {
  backend "s3" {
    bucket         = "servicedesk-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "servicedesk-terraform-locks"

    # Versioning must be enabled on the S3 bucket
    # DynamoDB table must have a primary key named 'LockID'
  }

  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Initialize backend resources (run once manually):
#
# 1. Create S3 bucket:
#    aws s3 mb s3://servicedesk-terraform-state --region us-east-1
#    aws s3api put-bucket-versioning --bucket servicedesk-terraform-state --versioning-configuration Status=Enabled
#    aws s3api put-bucket-encryption --bucket servicedesk-terraform-state --server-side-encryption-configuration '{
#      "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
#    }'
#
# 2. Create DynamoDB table:
#    aws dynamodb create-table \
#      --table-name servicedesk-terraform-locks \
#      --attribute-definitions AttributeName=LockID,AttributeType=S \
#      --key-schema AttributeName=LockID,KeyType=HASH \
#      --billing-mode PAY_PER_REQUEST \
#      --region us-east-1
