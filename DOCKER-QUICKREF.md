# Docker Quick Reference

A quick reference guide for common Docker commands for the Japanese Learning Platform.

## Initial Setup

```bash
# Copy and configure environment
cp docker.env.example .env
nano .env  # Edit PGPASSWORD and JWT_SECRET

# Build and start
docker-compose up -d

# Initialize database
./scripts/docker-init-db.sh
```

## Daily Usage

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f recognition_service
```

## Development Mode

```bash
# Start with hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Stop development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

## Maintenance

```bash
# Restart a service
docker-compose restart backend

# Rebuild a service
docker-compose build backend
docker-compose up -d backend

# Rebuild everything from scratch
docker-compose build --no-cache
docker-compose up -d

# View container status
docker-compose ps
```

## Database Operations

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U japanese_user -d japanese_learning

# Run Prisma commands
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma studio
docker-compose exec backend npx prisma generate

# Backup database
docker-compose exec postgres pg_dump -U japanese_user japanese_learning > backup.sql

# Restore database
docker-compose exec -T postgres psql -U japanese_user japanese_learning < backup.sql

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
./scripts/docker-init-db.sh
```

## Troubleshooting

```bash
# Check service health
docker-compose ps
curl http://localhost:3001/health
curl http://localhost:5000/health

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# View resource usage
docker stats

# Clean up everything (nuclear option)
docker-compose down -v
docker system prune -a
```

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |
| Recognition Service | 5000 | http://localhost:5000 |
| Vosk Server | 2700 | ws://localhost:2700 |
| PostgreSQL | 5432 | localhost:5432 |

## Environment Variables

Key variables in `.env`:

```bash
PGUSER=japanese_user
PGPASSWORD=your_password
PGDATABASE=japanese_learning
JWT_SECRET=your_secret_key
PORT=3001
```

## Service Dependencies

```
Frontend (3000)
    ↓ depends on
Backend (3001)
    ↓ depends on
├── PostgreSQL (5432)
├── Recognition Service (5000)
└── Vosk Server (2700)
```

## Docker Image Sizes

Approximate sizes after build:

- Backend: ~500MB (includes Node.js + dictionary files)
- Frontend: ~25MB (nginx + static assets)
- Recognition Service: ~300MB (Python + kanjidraw)
- PostgreSQL: ~230MB (official postgres:15-alpine)
- Vosk Server: ~1.5GB (includes speech models)

**Total:** ~2.5GB

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcrestart='docker-compose restart'
alias dcbackend='docker-compose exec backend sh'
alias dcdb='docker-compose exec postgres psql -U japanese_user -d japanese_learning'
```

## Common Issues

### "Port already in use"
```bash
# Change port in .env
PORT=3002

# Or stop conflicting service
lsof -ti:3001 | xargs kill
```

### "Database connection failed"
```bash
# Check postgres is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

### "Cannot find dictionary files"
```bash
# Rebuild backend (downloads dictionaries)
docker-compose build --no-cache backend
docker-compose up -d backend
```

### "Permission denied on uploads"
```bash
# Fix permissions
sudo chown -R $(whoami):$(whoami) backend/uploads
sudo chown -R $(whoami):$(whoami) backend/debug-audio
```

## More Information

See [DOCKER.md](./DOCKER.md) for complete documentation.

