# Mizan ERP

Multi-tenant SaaS ERP for MENA — MVP.

## Prerequisites

- Node.js >= 20.11
- pnpm >= 9
- Docker Desktop
- (Optional) PowerShell 7 for the dev workflow on Windows

## Quick Start

```bash
# 1. Clone + install
git clone <repo-url> mizan-erp
cd mizan-erp
pnpm install

# 2. Environment
cp .env.example .env
# Edit .env — set POSTGRES_*_PASSWORD, REDIS_PASSWORD, JWT secrets.
# Generate secrets:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Boot infra
pnpm docker:up

# 4. Build shared package (required before running the API)
pnpm --filter @mizan/shared build

# 5. Migrate + seed + RLS
pnpm db:generate
pnpm --filter @mizan/api prisma migrate dev --name init
pnpm db:rls
pnpm db:seed

# 6. Dev
pnpm dev

# API:     http://localhost:4000/api/v1
# Swagger: http://localhost:4000/docs
```

## Tests

```bash
pnpm --filter @mizan/api test          # unit
pnpm --filter @mizan/api test:e2e      # e2e (creates a test DB)
```

## Rules

- Never trust a `tenantId` from a request. It comes from the JWT only.
- Every tenant-scoped query MUST go through `PrismaService.withTenant()`.
- All DTOs live in `@mizan/shared` so FE and BE stay in sync.