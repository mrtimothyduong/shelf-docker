# shelf-docker
A clean, minimal Docker deployment package for Shelf originally by @[barrowclift](https://barrowclift.me/).
This directory contains only the essential files needed to run the application.
Original Shelf (v 3.2.4 with mongoDB backend) can be found here: https://github.com/barrowclift/shelf
**Demo:** https://shelf.timothyduong.me/

Note: This deployment has been vibe-coded and the backend is now PostgreSQL.

<img width="1053" height="762" alt="image" src="https://github.com/user-attachments/assets/e1121347-3cbd-4832-bed2-c97a65e1e3bf" />

## Quick Start
**Pre-requisites:** git, docker, docker-compose should be installed prior to installation.

1. **Clone this repository:**
   ```bash
   git clone https://github.com/mrtimothyduong/shelf-docker && cd ./shelf-docker
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

## Data Persistence

- PostgreSQL data: `postgres_data` volume
- Image cache: `image_cache` volume
Both volumes persist data across container restarts.

## Support

For issues or questions, check the application logs and raise a github issue.
```bash
docker-compose logs shelf
```
**Reverse Proxy**
Tested with NGINX Proxy Manager, works without socket-support, but you can enable it if you want.

**CloudFlare Tunnels**
If you'd like to publish this, deploy a cloudflared tunnel, and proxy to ip:3008 or whatever port you've selected. Example: [https://shelf.timothyduong.me](https://shelf.timothyduong.me)

---
**Version**: 1.0  
**Base**: Shelf v3.2.4 with PostgreSQL
