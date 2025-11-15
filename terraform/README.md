# Terraform Infrastructure for Japanese Learning Platform

GCP infrastructure management for Cloud SQL and Cloud Storage.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.0
- [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- GCP Project with billing enabled

## Setup

1. **Authenticate with GCP:**
   ```bash
   gcloud auth application-default login
   ```

2. **Configure variables:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your GCP project ID and bucket name
   ```

3. **Deploy:**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

## Resources Created

- **Cloud SQL:** PostgreSQL 16 database
- **Cloud Storage:** GCS bucket for file storage
- **Service Account:** Backend service account with storage permissions

## Outputs

After deployment, get your connection details:

```bash
terraform output gcp_db_connection_string
terraform output gcp_bucket_name
terraform output -raw gcp_service_account_key | base64 -d > ../backend/gcp-service-account-key.json
```

## Clean Up

```bash
terraform destroy
```

