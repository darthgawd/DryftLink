# DryftLink Bug Journal

> Comprehensive log of all bugs encountered during development, their root causes, and solutions.

**Project:** DryftLink - Website Monitoring Backend  
**Duration:** 3 days of development  
**Last Updated:** 2026-01-13  
**Total Bugs Fixed:** 19

---

## Table of Contents

- [Bug Log (Chronological)](#bug-log-chronological)
- [Bug Categories](#bug-categories)
- [Common Patterns](#common-patterns)
- [Prevention Checklist](#prevention-checklist)
- [Statistics](#statistics)

---

## Bug Log (Chronological)

### Bug #1: IORedis Constructor Error

**Date:** 2026-01-12  
**File:** `apps/api/src/queue.ts:10-13`  
**Severity:** 🔴 High (blocking)

**Error:**
```
This expression is not constructable.
Type 'typeof import("/home/donson/Desktop/dryft/node_modules/.pnpm/ioredis@5.9.1/node_modules/ioredis/built/index")' has no construct signatures.
```

**Root Cause:**  
Incorrect import syntax for ioredis. Using `new Redis()` with named import instead of default import.

**Solution:**  
Changed from `import { Redis }` to `import IORedis` and used `new IORedis.default()`

**Code Change:**
```typescript
// ❌ Before
import { Redis } from "ioredis";
export const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null
});

// ✅ After
import IORedis from "ioredis";
export const connection = new IORedis.default(REDIS_URL, {
  maxRetriesPerRequest: null
});
```

**Lesson Learned:**  
Default exports in TypeScript require different import syntax. Always check the package's export structure in the type definitions.

---

### Bug #2: IORedis Type Mismatch with BullMQ

**Date:** 2026-01-12  
**File:** `apps/api/src/queue.ts:14-16`  
**Severity:** 🟡 Medium (TypeScript error)

**Error:**
```
Type 'Redis' is not assignable to type 'ConnectionOptions'.
Type 'Redis' is not assignable to type 'ClusterOptions | Redis | Cluster'.
ioredis@5.9.1 vs ioredis@5.8.2
```

**Root Cause:**  
Version mismatch between project's ioredis (5.9.1) and BullMQ's peer dependency expectation (5.8.2). TypeScript strict type checking caught the incompatibility.

**Solution:**  
Added type assertion `connection as any` when passing to BullMQ Queue constructor.

**Code Change:**
```typescript
// ✅ Workaround
export const dryftQueue = new Queue(QUEUE_NAME, { 
  connection: connection as any 
});
```

**Lesson Learned:**  
Dependency version mismatches in monorepos can cause type incompatibilities. Consider pinning peer dependencies or using type assertions as a bridge.

**Note:** Also affected `apps/worker/src/queue.ts` and `apps/worker/src/processor.ts`

---

### Bug #3: Cannot Find Module '../queue.js'

**Date:** 2026-01-12  
**File:** `apps/api/src/routes/checks.ts:2-5`  
**Severity:** 🟢 Low (IDE false positive)

**Error:**
```
Cannot find module '../queue.js' or its corresponding type declarations.
```

**Root Cause:**  
IDE caching issue. The import path was correct for NodeNext module resolution, but IDE hadn't refreshed.

**Solution:**  
No code change needed. Running `tsc --noEmit` showed no actual error. IDE restart resolved it.

**Lesson Learned:**  
Not all red squiggles are real errors. Verify with `tsc --noEmit` before making changes.

---

### Bug #4: Import Path .ts Extension Error

**Date:** 2026-01-12  
**File:** `apps/api/src/routes/checks.ts:2-5`  
**Severity:** 🟡 Medium (configuration error)

**Error:**
```
An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.
```

**Root Cause:**  
User manually changed `../queue.js` to `../queue.ts` in an attempt to fix Bug #3.

**Solution:**  
Reverted back to `.js` extension. With NodeNext module resolution, you must use `.js` extensions even for TypeScript files.

**Code Change:**
```typescript
// ❌ Wrong
import { dryftQueue } from "../queue.ts";

// ✅ Correct
import { dryftQueue } from "../queue.js";
```

**Lesson Learned:**  
With `"moduleResolution": "NodeNext"`, always use `.js` extensions in imports, even for `.ts` source files.

---

### Bug #5: Environment Variable Expansion Not Working

**Date:** 2026-01-12  
**File:** `apps/api/.env`, `apps/worker/.env`  
**Severity:** 🔴 High (runtime failure)

**Error:**
Variables like `${REDIS_PASSWORD}` were not being expanded by `dotenv`.

**Root Cause:**  
The `dotenv` package doesn't support variable expansion by default. Need `dotenv-expand` or explicit values.

**Solution:**  
Updated `.env` files to contain fully formed connection strings instead of using variable interpolation.

**Code Change:**
```bash
# ❌ Before (doesn't work)
REDIS_PASSWORD=secure123
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ✅ After (explicit)
REDIS_PASSWORD=secure123
REDIS_URL=redis://:secure123@redis:6379
```

**Lesson Learned:**  
Don't assume shell-style variable expansion works in `.env` files. Use explicit values or add `dotenv-expand`.

---

### Bug #6: Prisma Datasource URL Required

**Date:** 2026-01-12  
**File:** `apps/api/prisma/schema.prisma`  
**Severity:** 🔴 High (blocking migrations)

**Error:**
```
Error: The datasource.url property is required in your Prisma config file when using prisma migrate dev.
```

**Root Cause:**  
Missing `url = env("DATABASE_URL")` in the `datasource db` block.

**Solution:**  
Added `url = env("DATABASE_URL")` to schema.prisma (later removed due to Prisma 7 changes).

**Code Change:**
```prisma
// ✅ Fix (for Prisma 6)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Lesson Learned:**  
Prisma requires explicit datasource URL configuration for migrations.

**Note:** This was later removed in Bug #15 due to Prisma 7 deprecation.

---

### Bug #7: JWT_SECRET Property Doesn't Exist

**Date:** 2026-01-12  
**File:** `apps/api/src/env.ts`  
**Severity:** 🟡 Medium (TypeScript error)

**Error:**
```
Property 'JWT_SECRET' does not exist on type '{ NODE_ENV: string; API_PORT: number; }'.
```

**Root Cause:**  
`JWT_SECRET` was being used in `server.ts` but wasn't defined in the Zod schema in `env.ts`.

**Solution:**  
Added `JWT_SECRET` validation to the Zod schema.

**Code Change:**
```typescript
// ✅ Added to Env schema
const Env = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ALLOWED_ORIGINS: z.string().optional()
});
```

**Lesson Learned:**  
Keep environment variable schemas in sync with actual usage. TypeScript catches missing env vars at compile time.

---

### Bug #8: Property 'user' Does Not Exist on PrismaClient

**Date:** 2026-01-12  
**File:** `apps/api/src/routes/auth.ts`  
**Severity:** 🟡 Medium (TypeScript error)

**Error:**
```
Property 'user' does not exist on type 'PrismaClient<{ adapter: PrismaPg; }, never, DefaultArgs>'.
```

**Root Cause:**  
Prisma Client types were not regenerated after adding the `User` model to `schema.prisma`.

**Solution:**  
Ran `npx prisma generate` to regenerate the Prisma Client with new model types.

**Command:**
```bash
npx prisma generate
```

**Lesson Learned:**  
Always run `prisma generate` after schema changes to update TypeScript types.

---

### Bug #9: Property 'user' Missing in SiteCreateInput

**Date:** 2026-01-12  
**File:** `apps/api/src/routes/sites.ts`  
**Severity:** 🔴 High (TypeScript error, breaking change)

**Error:**
```
Property 'user' is missing in type '{ name: string; url: string; }' but required in type 'SiteCreateInput'.
```

**Root Cause:**  
The `Site` model requires a `userId` relation, but the route wasn't including it when creating sites.

**Solution:**  
Implemented JWT authentication middleware and extracted `userId` from the token to include in site creation.

**Code Change:**
```typescript
// ✅ Fixed
app.post("/sites", { preHandler: authenticate }, async (req, reply) => {
  const userId = getUserId(req);
  const site = await prisma.site.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      userId // Added this
    }
  });
  // ...
});
```

**Lesson Learned:**  
When adding user ownership to models, ensure authentication is implemented and userId is passed.

---

### Bug #10: All Declarations of 'user' Must Have Identical Modifiers

**Date:** 2026-01-12  
**File:** `apps/api/src/auth.ts`  
**Severity:** 🟡 Medium (TypeScript error)

**Error:**
```
All declarations of 'user' must have identical modifiers.
```

**Root Cause:**  
Had a conflicting `declare module "fastify"` block in `auth.ts` that clashed with `@fastify/jwt`'s type augmentation.

**Solution:**  
Removed the redundant type declaration block from `auth.ts`.

**Lesson Learned:**  
Check existing type augmentations from packages before adding your own. `@fastify/jwt` already augments FastifyRequest.

---

### Bug #11: Docker Compose env_file Not Found

**Date:** 2026-01-12  
**File:** `infra/docker-compose.yml`  
**Severity:** 🔴 High (Docker startup failure)

**Error:**
```
env file `/home/donson/Desktop/dryft/infra/.env` not found: stat /home/donson/Desktop/dryft/infra/.env`: no such file or directory
```

**Root Cause:**  
Trailing backtick (`) character in the `env_file` path in docker-compose.yml.

**Solution:**  
Removed the stray backtick from the path.

**Code Change:**
```yaml
# ❌ Before
env_file:
  - .env`

# ✅ After
env_file:
  - .env
```

**Lesson Learned:**  
YAML is whitespace-sensitive. Carefully check for stray characters, especially after copy-paste operations.

---

### Bug #12: Cannot Find Name 'sendError'

**Date:** 2026-01-12  
**File:** `apps/api/src/server.ts:70-73`  
**Severity:** 🟡 Medium (TypeScript error)

**Error:**
```
Cannot find name 'sendError'.
```

**Root Cause:**  
Referenced a `sendError` helper function that didn't exist.

**Solution:**  
Defined the `sendError` helper function in `server.ts`.

**Code Change:**
```typescript
// ✅ Added helper
function sendError(reply: FastifyReply, statusCode: number, error: string, message?: string) {
  return reply.code(statusCode).send({ error, message });
}
```

**Lesson Learned:**  
Define helper functions before using them. TypeScript catches undefined references.

---

### Bug #13: Table 'User' Does Not Exist in Database

**Date:** 2026-01-12  
**Severity:** 🔴 Critical (runtime database error)

**Error:**
```json
{
  "statusCode": 500,
  "code": "P2021",
  "error": "Internal Server Error",
  "message": "Invalid `prisma.user.findUnique()` invocation: The table `public.User` does not exist in the current database."
}
```

**Root Cause:**  
Prisma schema was updated with new models, but migrations hadn't been run to create the database tables.

**Solution:**  
Ran `prisma migrate dev` to apply migrations and create tables.

**Command:**
```bash
docker compose exec api pnpm prisma migrate dev --name init
```

**Lesson Learned:**  
Schema changes require database migrations. Tables don't magically appear.

---

### Bug #14: Prisma Authentication Failed

**Date:** 2026-01-12  
**Severity:** 🔴 High (database connection failure)

**Error:**
```
Error: P1000: Authentication failed against database server, the provided database credentials for `dryft` are not valid.
```

**Root Cause:**  
Incorrect `DATABASE_URL` when running `prisma migrate dev` from inside Docker. The connection string needed to match Docker Compose configuration.

**Solution:**  
Corrected `DATABASE_URL` in environment files to match the actual database credentials.

**Lesson Learned:**  
Docker container environments require container-resolvable hostnames and correct credentials.

---

### Bug #15: Prisma 7 Datasource URL No Longer Supported

**Date:** 2026-01-13  
**Severity:** 🔴 Critical (breaking change)

**Error:**
```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: The datasource property `url` is no longer supported in schema files.
```

**Root Cause:**  
Upgraded to Prisma 7, which deprecated `url = env("DATABASE_URL")` in schema.prisma. URL must now be in `prisma.config.ts`.

**Solution:**  
1. Removed `url = env("DATABASE_URL")` from `schema.prisma`
2. Added `datasource.url` to `apps/api/prisma.config.ts`

**Code Change:**
```typescript
// ✅ apps/api/prisma.config.ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

**Lesson Learned:**  
Major version upgrades come with breaking changes. Read migration guides carefully.

**Note:** Schema files were also corrupted with SQL syntax and had to be restored.

---

### Bug #16: Doubled Path in Prisma Schema Loading

**Date:** 2026-01-13  
**Severity:** 🔴 High (file not found)

**Error:**
```
Error: Could not load schema from `/app/apps/api/apps/api/prisma/schema.prisma` provided by "prisma.config.ts": file or directory not found
```

**Root Cause:**  
Path in `prisma.config.ts` was set to `apps/api/prisma/schema.prisma`, but Docker's working directory was already `/app` (workspace root), causing path doubling.

**Solution:**  
Changed schema path in `prisma.config.ts` to be relative to working directory.

**Code Change:**
```typescript
// ❌ Before (doubled path)
schema: "apps/api/prisma/schema.prisma"

// ✅ After (correct path)
schema: "prisma/schema.prisma"
```

**Lesson Learned:**  
Docker working directory affects relative paths. Test path resolution in the actual execution environment.

**Note:** Later changed to `apps/api/prisma/schema.prisma` when proper Docker context was established.

---

### Bug #17: Migration Failed - Relation Already Exists

**Date:** 2026-01-13  
**Severity:** 🔴 Critical (migration conflict)

**Error:**
```
Error: P3006
Migration `20260112024726_init_site` failed to apply cleanly to the shadow database.
Error: ERROR: relation "Site" already exists
```

**Root Cause:**  
Conflicting migration history. Old tables existed in the database, but migration files were out of sync.

**Solution:**  
Complete database reset:
1. Dropped all tables manually (`DROP TABLE ... CASCADE`)
2. Removed old migrations (`rm -rf apps/api/prisma/migrations/*`)
3. Rebuilt Docker images (`docker compose build api`)
4. Created fresh migration (`pnpm prisma migrate dev --name uptime_v1_tables`)

**Commands:**
```bash
# Manual cleanup
docker compose exec postgres psql -U dryft -d dryft -c "DROP TABLE IF EXISTS ..."

# Remove old migrations
rm -rf apps/api/prisma/migrations/*

# Rebuild
docker compose build api && docker compose up -d api

# Fresh migration
docker compose exec api pnpm prisma migrate dev --name uptime_v1_tables
```

**Lesson Learned:**  
Sometimes a clean slate is faster than fixing corrupted migration history. Docker image caching can persist old migrations.

---

### Bug #18: Cannot Read Properties of Undefined (prisma.siteCheck)

**Date:** 2026-01-13  
**Severity:** 🔴 Critical (runtime error in worker)

**Error:**
```
[worker] failed {
  id: '3',
  name: 'check_site',
  err: "Cannot read properties of undefined (reading 'create')"
}
```

**Root Cause:**  
Prisma Client wasn't regenerated in the worker container after schema changes. The `siteCheck` model didn't exist in the worker's client.

**Solution:**  
Ran `npx prisma generate` inside both API and worker containers.

**Commands:**
```bash
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate
```

**Lesson Learned:**  
Multi-service architectures require Prisma Client regeneration in ALL services that use it after schema changes.

---

### Bug #19: Property 'siteCheck' Does Not Exist (TypeScript)

**Date:** 2026-01-13  
**Severity:** 🟢 Low (IDE display issue)

**Error:**
```
Property 'siteCheck' does not exist on type 'PrismaClient<{ adapter: PrismaPg; }, never, DefaultArgs>'.
```

**Root Cause:**  
Local IDE cache was stale after Prisma Client regeneration in Docker.

**Solution:**  
Regenerated Prisma Client locally and restarted TypeScript server.

**Commands:**
```bash
pnpm prisma generate --schema=apps/api/prisma/schema.prisma
# Then restart TypeScript server in IDE
```

**Lesson Learned:**  
Keep local Prisma Client in sync with Docker for IDE type checking. `tsc --noEmit` showed no actual errors.

---

## Bug Categories

### 📦 TypeScript Type Errors (6 bugs)
- **Bug #1:** IORedis constructor
- **Bug #2:** IORedis type mismatch
- **Bug #7:** JWT_SECRET missing
- **Bug #8:** Prisma user model types
- **Bug #10:** Duplicate type declarations
- **Bug #19:** Prisma siteCheck types (IDE)

### 🐳 Docker/Environment Issues (7 bugs)
- **Bug #5:** Environment variable expansion
- **Bug #11:** Docker Compose env_file path
- **Bug #13:** Missing database tables
- **Bug #14:** Database authentication
- **Bug #16:** Doubled schema path
- **Bug #17:** Migration conflicts
- **Bug #18:** Prisma Client not regenerated in containers

### 🗄️ Prisma Schema/Migration (5 bugs)
- **Bug #6:** Datasource URL required
- **Bug #13:** Tables not created
- **Bug #15:** Prisma 7 breaking change
- **Bug #17:** Migration conflict
- **Bug #18:** Client generation needed

### 📁 Import/Module Resolution (2 bugs)
- **Bug #3:** IDE module resolution cache
- **Bug #4:** .ts vs .js extension

### 🔧 Configuration Errors (3 bugs)
- **Bug #9:** Missing userId in site creation
- **Bug #12:** Undefined helper function
- **Bug #16:** Path resolution in Docker

---

## Common Patterns

### Pattern 1: Docker Caching Issues
**Occurred in:** Bug #15, #16, #17, #18

**Symptoms:**
- Changes on host not reflected in container
- Old migrations persist despite local deletion
- Stale Prisma Client in running containers

**Root Cause:**  
Docker layer caching and `COPY . .` in Dockerfile can preserve old state.

**Solution Pattern:**
```bash
# Nuclear option (always works)
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Targeted option (faster)
docker compose build <service>
docker compose up -d <service>
docker compose exec <service> npx prisma generate
```

---

### Pattern 2: Prisma Type Generation Lag
**Occurred in:** Bug #8, #18, #19

**Symptoms:**
- TypeScript errors for models that exist in schema
- Runtime "undefined" errors for Prisma models
- IDE shows red squiggles but `tsc` passes

**Root Cause:**  
Prisma Client must be regenerated after schema changes, in BOTH Docker containers and local dev environment.

**Solution Pattern:**
```bash
# After ANY schema change:
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate
pnpm prisma generate --schema=apps/api/prisma/schema.prisma
# Restart TypeScript server in IDE
```

---

### Pattern 3: Environment Variable Pitfalls
**Occurred in:** Bug #5, #14

**Symptoms:**
- Services can't connect to each other
- Authentication failures
- Variables not expanded

**Root Cause:**  
- `dotenv` doesn't expand variables
- Docker service names vs localhost
- Mismatched credentials

**Solution Pattern:**
```bash
# Use explicit values in .env files
DATABASE_URL=postgresql://user:pass@postgres:5432/db
REDIS_URL=redis://:pass@redis:6379

# Verify in container
docker compose exec api env | grep URL
```

---

### Pattern 4: Import/Module Resolution
**Occurred in:** Bug #1, #3, #4

**Symptoms:**
- "Cannot find module" errors
- "Not constructable" errors
- IDE errors but code works

**Root Cause:**
- Default vs named imports
- .ts vs .js extensions with NodeNext
- IDE cache staleness

**Solution Pattern:**
```typescript
// For default exports
import IORedis from "ioredis";

// For named exports
import { something } from "package";

// Always use .js extensions (NodeNext)
import { foo } from "./module.js";

// Verify with tsc
pnpm tsc --noEmit
```

---

## Prevention Checklist

### ✅ After Schema Changes

- [ ] Run `prisma generate` in API container
- [ ] Run `prisma generate` in worker container
- [ ] Run `prisma generate` locally
- [ ] Restart TypeScript server in IDE
- [ ] Run `pnpm tsc --noEmit` to verify types
- [ ] Test API endpoints that use new models
- [ ] Test worker jobs that use new models

### ✅ After Docker Changes

- [ ] Rebuild affected images (`docker compose build <service>`)
- [ ] Verify environment variables in container (`docker compose exec <service> env`)
- [ ] Check volume mounts (`docker compose config`)
- [ ] Verify service can connect to dependencies
- [ ] Check logs for startup errors (`docker compose logs <service>`)

### ✅ After Dependency Updates

- [ ] Check for type mismatches (peer dependencies)
- [ ] Review CHANGELOG for breaking changes
- [ ] Test in Docker container (not just locally)
- [ ] Update type assertions if needed (`as any` workarounds)
- [ ] Run full test suite

### ✅ Before Committing

- [ ] Run `pnpm tsc --noEmit` (all workspaces)
- [ ] Check for untracked files (`git status`)
- [ ] Verify `.env` files are gitignored
- [ ] Test in clean Docker environment
- [ ] Review diff for debug code/console.logs
- [ ] Update documentation if needed

### ✅ When Debugging

- [ ] Read the FULL error message (don't skim)
- [ ] Check if it's an IDE cache issue (restart TS server)
- [ ] Verify in container, not just locally
- [ ] Check Docker logs (`docker compose logs`)
- [ ] Test with `curl` or Postman (isolate from frontend)
- [ ] Add temporary logging (remove after fix)

---

## Statistics

**Total Bugs:** 19  
**Development Time:** 3 days  
**Average Resolution Time:** ~15 minutes per bug  
**Total Debug Time:** ~5 hours across 3 days  

### By Severity
- 🔴 **Critical:** 5 bugs (26%)
- 🔴 **High:** 6 bugs (32%)
- 🟡 **Medium:** 6 bugs (32%)
- 🟢 **Low:** 2 bugs (10%)

### By Category
- 🐳 **Docker/Environment:** 7 bugs (37%)
- 📦 **TypeScript Types:** 6 bugs (32%)
- 🗄️ **Prisma/Database:** 5 bugs (26%)
- 📁 **Import/Module:** 2 bugs (10%)
- 🔧 **Configuration:** 3 bugs (16%)

*Note: Some bugs span multiple categories*

### Resolution Time Distribution
- ⚡ **< 5 minutes:** 6 bugs (quick fixes, typos)
- ⏱️ **5-15 minutes:** 8 bugs (standard debugging)
- ⏰ **15-30 minutes:** 3 bugs (required research)
- 🐌 **> 30 minutes:** 2 bugs (Bug #15, #17 - required full reset)

### Most Time-Consuming
1. **Bug #17:** Migration conflict (~2 hours including reset)
2. **Bug #15:** Prisma 7 upgrade (~1 hour with schema corruption)
3. **Bug #5:** Environment variables (~30 minutes)

### Easiest to Fix
1. **Bug #11:** Removed stray backtick (~2 minutes)
2. **Bug #12:** Defined missing function (~3 minutes)
3. **Bug #4:** Reverted .ts to .js (~2 minutes)

---

## Key Takeaways

### 🎯 What Went Well

1. **Systematic debugging** - Each error was isolated and fixed methodically
2. **Docker usage** - Container isolation helped identify environment issues
3. **Type safety** - TypeScript caught many issues at compile time
4. **Git tracking** - Version control made rollbacks easy

### 🎓 What We Learned

1. **Docker caching** is powerful but can hide changes - rebuild when in doubt
2. **Prisma Client** must be regenerated everywhere after schema changes
3. **Environment variables** need explicit values (no shell expansion in dotenv)
4. **Major version upgrades** require careful migration (Prisma 6 → 7)
5. **IDE errors** aren't always real - verify with `tsc --noEmit`

### 🚀 What's Next

**Remaining Known Issues:**
- Type workaround (`connection as any`) for ioredis version mismatch
- Duplicate `schema.prisma` at root level (should be removed)
- Missing `.env.example` files for documentation

**Future Improvements:**
- Add automated tests to catch regressions
- Set up CI/CD to test in Docker
- Add pre-commit hooks for type checking
- Consider Prisma Accelerate to avoid client regeneration

---

## Appendix: Quick Reference

### Useful Commands

```bash
# Type check without build
pnpm tsc --noEmit

# Regenerate Prisma (all places)
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate
pnpm prisma generate --schema=apps/api/prisma/schema.prisma

# Docker fresh start
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Check container env vars
docker compose exec <service> env | grep <VAR>

# View service logs
docker compose logs <service> --tail=50 -f

# Prisma migration (in container)
docker compose exec api pnpm prisma migrate dev --name <migration_name>

# Test API endpoint
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Common Error Patterns

| Error Message | Likely Cause | Quick Fix |
|---------------|--------------|-----------|
| "Property X does not exist on PrismaClient" | Stale Prisma Client | `npx prisma generate` |
| "Cannot find module" | Import path or IDE cache | Check .js extension, restart TS server |
| "Authentication failed" | Wrong DATABASE_URL | Check env vars in container |
| "relation already exists" | Migration conflict | Reset DB or resolve manually |
| "file or directory not found" | Path resolution issue | Check working directory context |
| "Type X is not assignable" | Version mismatch | Add type assertion or update deps |

---

### Bug #20: Prisma Migration Sync Issue

**Date:** 2026-01-14  
**File:** `apps/api/prisma/schema.prisma`  
**Severity:** 🔴 High (blocking)

**Error:**
```
Already in sync, no schema change or pending migration was found.
```

**Root Cause:**  
Docker container had stale schema cached despite local schema.prisma changes. Container wasn't picking up the updated schema file.

**Solution:**  
Rebuilt API Docker container to force it to pick up the latest schema.

**Commands:**
```bash
docker compose build api
docker compose up -d api
docker compose exec api pnpm prisma migrate dev
```

**Lesson Learned:**  
Docker layer caching can cause containers to use stale files even after local changes. Rebuild containers after significant schema changes.

---

### Bug #21: TypeScript Type Errors (Prisma Client Stale)

**Date:** 2026-01-14  
**File:** `apps/worker/src/uptime-state.ts`, `apps/api/src/routes/uptime.ts`  
**Severity:** 🟡 Medium (TypeScript error)

**Error:**
```
Property 'consecutiveFailures' does not exist on type 'SiteUptimeState'.
Property 'consecutiveSuccesses' does not exist on type 'SiteUptimeState'.
```

**Root Cause:**  
Local Prisma Client types weren't regenerated after adding new fields to the schema. TypeScript was referencing stale type definitions.

**Solution:**  
Ran `pnpm prisma generate` in `apps/api` to regenerate Prisma Client types locally.

**Commands:**
```bash
cd apps/api
pnpm prisma generate
# Restart TypeScript server in IDE
```

**Lesson Learned:**  
User caught that we were inconsistently using `npx` instead of `pnpm`. Always use `pnpm` for this project to stay consistent with the tooling.

---

### Bug #22: Worker Prisma Generate Path Error

**Date:** 2026-01-14  
**File:** `apps/worker/`  
**Severity:** 🔴 High (blocking)

**Error:**
```
Error: Could not find Prisma Schema at the default location.
```

**Root Cause:**  
Worker service doesn't have its own `prisma/schema.prisma`. It needs to point to the API's schema when generating the Prisma Client.

**Solution:**  
Added `--schema` flag pointing to the API's schema location.

**Command:**
```bash
cd apps/worker
pnpm prisma generate --schema=../api/prisma/schema.prisma
```

**Lesson Learned:**  
In a monorepo where services share a schema, services without their own schema file need explicit `--schema` paths for Prisma Client generation.

---

### Bug #23: Silent Logging Failure (Containerized Worker)

**Date:** 2026-01-14  
**File:** `apps/worker/src/uptime-state.ts`  
**Severity:** 🔴 High (debugging blocked)

**Error:**
No error message. `fetch()` calls to `http://localhost:9999/log` from worker container failed silently. Expected logs in `debug.log` but file remained empty.

**Root Cause:**  
Worker container couldn't reach host's logging endpoint at `localhost:9999`. Network isolation between container and host prevented connection.

**Solution:**  
Replaced `fetch()` logging with `console.log()` statements using distinct prefixes (`[DEBUG-A]`, `[DEBUG-B]`), then extracted logs from Docker container output.

**Code Change:**
```typescript
// ❌ Before (failed silently)
await fetch("http://localhost:9999/log", {
  method: "POST",
  body: JSON.stringify(data)
});

// ✅ After (works in container)
console.log(`[DEBUG-A] ${JSON.stringify(data)}`);
```

**Commands:**
```bash
# Extract debug logs
docker compose logs worker | grep "DEBUG-"
```

**Lesson Learned:**  
Containers can't reach `localhost` services on the host without special networking config. Use `console.log` for containerized debugging or use `host.docker.internal`.

---

### Bug #24: Logic Bug - First Check Immediately Marks DOWN

**Date:** 2026-01-14  
**File:** `apps/worker/src/uptime-state.ts`  
**Severity:** 🔴 Critical (business logic bug)

**Error:**
Site marked as DOWN immediately after first failed check, despite `confirmationsRequired: 2` configuration.

**Root Cause:**  
Confirmation system wasn't accounting for the initial state creation. When a site's first check failed, the logic immediately transitioned to DOWN without requiring confirmation.

**Solution:**  
Modified `updateUptimeState()` to initialize state optimistically as "UP" and start tracking `consecutiveFailures` from 1. Site only transitions to DOWN after confirmation threshold is reached on subsequent failures.

**Code Change:**
```typescript
// ❌ Before (immediate transition)
if (!currentState) {
  await prisma.siteUptimeState.create({
    data: {
      siteId,
      state: newState, // DOWN on first failure
      // ...
    }
  });
}

// ✅ After (optimistic with confirmation)
if (!currentState) {
  const initialState: UptimeState = "UP";
  await prisma.siteUptimeState.create({
    data: {
      siteId,
      state: initialState, // Always UP initially
      consecutiveFailures: newCheckState === "DOWN" ? 1 : 0,
      consecutiveSuccesses: newCheckState === "UP" ? 1 : 0,
      // ...
    }
  });
}
```

**Lesson Learned:**  
Edge cases like "first ever check" need explicit handling in state machines. Initial state should align with system's optimistic assumptions.

---

### Bug #25: CLI Script - site_exists Error

**Date:** 2026-01-14  
**File:** `dryft-check`  
**Severity:** 🟡 Medium (CLI tool reusability)

**Error:**
```json
{
  "error": "site_exists",
  "message": "A site with this URL already exists"
}
```

**Root Cause:**  
`dryft-check` script created temporary sites with the same URL on each run. Database unique constraint `(userId, url)` prevented reuse of the same URL.

**Solution:**  
Added random query parameter to the URL when creating temporary sites, making each URL unique while still checking the same base URL.

**Code Change:**
```bash
# ❌ Before (reused same URL)
CHECK_URL="$URL"

# ✅ After (unique on every run)
RANDOM_SUFFIX="?_dryft_check=$RANDOM$(date +%s)"
CHECK_URL="$URL$RANDOM_SUFFIX"
```

**Lesson Learned:**  
CLI tools that create temporary resources need unique identifiers to avoid conflicts on repeated use. Query parameters are a simple way to make URLs unique.

---

### Bug #26: CLI Script - null Output for Timeout Cases

**Date:** 2026-01-14  
**File:** `dryft-check`  
**Severity:** 🟢 Low (display issue)

**Error:**
Script displayed `null` for Status, HTTP Code, and Response Time when a site timed out.

**Root Cause:**  
1. `jq` didn't handle null values gracefully in output
2. Wait time (10 seconds) wasn't long enough for checks with 10-second timeout + processing time

**Solution:**  
1. Used jq's `// "N/A"` operator to provide defaults for null values
2. Increased sleep time from 10s to 12s to allow for timeout + processing

**Code Change:**
```bash
# ❌ Before (showed null)
HTTP_STATUS=$(echo $RESULT | jq -r '.lastHttpStatus')
DURATION=$(echo $RESULT | jq -r '.lastDurationMs')

# ✅ After (shows N/A for null)
HTTP_STATUS=$(echo $RESULT | jq -r '.lastHttpStatus // "N/A"')
DURATION=$(echo $RESULT | jq -r '.lastDurationMs // "N/A"')

# ❌ Before (too short)
sleep 10

# ✅ After (accounts for timeout)
sleep 12
```

**Lesson Learned:**  
CLI output should handle edge cases gracefully. Null values need explicit handling for user-friendly display.

---

### Bug #27: CLI Script - Confusing Status Display

**Date:** 2026-01-14  
**File:** `dryft-check`  
**Severity:** 🟢 Low (UX issue)

**Error:**
Script showed "ERROR" status for 404 responses but didn't clearly indicate the site was DOWN. Users expected to see UP/DOWN state, not just check status.

**Root Cause:**  
Script displayed check status (SUCCESS/ERROR/TIMEOUT/BLOCKED) but not the user-relevant state (UP/DOWN). For single checks, the distinction matters for understanding impact.

**Solution:**  
Updated output to prominently show "Site is UP" or "Site is DOWN" with HTTP codes, making the state clear at a glance.

**Code Change:**
```bash
# ❌ Before (ambiguous)
echo "❌ Site returned ERROR (HTTP $HTTP_STATUS)"

# ✅ After (clear state)
echo "❌ Site is DOWN"
echo "   HTTP $HTTP_STATUS (ERROR)"
```

**Lesson Learned:**  
CLI tools should present information in user-centric terms. "DOWN" is more meaningful than "ERROR" for understanding site availability.

---

## Bug Categories

### 📦 TypeScript Type Errors (7 bugs)
- **Bug #1:** IORedis constructor
- **Bug #2:** IORedis type mismatch
- **Bug #7:** JWT_SECRET missing
- **Bug #8:** Prisma user model types
- **Bug #10:** Duplicate type declarations
- **Bug #19:** Prisma siteCheck types (IDE)
- **Bug #21:** Stale Prisma types after schema changes *(NEW)*

### 🐳 Docker/Environment Issues (8 bugs)
- **Bug #5:** Environment variable expansion
- **Bug #11:** Docker Compose env_file path
- **Bug #13:** Missing database tables
- **Bug #14:** Database authentication
- **Bug #16:** Doubled schema path
- **Bug #17:** Migration conflicts
- **Bug #18:** Prisma Client not regenerated in containers
- **Bug #20:** Docker container stale schema cache *(NEW)*

### 🗄️ Prisma Schema/Migration (7 bugs)
- **Bug #6:** Datasource URL required
- **Bug #13:** Tables not created
- **Bug #15:** Prisma 7 breaking change
- **Bug #17:** Migration conflict
- **Bug #18:** Client generation needed
- **Bug #20:** Container schema sync *(NEW)*
- **Bug #22:** Worker schema path *(NEW)*

### 📁 Import/Module Resolution (2 bugs)
- **Bug #3:** IDE module resolution cache
- **Bug #4:** .ts vs .js extension

### 🔧 Configuration Errors (3 bugs)
- **Bug #9:** Missing userId in site creation
- **Bug #12:** Undefined helper function
- **Bug #16:** Path resolution in Docker

### 🐛 Logic Bugs (1 bug)
- **Bug #24:** First check confirmation logic *(NEW)*

### 🖥️ CLI/Tooling Issues (3 bugs)
- **Bug #25:** site_exists constraint *(NEW)*
- **Bug #26:** null value handling *(NEW)*
- **Bug #27:** Status display clarity *(NEW)*

### 🔍 Debugging Issues (1 bug)
- **Bug #23:** Silent fetch failures in containers *(NEW)*

---

## Statistics

**Total Bugs:** 27 *(+8 new)*  
**Development Time:** 4 days  
**Average Resolution Time:** ~15 minutes per bug  
**Total Debug Time:** ~7 hours across 4 days  

### By Severity
- 🔴 **Critical:** 6 bugs (22%)
- 🔴 **High:** 9 bugs (33%)
- 🟡 **Medium:** 9 bugs (33%)
- 🟢 **Low:** 3 bugs (11%)

### By Category
- 🐳 **Docker/Environment:** 8 bugs (30%)
- 🗄️ **Prisma/Database:** 7 bugs (26%)
- 📦 **TypeScript Types:** 7 bugs (26%)
- 🖥️ **CLI/Tooling:** 3 bugs (11%)
- 🔧 **Configuration:** 3 bugs (11%)
- 📁 **Import/Module:** 2 bugs (7%)
- 🐛 **Logic Bugs:** 1 bug (4%)
- 🔍 **Debugging:** 1 bug (4%)

*Note: Some bugs span multiple categories*

### Resolution Time Distribution
- ⚡ **< 5 minutes:** 8 bugs (quick fixes, typos)
- ⏱️ **5-15 minutes:** 12 bugs (standard debugging)
- ⏰ **15-30 minutes:** 5 bugs (required research)
- 🐌 **> 30 minutes:** 2 bugs (Bug #15, #17 - required full reset)

### Most Recent Session (Bugs #20-27)
- **Date:** 2026-01-14
- **Focus:** Brick 4 (Confirmation System) + CLI tooling
- **Total Bugs:** 8
- **Highlights:**
  - Fixed critical confirmation logic bug (Bug #24)
  - Debugged containerized logging (Bug #23)
  - Polished CLI tool UX (Bugs #25-27)
  - Prisma sync issues across environments (Bugs #20-22)

---

**END OF BUG JOURNAL**

*This document will be updated as new bugs are discovered and fixed.*
