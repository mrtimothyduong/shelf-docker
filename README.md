# shelf-docker
A clean, minimal Docker deployment package for Shelf originally by @barrowclift. This directory contains only the essential files needed to run the application.

## Quick Start

1. **Copy environment file:**
   ```bash
   mkdir ./shelf && cd ./shelf && git https://github.com/mrtimothyduong/shelf-docker
   ```

2. **Configure your environment:**
   Copy the .env example to a new .env file: `cp .env.example .env`
   Edit `.env` with your API keys and settings:
   - `DISCOGS_USER_TOKEN` - Your Discogs API token
   - `DISCOGS_USER_ID` - Your Discogs user ID
   - `BOARDGAMEGEEK_USER_ID` - Your BGG username (optional)
   - Database credentials (will be auto-generated if not set)

4. **Start the application:**
   ```bash
   docker-compose up -d
   ```

5. **Access your Shelf:**
   Open http://localhost:3008 in your browser

## File Structure

```
shelf-docker-v1.0/
├── docker-compose.yml     # Container orchestration
├── Dockerfile            # Application container definition
├── package.json          # Node.js dependencies
├── package-lock.json     # Dependency lockfile
├── .env.example          # Environment template
├── .dockerignore         # Docker build exclusions
├── src/                  # Application source code
│   ├── app.js           # Main application entry
│   ├── config/          # Configuration management
│   ├── database/        # Database connection & migrations
│   ├── middleware/      # Security & validation middleware
│   ├── routes/          # API & page routes
│   ├── services/        # Core business logic
│   └── common/          # Shared utilities
├── views/               # Liquid templates
├── public/              # Static assets (CSS, JS, images)
└── scripts/             # Maintenance utilities
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Application port | 3008 |
| `NODE_ENV` | Environment mode | production |
| `DISCOGS_USER_TOKEN` | **Required** - Discogs API token | - |
| `DISCOGS_USER_ID` | **Required** - Your Discogs user ID | - |
| `BOARDGAMEGEEK_USER_ID` | BGG username for board games | - |
| `SITE_TITLE` | Your shelf title | "Shelf" |
| `LOG_LEVEL` | Logging verbosity | info |


## Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f shelf

# Stop services
docker-compose down

# Update application (rebuild)
docker-compose up --build -d

# Database migration (if needed)
docker-compose exec shelf npm run db:migrate

# Clean image cache
docker-compose exec shelf npm run clean:images
```

## Data Persistence

- PostgreSQL data: `postgres_data` volume
- Image cache: `image_cache` volume

Both volumes persist data across container restarts.

## Support

For issues or questions, check the application logs and raise a github issue.
```bash
docker-compose logs shelf
```

---
**Version**: 1.0  
**Base**: Shelf v3.2.4 with PostgreSQL
