
<img width="1024" height="1024" alt="dryftlink" src="https://github.com/user-attachments/assets/4ed849e5-c78d-44e7-81f6-c6712ea1b082" width="250" height="250"/>

# DryftLink

DryftLink is a **community-first, self-hostable** monitoring project. Today it focuses on **uptime checks + uptime state tracking** (with anti-flapping confirmations). Future phases add alerting, incident timelines, and change detection.

## What’s in the repo

- **API**: Fastify + Prisma + Postgres (monorepo `apps/api`)
- **Worker**: BullMQ worker that runs checks (`apps/worker`)
- **Infra**: Docker Compose for Postgres + Redis (`infra/`)

## Current features

- **Uptime checks**: HTTP/HTTPS checks via background worker
- **Uptime state machine**: UP/DOWN with transition events
- **Confirmation system (anti-flapping)**: configurable confirmations before state changes
- **Stats endpoints**: basic uptime % and response-time averages (windowed)
- **CLI helper**: `dryft-check` for quick command-line checks

## Quickstart (local dev)

Requirements: **Docker Compose**, **Node 20+**, **pnpm**

```bash
pnpm install

cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env

cd infra
docker compose up -d
docker compose exec api pnpm prisma migrate dev

curl http://localhost:3002/health
```

## Contributing

PRs welcome. Keep changes small and focused, and include a short test plan in the PR description.

## License

**MIT** — see `LICENSE`.
