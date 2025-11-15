provider "google" {
  project = var.gcp_project_id != "" ? var.gcp_project_id : null
  region  = var.gcp_region
}

resource "google_project_service" "sqladmin" {
  count   = var.gcp_project_id != "" ? 1 : 0
  project = var.gcp_project_id
  service = "sqladmin.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "compute" {
  count   = var.gcp_project_id != "" ? 1 : 0
  project = var.gcp_project_id
  service = "compute.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  count   = var.gcp_project_id != "" ? 1 : 0
  project = var.gcp_project_id
  service = "storage.googleapis.com"
  
  disable_on_destroy = false
}

