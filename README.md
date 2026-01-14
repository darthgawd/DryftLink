# DryftLink

> Website observability platform that detects meaningful changes and links them to real-world impact

![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Overview

**DryftLink detects meaningful changes on websites and links them to real-world impact, so you know what changed and why it mattered.**

Most monitoring tools tell you *if* something happened. DryftLink tells you **what changed**, **when it changed**, and **why it mattered** — turning alerts into answers and monitoring into decision support.

**Current Status:** Phase 1 (Uptime & Availability) - Core backend complete
- JWT authentication & user management
- Site CRUD operations
- Async uptime checks with background workers
- PostgreSQL + Prisma ORM with uptime state models
- Production-ready infrastructure (Docker, rate limiting, security)

**Coming Next:** Scheduled checks → Change detection → Impact correlation → AI summaries

## Architecture

```
Client → API (Fastify) → PostgreSQL
           ↓
        Redis (BullMQ)
           ↓
        Worker → PostgreSQL
          ↓
    (Future: Change detection, impact correlation, AI summaries)
```

**Stack:** Node.js 20 · TypeScript · Fastify · Prisma · PostgreSQL 16 · Redis 7 · BullMQ · Docker

**Design Philosophy:** Logic-heavy, not infra-heavy. Predictable costs. No metric overload. Built for teams without enterprise budgets.

## Prerequisites

- Docker & Docker Compose (v2.0+)
- pnpm (v8.0+)
- Node.js 20+

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/dryft.git
cd dryft
pnpm install

# Set up environment
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
# Edit .env files with your values

# Start services
cd infra
docker compose up -d

# Run migrations
docker compose exec api pnpm prisma migrate dev

# Test
curl http://localhost:3002/health
```

## Environment Variables

**Infra** (`infra/.env`): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`

**API** (`apps/api/.env`): `DATABASE_URL`*, `REDIS_URL`*, `JWT_SECRET`* (min 32 chars), `API_PORT`, `ALLOWED_ORIGINS`

**Worker** (`apps/worker/.env`): `DATABASE_URL`*, `REDIS_URL`*, `WORKER_CONCURRENCY` (1-10)

*Required. See `.env.example` files for full details and examples.

## API Endpoints

**Base URL:** `http://localhost:3002`  
**Auth:** 🔒 = Requires `Authorization: Bearer <token>` header

### Health
- `GET /health` - API health check

### Authentication
- `POST /auth/register` - Create account (limit: 5/min)
  - Body: `{ email, password }`
  - Returns: `{ token, user: { id, email } }`
  
- `POST /auth/login` - Login (limit: 10/min)
  - Body: `{ email, password }`
  - Returns: `{ token, user: { id, email } }`

### Sites 🔒
- `GET /sites` - List all user sites
- `POST /sites` - Create site
  - Body: `{ name, url }`
- `GET /sites/:id` - Get site details
- `PATCH /sites/:id` - Update site
  - Body: `{ name?, url? }`
- `DELETE /sites/:id` - Delete site

### Checks 🔒
- `POST /sites/:id/check` - Trigger async uptime check (limit: 30/min)
  - Returns: `{ jobId, message: "check_enqueued" }`

## Development

### Common Commands

```bash
# Services
docker compose up -d              # Start
docker compose logs -f api        # View logs
docker compose down               # Stop

# After schema changes
docker compose exec api pnpm prisma migrate dev --name <name>
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate
pnpm prisma generate --schema=apps/api/prisma/schema.prisma
# Then restart TypeScript server in IDE

# Type check
pnpm tsc --noEmit

# Database access
docker compose exec postgres psql -U dryft -d dryft
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Services won't start | Check `docker compose ps` and logs. Verify `.env` files exist |
| "Property X does not exist on PrismaClient" | Run `npx prisma generate` in both containers + locally, restart TS server |
| "Cannot find module" | Use `.js` extensions in imports, restart TS server |
| "Authentication failed" | Verify `DATABASE_URL` matches between `infra/.env` and service `.env` files |
| Changes not reflecting | Rebuild: `docker compose build --no-cache <service>` |

## Database Schema

**User:** `id`, `email`, `password` (Argon2), timestamps  
**Site:** `id`, `userId`, `name`, `url`, timestamps  
**SiteCheck:** `id`, `siteId`, `status`, `httpStatus`, `finalUrl`, `durationMs`, `createdAt`  
**SiteUptimeState:** `siteId`, `state` (UP/DOWN), `since`, `updatedAt`  
**UptimeEvent:** `id`, `siteId`, `previousState`, `newState`, `occurredAt`

## Security

- Argon2 password hashing
- JWT auth (7-day expiration)
- Rate limiting (100 global, 5 register, 10 login, 30 check req/min)
- CORS + Zod validation
- Secrets in `.env` files only

## License

MIT License

---

**Additional docs:** `PROJECT-MEMORY.md` · `bug-journal.md` · `.cursorrules`
