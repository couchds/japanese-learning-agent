variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "japanese-learning"
}

variable "db_username" {
  description = "Database username"
  type        = string
  sensitive   = true
  default     = "postgres"
}

variable "db_name" {
  description = "Name of the default database to create"
  type        = string
  default     = "japanese_learning"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection (recommended for prod)"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "gcp_project_id" {
  description = "GCP Project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_bucket_name" {
  description = "GCS bucket name (must be globally unique)"
  type        = string
  default     = ""
}

variable "gcp_db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-g1-small"
}

variable "gcp_db_password" {
  description = "Cloud SQL password (leave empty to auto-generate)"
  type        = string
  sensitive   = true
  default     = ""
}

