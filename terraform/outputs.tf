output "gcp_db_instance_name" {
  description = "Cloud SQL instance name"
  value       = length(google_sql_database_instance.postgres) > 0 ? google_sql_database_instance.postgres[0].name : null
}

output "gcp_db_connection_name" {
  description = "Cloud SQL connection name (for Cloud SQL Proxy)"
  value       = length(google_sql_database_instance.postgres) > 0 ? google_sql_database_instance.postgres[0].connection_name : null
}

output "gcp_db_public_ip" {
  description = "Cloud SQL public IP address"
  value       = length(google_sql_database_instance.postgres) > 0 ? google_sql_database_instance.postgres[0].public_ip_address : null
}

output "gcp_db_connection_string" {
  description = "PostgreSQL connection string for Cloud SQL"
  value       = length(google_sql_database_instance.postgres) > 0 ? "postgresql://${var.db_username}:${google_sql_user.user[0].password}@${google_sql_database_instance.postgres[0].public_ip_address}:5432/${var.db_name}?sslmode=require" : null
  sensitive   = true
}

output "gcp_bucket_name" {
  description = "GCS bucket name"
  value       = length(google_storage_bucket.resources) > 0 ? google_storage_bucket.resources[0].name : null
}

output "gcp_bucket_url" {
  description = "GCS bucket URL"
  value       = length(google_storage_bucket.resources) > 0 ? google_storage_bucket.resources[0].url : null
}

output "gcp_service_account_email" {
  description = "Service account email for backend"
  value       = length(google_service_account.backend) > 0 ? google_service_account.backend[0].email : null
}

output "gcp_service_account_key" {
  description = "Service account key (base64 encoded JSON)"
  value       = length(google_service_account_key.backend_key) > 0 ? google_service_account_key.backend_key[0].private_key : null
  sensitive   = true
}

output "backend_env_vars" {
  description = "Environment variables for backend .env file"
  value = length(google_sql_database_instance.postgres) > 0 ? format(
    "DATABASE_URL=\"postgresql://%s:%s@%s:5432/%s?sslmode=require\"\nGCP_PROJECT_ID=%s\nGOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account-key.json\nGCP_BUCKET=%s\nSTORAGE_TYPE=gcs\nNODE_ENV=%s",
    var.db_username,
    google_sql_user.user[0].password,
    google_sql_database_instance.postgres[0].public_ip_address,
    var.db_name,
    var.gcp_project_id,
    google_storage_bucket.resources[0].name,
    var.environment
  ) : "GCP resources not created"
  sensitive = true
}
