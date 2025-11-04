# Docker Deployment Guide

This guide explains how to run the Japanese Learning Platform using Docker and Docker Compose.

## Prerequisites

- **Docker** 20.10 or higher
- **Docker Compose** v2.0 or higher
- At least 4GB of free RAM
- At least 10GB of free disk space (for images, dictionary files, and database)

## Quick Start

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp docker.env.example .env
```

Edit `.env` and set your values:
- **PGPASSWORD**: Choose a strong password for PostgreSQL
- **JWT_SECRET**: Choose a strong secret key for JWT authentication

### 2. Build and Start Services

```bash
# Build all services
docker-compose build

# Start all services in detached mode
docker-compose up -d
```

This will start:
- **PostgreSQL** database on port 5432
- **Backend API** on port 3001
- **Frontend** on port 3000
- **Recognition Service** on port 5000
- **Vosk Server** on port 2700

### 3. Initialize Database

The database schema needs to be created and populated with dictionary data. You can use the automated script or run the steps manually:

**Option A: Automated Setup (Recommended)**

```bash
# Run the initialization script
./scripts/docker-init-db.sh
```

This script will:
- Apply Prisma migrations to create the database schema
- Install Python dependencies if needed
- Load kanji data from kanjidic2.xml
- Load dictionary data from JMdict_e
- Create a local user for development

**Option B: Manual Setup**

```bash
# Apply Prisma migrations to create database schema
docker-compose exec backend npx prisma migrate deploy

# Install Python dependencies on your host machine
pip install -r requirements.txt

# Setup kanji data
python scripts/setup_db.py

# Setup dictionary data
python scripts/setup_jmdict.py

# Create a local user
python scripts/setup_local.py
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health
- **Recognition Service**: http://localhost:5000/health

## Docker Services

### Service: postgres
- **Image**: postgres:15-alpine
- **Port**: 5432
- **Volume**: `postgres_data` (persistent database storage)
- **Health Check**: Built-in pg_isready check

### Service: backend
- **Build Context**: Root directory with backend context
- **Port**: 3001
- **Volumes**:
  - `./backend/uploads` - User audio recordings
  - `./backend/debug-audio` - Debug audio files
  - `./kanjidic2.xml` - Kanji dictionary (downloaded at build time)
  - `./JMdict_e` - Japanese-English dictionary (downloaded at build time)
- **Dependencies**: postgres, recognition_service, vosk-server

### Service: frontend
- **Build Context**: frontend directory
- **Port**: 3000 (nginx serving on port 80)
- **Base Image**: node:18-alpine (build), nginx:alpine (runtime)
- **Features**: Optimized production build with gzip compression

### Service: recognition_service
- **Build Context**: recognition_service directory
- **Port**: 5000
- **Technology**: Python Flask with KanjiDraw
- **Health Check**: HTTP GET to /health endpoint

### Service: vosk-server
- **Image**: alphacep/kaldi-en:latest
- **Port**: 2700
- **Purpose**: Speech recognition via WebSocket

## Dictionary Files

The backend Dockerfile automatically downloads the required dictionary files at build time:

- **kanjidic2.xml** - Downloaded from https://www.edrdg.org/kanjidic/kanjidic2.xml.gz
- **JMdict_e** - Downloaded from http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz

These files are approximately:
- kanjidic2.xml: ~14MB (compressed: ~1.4MB)
- JMdict_e: ~135MB (compressed: ~10MB)

Total download during build: ~12MB
Total uncompressed: ~150MB

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f recognition_service
docker-compose logs -f vosk-server
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database!)
docker-compose down -v
```

### Rebuild Services

```bash
# Rebuild all services
docker-compose build --no-cache

# Rebuild specific service
docker-compose build --no-cache backend

# Rebuild and restart
docker-compose up -d --build
```

### Execute Commands in Containers

```bash
# Access backend shell
docker-compose exec backend sh

# Access database shell
docker-compose exec postgres psql -U japanese_user -d japanese_learning

# Run Prisma commands
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma studio
```

## Database Management

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U japanese_user japanese_learning > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U japanese_user japanese_learning < backup.sql
```

### Reset Database

```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d postgres
docker-compose exec backend npx prisma migrate deploy

# Then re-run the setup scripts from your host
python scripts/setup_db.py
python scripts/setup_jmdict.py
python scripts/setup_local.py
```

## Troubleshooting

### Backend Can't Connect to Database

Check that postgres is healthy:
```bash
docker-compose ps
docker-compose logs postgres
```

Verify DATABASE_URL in `.env` file is correct.

### Frontend Shows API Connection Error

1. Check backend is running: `docker-compose logs backend`
2. Verify backend health: `curl http://localhost:3001/health`
3. Check CORS configuration in backend

### Recognition Service Fails

```bash
# Check service status
docker-compose logs recognition_service

# Test the endpoint
curl http://localhost:5000/health
```

### Dictionary Files Not Found

The dictionary files are downloaded during the Docker build process. If you see errors:

```bash
# Rebuild the backend with fresh downloads
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Port Conflicts

If ports 3000, 3001, 5000, 5432, or 2700 are already in use, you can change them in `.env`:

```bash
# Example: Change backend port
PORT=3002

# Rebuild and restart
docker-compose up -d
```

## Production Considerations

### Security

1. **Change default passwords**: Update `PGPASSWORD` and `JWT_SECRET` in `.env`
2. **Use secrets management**: Consider Docker Swarm secrets or Kubernetes secrets
3. **Enable HTTPS**: Use a reverse proxy like nginx or Traefik with SSL certificates
4. **Restrict database access**: Don't expose PostgreSQL port externally

### Performance

1. **Resource Limits**: Add resource constraints in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

2. **Optimize Images**: The Dockerfiles use multi-stage builds for smaller images

3. **Database Tuning**: Adjust PostgreSQL settings in docker-compose.yml:
   ```yaml
   command:
     - "postgres"
     - "-c"
     - "shared_buffers=256MB"
     - "-c"
     - "max_connections=200"
   ```

### Backups

Set up automated database backups:
```bash
# Add to crontab
0 2 * * * docker-compose -f /path/to/docker-compose.yml exec postgres pg_dump -U japanese_user japanese_learning | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
```

## Network Architecture

All services communicate through a Docker bridge network called `japanese-learning-network`:

```
[Frontend :3000] ─────┐
                      │
[Backend :3001] ──────┼──> [Network Bridge]
                      │
[Recognition :5000] ──┤
                      │
[Vosk Server :2700] ──┤
                      │
[PostgreSQL :5432] ───┘
```

Internal DNS resolution allows services to communicate using service names (e.g., `postgres`, `backend`, `recognition_service`).

## Development with Docker

For development with hot-reload enabled, use the development compose file:

```bash
# Start in development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

The development setup includes:
- **Hot reload** for backend (nodemon) and frontend (React dev server)
- **Source code mounting** so changes reflect immediately
- **Debug mode** enabled for recognition service
- **Separate node_modules** volumes to prevent conflicts

Development Dockerfiles are located at:
- `backend/Dockerfile.dev`
- `frontend/Dockerfile.dev`

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Nginx Docker Image](https://hub.docker.com/_/nginx)
- [Vosk Speech Recognition](https://alphacephei.com/vosk/)

## Support

For issues specific to:
- **Docker setup**: Check this document and Docker logs
- **Application features**: See main [README.md](./README.md)
- **Database schema**: See [backend/prisma/schema.prisma](./backend/prisma/schema.prisma)

