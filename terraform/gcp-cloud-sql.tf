resource "random_password" "gcp_db_password" {
  count            = var.gcp_project_id != "" ? 1 : 0
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_database_instance" "postgres" {
  count               = var.gcp_project_id != "" ? 1 : 0
  name                = "${var.project_name}-${var.environment}"
  database_version    = "POSTGRES_16"
  region              = var.gcp_region
  deletion_protection = var.enable_deletion_protection

  settings {
    tier              = var.gcp_db_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.db_allocated_storage
    disk_autoresize   = true
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }
    
    ip_configuration {
      ipv4_enabled = true
      require_ssl  = true
      authorized_networks {
        name  = "allow-all-temp"
        value = "0.0.0.0/0"
      }
    }
    
    maintenance_window {
      day  = 1
      hour = 4
    }
  }

  depends_on = [google_project_service.sqladmin[0]]
}

resource "google_sql_database" "database" {
  count    = var.gcp_project_id != "" ? 1 : 0
  name     = var.db_name
  instance = google_sql_database_instance.postgres[0].name
}

resource "google_sql_user" "user" {
  count    = var.gcp_project_id != "" ? 1 : 0
  name     = var.db_username
  instance = google_sql_database_instance.postgres[0].name
  password = var.gcp_db_password != "" ? var.gcp_db_password : random_password.gcp_db_password[0].result
}

