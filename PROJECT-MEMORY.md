# DryftLink Project Memory

> **Purpose:** This file provides complete context for AI assistants working on DryftLink.  
> **Last Updated:** 2026-01-13  
> **Read this file at the start of every new chat to understand the project.**

---

## 🎯 Project Overview

**Name:** DryftLink  
**Type:** Website Monitoring SaaS Backend  
**Status:** Core backend complete, ready for feature additions  
**Development Time:** 3 days (2026-01-10 to 2026-01-13)  
**Developer:** Donson (AI-Augmented Full-Stack Developer)

### What DryftLink Does
A lightweight monitoring backend that tracks website availability and performance by running asynchronous checks in the background and storing historical results for analysis.

**Core Features (Implemented):**
- User authentication (JWT)
- Site management (CRUD)
- On-demand site checks (async via BullMQ)
- Database models for uptime tracking
- Rate limiting and security
- Graceful shutdown
- Docker orchestration

**Planned Features (Not Yet Implemented):**
- Scheduled checks (cron-based)
- Uptime state management
- Uptime event tracking
- Alert/notification system
- Frontend dashboard
- Public status pages
- AI agent "SARA" (Site Availability Reporting Assistant) for human summaries

---

## 🏗️ Architecture

### Tech Stack

**Backend (API):**
- Node.js 20+ with TypeScript
- Fastify (web framework)
- Prisma ORM with PostgreSQL adapter (@prisma/adapter-pg)
- JWT authentication (@fastify/jwt)
- Rate limiting (@fastify/rate-limit)
- CORS (@fastify/cors)
- Password hashing (Argon2)
- Environment validation (Zod)

**Worker (Background Jobs):**
- BullMQ (job queue)
- Redis (queue backend)
- Same Prisma/DB access as API

**Database:**
- PostgreSQL 16
- Managed via Prisma migrations

**Infrastructure:**
- Docker Compose for local dev
- pnpm workspaces (monorepo)
- ES Modules (NodeNext resolution)

### Project Structure

```
dryft/
├── apps/
│   ├── api/                    # REST API service
│   │   ├── src/
│   │   │   ├── auth.ts        # JWT middleware
│   │   │   ├── db.ts          # Prisma client
│   │   │   ├── env.ts         # Environment validation
│   │   │   ├── queue.ts       # BullMQ queue setup
│   │   │   ├── server.ts      # Main Fastify app
│   │   │   └── routes/
│   │   │       ├── auth.ts    # /auth/register, /auth/login
│   │   │       ├── sites.ts   # /sites CRUD
│   │   │       └── checks.ts  # /sites/:id/check
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Database schema
│   │   │   └── migrations/    # Migration history
│   │   ├── prisma.config.ts   # Prisma 7 config
│   │   └── package.json
│   │
│   └── worker/                 # Background job processor
│       ├── src/
│       │   ├── db.ts          # Prisma client
│       │   ├── env.ts         # Environment validation
│       │   ├── queue.ts       # Redis connection
│       │   ├── processor.ts   # Job handler (site checks)
│       │   └── index.ts       # Worker entry point
│       └── package.json
│
├── infra/
│   ├── docker-compose.yml     # Local dev environment
│   └── .env                   # Docker environment vars
│
├── bug-journal.md             # Complete bug history (19 bugs)
├── PROJECT-MEMORY.md          # This file
├── DECISIONS.md               # Architecture decisions
├── README.md                  # Project documentation
├── .cursorrules               # Cursor AI instructions
├── .gitignore                 # Git ignore rules
├── package.json               # Root workspace config
└── pnpm-workspace.yaml        # pnpm workspace definition
```

### Service Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐      ┌──────────────┐
│  API (3002) │─────▶│  PostgreSQL  │
└──────┬──────┘      └──────────────┘
       │
       │ Enqueue Job
       ▼
┌─────────────┐      ┌──────────────┐
│    Redis    │◀─────│    Worker    │
└─────────────┘      └──────┬───────┘
                            │
                            │ Fetch & Store
                            ▼
                     ┌──────────────┐
                     │  PostgreSQL  │
                     └──────────────┘
```

**Flow:**
1. User registers/logs in via API → gets JWT token
2. User creates sites via API (authenticated)
3. User triggers check via `POST /sites/:id/check`
4. API enqueues job to BullMQ (Redis)
5. Worker picks up job, fetches URL, stores result in DB
6. User queries check history (future feature)

---

## 🗄️ Database Schema

### Models

**User:**
- `id` (CUID primary key)
- `email` (unique, indexed)
- `password` (hashed with Argon2)
- `createdAt`, `updatedAt`
- Relations: has many `Site`

**Site:**
- `id` (CUID primary key)
- `userId` (foreign key to User)
- `name` (string)
- `url` (string, what to monitor)
- `createdAt`, `updatedAt`
- Relations: has many `SiteCheck`, has one `SiteUptimeState`, has many `UptimeEvent`

**SiteCheck:** (individual check result)
- `id` (CUID primary key)
- `siteId` (foreign key to Site)
- `status` (enum: SUCCESS, ERROR, TIMEOUT, BLOCKED)
- `httpStatus` (nullable int, e.g., 200, 404)
- `finalUrl` (nullable string, after redirects)
- `durationMs` (nullable int, response time)
- `createdAt` (when check was performed)

**SiteUptimeState:** (current uptime status)
- `siteId` (primary key, one-to-one with Site)
- `state` (enum: UP, DOWN)
- `since` (datetime when state began)
- `updatedAt`

**UptimeEvent:** (history of state changes)
- `id` (CUID primary key)
- `siteId` (foreign key to Site)
- `previousState` (enum: UP, DOWN)
- `newState` (enum: UP, DOWN)
- `occurredAt` (when state changed)

### Enums

- **SiteCheckStatus:** SUCCESS | ERROR | TIMEOUT | BLOCKED
- **UptimeState:** UP | DOWN

---

## 🔐 Security & Best Practices

### Implemented

✅ **Authentication:**
- JWT tokens with 7-day expiration
- `@fastify/jwt` with secret from env
- Middleware: `authenticate` preHandler
- Helper: `getUserId(request)` extracts user from token

✅ **Password Security:**
- Argon2 hashing (industry standard)
- No plaintext passwords stored

✅ **Rate Limiting:**
- Global: 100 requests per minute
- `/auth/register`: 5 per minute
- `/auth/login`: 10 per minute
- `/sites/:id/check`: 30 per minute

✅ **CORS:**
- Configurable via `ALLOWED_ORIGINS` env var
- Defaults to `http://localhost:3000` (frontend)

✅ **Input Validation:**
- Zod schemas for all request bodies
- `.safeParse()` for user-friendly errors
- CUID validation for route params

✅ **Error Handling:**
- Standardized error responses
- No stack traces in production
- Proper HTTP status codes
- Logging via Fastify logger

✅ **Graceful Shutdown:**
- SIGTERM/SIGINT handlers
- Closes server, Redis, Prisma
- Prevents new requests during shutdown
- 10-second timeout for cleanup

✅ **Environment Security:**
- All secrets in `.env` files (gitignored)
- Zod validation on startup
- JWT_SECRET minimum 32 characters
- No hardcoded credentials

---

## 🐛 Known Issues & Bugs

### Resolved (19 bugs total)
See `bug-journal.md` for complete history. Key patterns:

1. **Docker caching** - Required image rebuilds
2. **Prisma Client** - Must regenerate after schema changes
3. **ioredis types** - Version mismatch requires `as any` workaround
4. **Prisma 7** - Datasource URL moved to `prisma.config.ts`

### Open Minor Issues

1. **Type workaround:** `connection as any` for ioredis/BullMQ version mismatch
2. **Duplicate schema:** `/prisma/schema.prisma` exists at root (should remove)
3. **Worker logging:** Uses `console.log` instead of structured logging
4. **Redis cleanup:** Not explicitly closed on graceful shutdown (API + Worker)

### Missing Features (Not Bugs)

- Scheduled checks (cron)
- Uptime state management logic
- Uptime event tracking logic
- API endpoints for check history
- Alerting/notifications
- Frontend dashboard
- SARA AI agent

---

## 🔧 Development Workflow

### Environment Setup

**Prerequisites:**
- Docker & Docker Compose
- pnpm (package manager)
- Node.js 20+

**First-time setup:**
```bash
# Install dependencies
pnpm install

# Copy environment files
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env

# Edit .env files with your values

# Start infrastructure
cd infra
docker compose up -d

# Run migrations
docker compose exec api pnpm prisma migrate dev

# Check services
docker compose ps
```

### Daily Development

```bash
# Start all services
cd infra && docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f worker

# Test API
curl http://localhost:3002/health

# Stop services
docker compose down
```

### After Schema Changes

```bash
# Generate migration
docker compose exec api pnpm prisma migrate dev --name <description>

# Regenerate Prisma Client (in both services)
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate

# Regenerate locally (for IDE)
pnpm prisma generate --schema=apps/api/prisma/schema.prisma

# Restart TypeScript server in IDE
```

### Common Commands

```bash
# Type check
pnpm tsc --noEmit

# Build for production
pnpm build

# Fresh Docker rebuild (nuclear option)
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Check container environment
docker compose exec api env | grep DATABASE_URL

# Access database directly
docker compose exec postgres psql -U dryft -d dryft
```

---

## 🎯 Business Context

### Market Position
- **Target Market:** Developers, DevOps teams, small businesses
- **Competitors:** UptimeRobot, Pingdom, StatusCake, BetterStack
- **Differentiator:** Lightweight, affordable, developer-friendly API

### Pricing Strategy (Planned)
- **Free Tier:** 3 sites, 15-min checks, 7-day retention
- **Pro Tier ($9/mo):** 25 sites, 5-min checks, 30-day retention
- **Pro+ Tier ($29/mo):** Unlimited sites, 1-min checks, 180-day retention, rendered checks

### Cost Model
- **Base costs:** ~$20-50/month (VPS, DB, Redis)
- **Variable costs:** 
  - Check frequency (biggest lever)
  - Retention period
  - Rendered checks (Playwright = expensive)
- **Key insight:** Predictable costs because jobs are scheduled/controlled

### Reusability
This backend architecture (auth, queues, DB) is reusable for:
- Other monitoring tools (API, cron, SSL)
- Dev tools (changelog tracking, dependency monitoring)
- SaaS products requiring async processing

---

## 👤 Developer Profile

**Name:** Donson  
**Role:** AI-Augmented Full-Stack Developer  
**Experience:** Bootcamp graduate, JavaScript certifications  
**Approach:** Uses AI for syntax/boilerplate, focuses on architecture/debugging  
**Strengths:** Problem-solving, systematic debugging, business thinking  
**Areas to grow:** Large refactors without AI guidance, frontend development

### Development Style
- Prefers TypeScript over JavaScript
- Values best practices (security, error handling, graceful shutdown)
- Documents everything (bug journal, decision records)
- Builds slowly and methodically ("brick by brick")
- Commits to GitHub incrementally
- Tests in Docker (production-like environment)

### AI Collaboration Preferences
- Wants concise explanations (not verbose)
- Appreciates verification steps (`tsc --noEmit`, `curl` tests)
- Prefers fixing issues in place rather than workarounds
- Values learning from bugs (hence bug journal)
- Wants to reach 100% completion before moving to next feature

---

## 🚀 Current Status & Next Steps

### What's Complete ✅
- User registration and login (JWT auth)
- Site CRUD operations
- On-demand check triggering
- Worker job processing (fetch + store)
- Database schema with uptime models
- Docker Compose orchestration
- Rate limiting and CORS
- Error handling and graceful shutdown
- Bug journal (19 bugs documented)
- Project memory system (this file)

### Immediate Next Steps (Brick 1: Documentation)
1. Complete README.md
2. Create .env.example files (infra, api, worker)
3. Document API endpoints
4. Commit to GitHub

### Future Development Roadmap

**Brick 2: Scheduled Checks**
- Implement cron-based check scheduling
- Per-site check interval configuration
- Start/stop scheduling on site create/delete

**Brick 3: Uptime State Management**
- Logic to update `SiteUptimeState` after each check
- Determine UP/DOWN based on consecutive failures
- Create `UptimeEvent` records on state changes

**Brick 4: Check History API**
- `GET /sites/:id/checks` (with pagination)
- `GET /sites/:id/uptime` (current state)
- `GET /sites/:id/events` (state change history)

**Brick 5: Alerting**
- Email notifications (SendGrid)
- SMS notifications (Twilio)
- Webhook notifications
- Configurable alert rules

**Brick 6: Frontend Dashboard**
- User login/registration UI
- Site management UI
- Check history visualization
- Real-time status updates

**Brick 7: Advanced Features**
- Public status pages
- SARA AI summaries
- Rendered checks (Playwright)
- Multi-region checks
- SSL certificate monitoring

---

## 📝 Important Notes for AI Assistants

### When Starting a New Chat

1. **Read this file first** (`PROJECT-MEMORY.md`)
2. Check `bug-journal.md` for past issues
3. Review `DECISIONS.md` for context on choices
4. Read `.cursorrules` for coding preferences

### Coding Guidelines

**Always:**
- Use TypeScript with strict types
- Use ES modules with `.js` extensions in imports (NodeNext)
- Validate environment variables with Zod
- Use Prisma for database access
- Add proper error handling
- Test in Docker containers (not just locally)
- Run `prisma generate` after schema changes
- Use `tsc --noEmit` to verify types
- Follow existing patterns (look at `routes/auth.ts` for reference)

**Never:**
- Hardcode credentials
- Skip input validation
- Use `console.log` in API (use Fastify logger)
- Commit `.env` files
- Make breaking changes without discussing
- Skip migrations after schema changes

### Problem-Solving Approach

1. **Read error carefully** - Full message, not just first line
2. **Check Docker logs** - `docker compose logs <service>`
3. **Verify in container** - Not just locally
4. **Check environment** - `docker compose exec <service> env`
5. **Regenerate Prisma** - After any schema change
6. **Rebuild Docker** - When nothing else works
7. **Document the bug** - Add to bug-journal.md

### Docker Troubleshooting Checklist

- [ ] Are containers running? (`docker compose ps`)
- [ ] Are env vars correct? (`docker compose exec <service> env`)
- [ ] Is Prisma Client up to date? (`npx prisma generate`)
- [ ] Are images stale? (`docker compose build <service>`)
- [ ] Are migrations applied? (`prisma migrate dev`)
- [ ] Check logs for startup errors

---

## 📚 Key Files Reference

| File | Purpose | When to Update |
|------|---------|----------------|
| `bug-journal.md` | Bug history | After fixing any bug |
| `PROJECT-MEMORY.md` | Complete project context | After major changes |
| `DECISIONS.md` | Architecture decisions | When making tech choices |
| `README.md` | User-facing docs | Setup or API changes |
| `.cursorrules` | AI coding guidelines | Preference changes |
| `apps/api/prisma/schema.prisma` | Database schema | Data model changes |
| `apps/api/src/env.ts` | Environment validation | New env vars |
| `infra/docker-compose.yml` | Service orchestration | Infrastructure changes |

---

## 🎯 Project Goals

### Short-term (Next 2 weeks)
- Complete documentation (README, .env.example)
- Implement scheduled checks
- Build check history API endpoints
- Deploy to production (VPS or cloud)

### Medium-term (Next 2 months)
- Add alerting/notifications
- Build frontend dashboard
- Implement SARA AI summaries
- Onboard beta users (5-10)

### Long-term (6 months)
- Public status pages
- Multi-region checks
- Advanced features (SSL, API monitoring)
- 100+ paying users
- $1K+ MRR

---

## 💡 Context for Future Development

### Why This Architecture?

- **Monorepo:** Shared types, easier development
- **Separate worker:** Scales independently, isolates concerns
- **BullMQ:** Reliable job queue with retries
- **Prisma:** Type-safe ORM, excellent migrations
- **Fastify:** Fast, low overhead, plugin ecosystem
- **Docker:** Consistent dev/prod environment

### Why These Choices?

See `DECISIONS.md` for detailed rationale on:
- PostgreSQL over MySQL
- BullMQ over Agenda
- Fastify over Express
- JWT over sessions
- Argon2 over bcrypt
- Cursor-based pagination

---

## 🔗 External Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **Fastify Docs:** https://fastify.dev
- **BullMQ Docs:** https://docs.bullmq.io
- **Docker Compose:** https://docs.docker.com/compose

---

**End of Project Memory**

*This file should be updated whenever significant changes occur. It serves as the "source of truth" for AI assistants working on DryftLink.*
