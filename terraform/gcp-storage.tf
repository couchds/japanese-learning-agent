resource "google_storage_bucket" "resources" {
  count         = var.gcp_project_id != "" && var.gcp_bucket_name != "" ? 1 : 0
  name          = var.gcp_bucket_name
  location      = var.gcp_region
  storage_class = "STANDARD"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age            = 90
      matches_prefix = ["pronunciations/"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }
  
  cors {
    origin          = ["http://localhost:3000", "http://localhost:3001"]
    method          = ["GET", "POST", "PUT", "DELETE"]
    response_header = ["Content-Type", "ETag"]
    max_age_seconds = 3600
  }
  
  depends_on = [google_project_service.storage[0]]
  
  labels = {
    environment = var.environment
    managed_by  = "terraform"
    project     = "japanese-learning-platform"
  }
}

resource "google_service_account" "backend" {
  count        = var.gcp_project_id != "" ? 1 : 0
  account_id   = "${var.project_name}-backend-${var.environment}"
  display_name = "Japanese Learning Backend Service Account"
  description  = "Service account for backend to access GCS"
}

resource "google_storage_bucket_iam_member" "backend_admin" {
  count  = var.gcp_project_id != "" && var.gcp_bucket_name != "" ? 1 : 0
  bucket = google_storage_bucket.resources[0].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend[0].email}"
}

resource "google_service_account_key" "backend_key" {
  count              = var.gcp_project_id != "" ? 1 : 0
  service_account_id = google_service_account.backend[0].name
}

