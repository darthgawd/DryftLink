# DryftLink - Cursor AI Rules

> **Purpose:** Comprehensive guidelines for AI assistants working on DryftLink  
> **Last Updated:** 2026-01-13  
> **Also available as:** `.cursorrules` (Cursor auto-reads this file)

---

## 🧠 Project Context

**ALWAYS read these files at the start of a new chat:**

1. **`PROJECT-MEMORY.md`** - Complete project history, architecture, and context
2. **`bug-journal.md`** - All 19 bugs encountered and their solutions
3. **`DECISIONS.md`** - Architecture decision records (when created)

These files contain everything you need to understand the project's history, technical choices, and common pitfalls.

---

## 👤 Developer Profile

**Name:** Donson  
**Title:** AI-Augmented Full-Stack Developer  
**Experience:** Bootcamp graduate with JavaScript certifications  
**Development Style:**
- Methodical and systematic
- Values best practices and security
- Builds "brick by brick" (incremental, focused approach)
- Documents everything (bug journals, decision records)
- Tests in Docker (production-like environment)

**AI Collaboration Preferences:**
- Concise explanations (not verbose)
- Verification steps included
- Systematic debugging approach
- Learn from bugs (document them)
- Reach 100% completion before moving to next feature

---

## 🎯 Core Principles

### 1. Always Verify Before Suggesting Fixes

**Don't guess. Verify.**

```bash
# Check TypeScript types
pnpm tsc --noEmit

# Test in Docker (not just locally)
docker compose logs api --tail=50
docker compose exec api env | grep DATABASE_URL

# Run the actual failing command
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. Document Everything

- **After fixing a bug:** Add to `bug-journal.md` with error, cause, solution
- **After major changes:** Update `PROJECT-MEMORY.md`
- **Architecture decisions:** Document in `DECISIONS.md` (when created)
- **Code comments:** Clear and helpful, explain WHY not WHAT

### 3. Follow Existing Patterns

**Reference file:** `apps/api/src/routes/auth.ts`

Look at existing code before creating new code:
- Error handling style
- Validation patterns (Zod `.safeParse()`)
- Response formats
- Import organization
- Route structure

### 4. Test in Production-Like Environment

**Docker is truth. Local is a lie.**

- Changes must work in Docker containers
- Verify environment variables inside containers
- Check logs with `docker compose logs`
- Test with `curl` from host machine
- Rebuild images when things are weird

---

## 💻 Coding Standards

### TypeScript Best Practices

```typescript
// ✅ DO: Use explicit types
const user: { id: string; email: string } = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true }
});

// ✅ DO: Use Zod for validation
const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
const parsed = Body.safeParse(req.body);
if (!parsed.success) {
  return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
}

// ✅ DO: Use .js extensions (NodeNext module resolution)
import { dryftQueue } from "../queue.js";
import { authenticate, getUserId } from "../auth.js";

// ❌ DON'T: Use .ts extensions
import { dryftQueue } from "../queue.ts"; // WILL FAIL

// ❌ DON'T: Skip error handling
await prisma.user.create({ data }); // What if it fails?

// ❌ DON'T: Use any without reason
const user: any = await prisma.user.findUnique(...); // Loses type safety
```

### Error Handling Patterns

```typescript
// ✅ DO: Return structured errors with proper status codes
if (!site) {
  return reply.code(404).send({ error: "site_not_found" });
}

if (!parsed.success) {
  return reply.code(400).send({ 
    error: "invalid_request", 
    details: parsed.error.flatten() 
  });
}

// ✅ DO: Use try-catch for database operations
try {
  const user = await prisma.user.create({
    data: { email: parsed.data.email, password: hashedPassword }
  });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return reply.code(409).send({ error: "email_already_exists" });
    }
  }
  throw err; // Let global error handler catch it
}

// ❌ DON'T: Throw raw errors to client
throw new Error("Something went wrong"); // Exposes internals, no status code

// ❌ DON'T: Return stack traces to client
return reply.code(500).send({ error: err.stack }); // SECURITY ISSUE
```

### Database (Prisma) Patterns

```typescript
// ✅ DO: Select only needed fields
const site = await prisma.site.findUnique({
  where: { id },
  select: { id: true, name: true, url: true }
});

// ✅ DO: Include user ownership checks (prevent unauthorized access)
const site = await prisma.site.findFirst({
  where: { 
    id: siteId, 
    userId // From getUserId(req)
  },
  select: { id: true, url: true }
});

// ✅ DO: Use transactions for related operations
await prisma.$transaction([
  prisma.site.update({ where: { id }, data: { ... } }),
  prisma.uptimeEvent.create({ data: { ... } })
]);

// ❌ DON'T: Fetch all fields unnecessarily
const site = await prisma.site.findUnique({ where: { id } }); // Gets everything

// ❌ DON'T: Skip user ownership checks
const site = await prisma.site.findUnique({ where: { id } }); // Any user can access!
```

### Authentication Patterns

```typescript
// ✅ DO: Use authenticate middleware on protected routes
app.post("/sites", { preHandler: authenticate }, async (req, reply) => {
  const userId = getUserId(req); // Extract from JWT
  
  const site = await prisma.site.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      userId // Include for ownership
    }
  });
  
  return reply.code(201).send({ site });
});

// ✅ DO: Check user ownership in queries
const site = await prisma.site.findFirst({
  where: { id: siteId, userId }
});

// ❌ DON'T: Skip authentication on user-specific routes
app.post("/sites", async (req, reply) => {
  // Missing preHandler: authenticate!
  // Any unauthenticated user can access this
});

// ❌ DON'T: Trust user-provided IDs without ownership check
const site = await prisma.site.findUnique({ where: { id: req.body.userId } });
// User can pass ANY userId and access other users' data!
```

---

## 🔧 Development Workflow

### After Schema Changes

**CRITICAL:** Prisma Client must be regenerated in ALL places.

```bash
# 1. Generate migration (creates SQL and updates migration history)
docker compose exec api pnpm prisma migrate dev --name <descriptive_name>

# 2. Regenerate Prisma Client in API container
docker compose exec api npx prisma generate

# 3. Regenerate Prisma Client in Worker container
docker compose exec worker npx prisma generate

# 4. Regenerate Prisma Client locally (for IDE type checking)
pnpm prisma generate --schema=apps/api/prisma/schema.prisma

# 5. Restart TypeScript server in IDE
# (Cmd+Shift+P -> "TypeScript: Restart TS Server")
```

**Why all these steps?**
- API needs updated types to access new models
- Worker needs updated types to access new models
- Local IDE needs updated types for intellisense
- Each runs its own Prisma Client instance

### Debugging Checklist

When encountering an error, follow this systematic approach:

- [ ] **Read FULL error message** (not just first line, scroll to see stack trace)
- [ ] **Check if it's IDE cache** (restart TypeScript server, reload window)
- [ ] **Verify in Docker container** (not just locally - `docker compose logs`)
- [ ] **Check container logs:** `docker compose logs <service> --tail=50 -f`
- [ ] **Verify environment variables:** `docker compose exec <service> env | grep <VAR>`
- [ ] **Check if Prisma Client is up to date** (`npx prisma generate`)
- [ ] **Check migration status:** `docker compose exec api pnpm prisma migrate status`
- [ ] **Try rebuilding Docker image** (nuclear option when nothing else works)

### Before Committing Code

- [ ] **Run type check:** `pnpm tsc --noEmit` (no TypeScript errors)
- [ ] **Remove debug statements:** No `console.log` in API (use Fastify logger)
- [ ] **Check .env files are gitignored** (`git status` should not show `.env`)
- [ ] **Update documentation** (README, PROJECT-MEMORY, etc.)
- [ ] **Test in Docker environment** (not just locally)
- [ ] **Add bug to bug-journal.md** if one was fixed
- [ ] **Write clear commit message** (use conventional commits format)

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Property X does not exist on PrismaClient"

**Symptoms:**
```typescript
Property 'siteCheck' does not exist on type 'PrismaClient<...>'
```

**Root Cause:** Stale Prisma Client - schema changed but client not regenerated

**Fix:**
```bash
# In containers
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate

# Locally (for IDE)
pnpm prisma generate --schema=apps/api/prisma/schema.prisma

# Restart TypeScript server in IDE
```

---

### Issue: "Cannot find module '../X.js'"

**Symptoms:**
```typescript
Cannot find module '../queue.js' or its corresponding type declarations.
```

**Root Cause:** IDE cache issue OR wrong import extension

**Fix:**
```bash
# 1. Verify extension is .js (not .ts)
import { dryftQueue } from "../queue.js"; // ✅ Correct

# 2. Run type check
pnpm tsc --noEmit  # If no errors, it's IDE cache

# 3. Restart TypeScript server in IDE
```

---

### Issue: "Type 'Redis' is not assignable to type 'ConnectionOptions'"

**Symptoms:**
```
Type 'Redis' is not assignable to type 'ConnectionOptions'.
ioredis@5.9.1 vs ioredis@5.8.2
```

**Root Cause:** Version mismatch between project's ioredis and BullMQ's expected version

**Fix:**
```typescript
// Use type assertion (documented workaround)
export const dryftQueue = new Queue(QUEUE_NAME, { 
  connection: connection as any 
});

export const worker = new Worker(QUEUE_NAME, async (job) => { ... }, {
  connection: connection as any
});
```

---

### Issue: "relation already exists" (Prisma migration error)

**Symptoms:**
```
Error: P3006
Migration failed to apply cleanly to the shadow database.
Error: ERROR: relation "Site" already exists
```

**Root Cause:** Migration history out of sync with actual database state

**Fix (nuclear option):**
```bash
# 1. Drop all tables manually
docker compose exec postgres psql -U dryft -d dryft -c "DROP TABLE IF EXISTS \"SiteCheck\", \"Site\", \"User\", \"_prisma_migrations\" CASCADE;"

# 2. Remove old migrations
rm -rf apps/api/prisma/migrations/*

# 3. Rebuild Docker images (clear cache)
docker compose build api
docker compose up -d api

# 4. Create fresh migration
docker compose exec api pnpm prisma migrate dev --name init

# 5. Regenerate Prisma Client everywhere
docker compose exec api npx prisma generate
docker compose exec worker npx prisma generate
pnpm prisma generate --schema=apps/api/prisma/schema.prisma
```

---

### Issue: Worker job fails with "Cannot read properties of undefined"

**Symptoms:**
```
[worker] failed {
  id: '3',
  err: "Cannot read properties of undefined (reading 'create')"
}
```

**Root Cause:** Prisma Client not regenerated in worker after schema changes

**Fix:**
```bash
docker compose exec worker npx prisma generate
docker compose restart worker
```

---

## 🚨 Security Rules

### NEVER Do These Things

- ❌ **Commit `.env` files** - Contains secrets, always gitignored
- ❌ **Hardcode credentials** - Use environment variables
- ❌ **Skip input validation** - Always validate user inputs with Zod
- ❌ **Return raw database errors** - Use structured error responses
- ❌ **Store passwords in plaintext** - Always hash with Argon2
- ❌ **Skip rate limiting** - Public endpoints must be rate limited
- ❌ **Trust user-provided IDs** - Always check ownership
- ❌ **Use `eval()` or similar** - Arbitrary code execution risk
- ❌ **Log sensitive data** - No passwords, tokens in logs

### ALWAYS Do These Things

- ✅ **Use JWT for authentication** - 7-day expiration
- ✅ **Hash passwords with Argon2** - Industry standard
- ✅ **Validate ALL inputs with Zod** - Type-safe validation
- ✅ **Add rate limiting to routes** - Prevent abuse
- ✅ **Check user ownership** - `userId` in where clauses
- ✅ **Use HTTPS in production** - Encrypt in transit
- ✅ **Set proper CORS origins** - `ALLOWED_ORIGINS` env var
- ✅ **Use parameterized queries** - Prisma does this automatically
- ✅ **Sanitize error messages** - No stack traces to client

---

## 📝 File Conventions

### Naming Standards

**Routes:** `apps/api/src/routes/<resource>.ts`
- Lowercase, plural
- Examples: `auth.ts`, `sites.ts`, `checks.ts`

**Utilities:** `apps/api/src/<utility>.ts`
- Lowercase, singular
- Examples: `db.ts`, `env.ts`, `queue.ts`, `auth.ts`

**Documentation:** `UPPERCASE-NAME.md`
- Examples: `README.md`, `PROJECT-MEMORY.md`, `DECISIONS.md`

### Route File Structure

```typescript
// 1. Type imports first
import type { FastifyInstance } from "fastify";

// 2. Package imports
import { z } from "zod";

// 3. Local imports (with .js extension)
import { prisma } from "../db.js";
import { authenticate, getUserId } from "../auth.js";

// 4. Zod schemas at top of file
const CreateBody = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url()
});

const Params = z.object({
  id: z.string().cuid()
});

// 5. Route registration function
export async function sitesRoutes(app: FastifyInstance) {
  // GET route
  app.get("/sites", { preHandler: authenticate }, async (req, reply) => {
    const userId = getUserId(req);
    // Handler logic
  });

  // POST route
  app.post("/sites", { preHandler: authenticate }, async (req, reply) => {
    const userId = getUserId(req);
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ 
        error: "invalid_request", 
        details: parsed.error.flatten() 
      });
    }
    // Handler logic
  });
}
```

---

## 🎯 Response Style Preferences

### Explanations

**DO:**
- ✅ Be concise and to the point
- ✅ Include verification steps (`tsc --noEmit`, `curl` tests)
- ✅ Show before/after code snippets
- ✅ Explain **WHY**, not just **WHAT**
- ✅ Reference past bugs from `bug-journal.md` if relevant

**DON'T:**
- ❌ Write long-winded explanations
- ❌ Repeat yourself unnecessarily
- ❌ Assume user knows everything
- ❌ Skip verification commands

### Problem Solving Approach

**DO:**
- ✅ Read error messages carefully (full text)
- ✅ Check `bug-journal.md` for similar past issues
- ✅ Suggest specific, testable fixes
- ✅ Provide commands to verify the fix worked
- ✅ Ask clarifying questions if needed

**DON'T:**
- ❌ Guess if you can verify
- ❌ Suggest workarounds before trying proper fix
- ❌ Make assumptions about environment
- ❌ Skip checking Docker logs

### Code Changes

**DO:**
- ✅ Show full context (imports, exports, surrounding code)
- ✅ Use inline comments for clarity
- ✅ Follow existing code style EXACTLY
- ✅ Test changes in Docker before marking complete
- ✅ Explain what changed and why

**DON'T:**
- ❌ Change formatting/style unnecessarily
- ❌ Remove existing comments without reason
- ❌ Introduce new patterns without discussion
- ❌ Make breaking changes without warning

---

## 🔄 Development Phases

### Current Phase: Documentation (Brick 1)

**Status:** In Progress  
**Goals:**
- ✅ Complete PROJECT-MEMORY.md (done)
- ✅ Complete bug-journal.md (done)
- ✅ Complete CURSOR-RULES.md (done)
- ⏳ Complete README.md
- ⏳ Create .env.example files (infra, api, worker)
- ⏳ Document all API endpoints
- ⏳ First GitHub commit

**Rules for this phase:**
- No new features yet
- Focus on documentation quality
- Make setup instructions crystal clear
- Assume reader has basic Docker knowledge

---

### Next Phase: Scheduled Checks (Brick 2)

**Status:** Not Started  
**Will include:**
- Cron-based check scheduling (BullMQ repeat jobs)
- Per-site interval configuration (5min, 15min, 30min)
- Auto-start scheduling on site creation
- Auto-stop scheduling on site deletion
- Update worker to handle scheduled vs on-demand checks

**Prerequisites:**
- Brick 1 must be 100% complete
- All documentation committed to GitHub
- Clean working directory (`git status`)

---

### Future Phases

See `PROJECT-MEMORY.md` section "Future Development Roadmap" for:
- Brick 3: Uptime State Management
- Brick 4: Check History API
- Brick 5: Alerting System
- Brick 6: Frontend Dashboard
- Brick 7: Advanced Features (SARA AI, rendered checks, multi-region)

---

## 🧪 Testing Guidelines

### Manual Testing Commands

```bash
# 1. Health check
curl http://localhost:3002/health
# Expected: {"status":"ok"}

# 2. Register user
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: {"token":"...", "user":{"id":"...","email":"test@example.com"}}

# Save token to variable
export TOKEN="<paste_token_here>"

# 3. Login
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: {"token":"...", "user":{"id":"...","email":"test@example.com"}}

# 4. Create site
curl -X POST http://localhost:3002/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Example Site","url":"https://example.com"}'
# Expected: {"site":{"id":"...","name":"Example Site","url":"https://example.com",...}}

# Save site ID to variable
export SITE_ID="<paste_site_id_here>"

# 5. List sites
curl http://localhost:3002/sites \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"sites":[...],"hasMore":false,"nextCursor":null}

# 6. Trigger check
curl -X POST http://localhost:3002/sites/$SITE_ID/check \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"jobId":"1"}

# 7. Check worker logs
docker compose logs worker --tail=20
# Expected: [worker] completed { id: '1', name: 'check_site', ... }

# 8. Query database to see check result
docker compose exec postgres psql -U dryft -d dryft \
  -c "SELECT * FROM \"SiteCheck\" ORDER BY \"createdAt\" DESC LIMIT 1;"
```

---

## 📊 Architecture Patterns

### Job Queue Pattern (BullMQ)

**API Side (Enqueue):**
```typescript
// apps/api/src/routes/checks.ts
app.post("/sites/:id/check", { preHandler: authenticate }, async (req, reply) => {
  const userId = getUserId(req);
  const siteId = parsed.data.id;

  // Verify ownership
  const site = await prisma.site.findFirst({
    where: { id: siteId, userId },
    select: { id: true }
  });

  if (!site) {
    return reply.code(404).send({ error: "site_not_found" });
  }

  // Enqueue job (non-blocking)
  const job = await dryftQueue.add("check_site", { siteId });

  // Return immediately (job runs in background)
  return reply.code(202).send({ jobId: job.id });
});
```

**Worker Side (Process):**
```typescript
// apps/worker/src/processor.ts
export const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { siteId } = job.data;

    // Fetch site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, url: true }
    });

    if (!site) throw new Error("site_not_found");

    // Perform check
    const startTime = Date.now();
    const response = await fetch(site.url, { 
      method: "HEAD",
      signal: AbortSignal.timeout(10000)
    });
    const durationMs = Date.now() - startTime;

    // Store result
    await prisma.siteCheck.create({
      data: {
        siteId,
        status: response.ok ? "SUCCESS" : "ERROR",
        httpStatus: response.status,
        finalUrl: response.url,
        durationMs
      }
    });

    return { status: "SUCCESS", durationMs };
  },
  { connection: connection as any, concurrency: env.WORKER_CONCURRENCY }
);
```

---

### Authentication Pattern (JWT)

**Setup (server.ts):**
```typescript
import jwt from "@fastify/jwt";

await app.register(jwt, {
  secret: env.JWT_SECRET
});
```

**Middleware (auth.ts):**
```typescript
export async function authenticate(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

export function getUserId(request: FastifyRequest): string {
  const user = request.user as { sub: string; email: string };
  if (!user || !user.sub) {
    throw Object.assign(new Error("User not authenticated"), { statusCode: 401 });
  }
  return user.sub;
}
```

**Usage (routes):**
```typescript
// Login endpoint (issues token)
app.post("/auth/login", async (req, reply) => {
  // Verify password...
  const token = app.jwt.sign(
    { sub: user.id, email: user.email },
    { expiresIn: "7d" }
  );
  return reply.send({ token, user });
});

// Protected endpoint
app.get("/sites", { preHandler: authenticate }, async (req, reply) => {
  const userId = getUserId(req);
  const sites = await prisma.site.findMany({ where: { userId } });
  return reply.send({ sites });
});
```

---

### Pagination Pattern (Cursor-based)

```typescript
const Query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional()
});

app.get("/sites", { preHandler: authenticate }, async (req, reply) => {
  const userId = getUserId(req);
  const parsed = Query.safeParse(req.query);
  if (!parsed.success) {
    return reply.code(400).send({ 
      error: "invalid_request", 
      details: parsed.error.flatten() 
    });
  }

  const { limit, cursor } = parsed.data;

  // Fetch one extra to check if there are more
  const sites = await prisma.site.findMany({
    where: { userId },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" }
  });

  const hasMore = sites.length > limit;
  if (hasMore) sites.pop(); // Remove extra item

  return reply.send({
    sites,
    hasMore,
    nextCursor: hasMore ? sites[sites.length - 1].id : null
  });
});
```

---

## 🎓 Learning Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **Fastify Docs:** https://fastify.dev
- **BullMQ Docs:** https://docs.bullmq.io
- **Zod Docs:** https://zod.dev
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/
- **Docker Compose:** https://docs.docker.com/compose/

**Internal Resources:**
- `bug-journal.md` - Real-world debugging examples (19 bugs solved)
- `PROJECT-MEMORY.md` - Complete project context and history

---

## 🚀 Quick Reference

### Environment Variables

**API (`apps/api/.env`):**
```bash
NODE_ENV=development
API_PORT=3002
DATABASE_URL=postgresql://dryft:secure123@postgres:5432/dryft
REDIS_URL=redis://:secure123@redis:6379
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ALLOWED_ORIGINS=http://localhost:3000
```

**Worker (`apps/worker/.env`):**
```bash
NODE_ENV=development
DATABASE_URL=postgresql://dryft:secure123@postgres:5432/dryft
REDIS_URL=redis://:secure123@redis:6379
WORKER_CONCURRENCY=10
```

**Infrastructure (`infra/.env`):**
```bash
POSTGRES_USER=dryft
POSTGRES_PASSWORD=secure123
POSTGRES_DB=dryft
REDIS_PASSWORD=secure123
```

---

### Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 5432 | PostgreSQL 16 database |
| `redis` | (internal) | Redis 7 for job queue |
| `api` | 3002 | Fastify REST API |
| `worker` | (none) | BullMQ background worker |

---

### Useful Commands

```bash
# Type check all workspaces
pnpm tsc --noEmit

# Start all services
cd infra && docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f worker

# Check service health
docker compose ps
curl http://localhost:3002/health

# Prisma commands (in container)
docker compose exec api pnpm prisma migrate dev --name <name>
docker compose exec api npx prisma generate
docker compose exec api pnpm prisma studio

# Database access
docker compose exec postgres psql -U dryft -d dryft

# Fresh Docker rebuild (nuclear option)
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Check environment in container
docker compose exec api env | grep DATABASE_URL
docker compose exec worker env | grep REDIS_URL

# Restart specific service
docker compose restart api
docker compose restart worker
```

---

## 💡 Final Reminders

### For Every New Chat

1. ✅ Read `PROJECT-MEMORY.md` first
2. ✅ Check `bug-journal.md` if encountering errors
3. ✅ Reference these rules when uncertain
4. ✅ Test in Docker, not just locally
5. ✅ Document new bugs after fixing

### Development Philosophy

**"Brick by brick, best practices first."**

- Complete current phase 100% before starting next
- Document everything (bugs, decisions, memory)
- Test thoroughly in Docker
- Focus on security and correctness
- Build incrementally, commit frequently

### Remember

**This project uses AI-augmented development workflows.**

You (AI assistant) are a **coding partner**, not just a code generator.

**Focus on:**
- Architecture and design
- Debugging and problem-solving
- Best practices and security
- Clear explanations
- Verification and testing

**Donson handles:**
- Direction and goals
- Business logic decisions
- Final validation
- Git commits

**Together, we ship production-ready code.** 🚀

---

**End of Cursor Rules**

*Last updated: 2026-01-13*
