# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev        # Start with hot reload
npm run build            # Compile TypeScript to dist/

# Code quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier format

# Testing
npm test                 # Run unit tests
npm run test:watch       # Watch mode
npm run test:cov         # With coverage
npm run test:e2e         # End-to-end tests

# Database migrations
npm run migration:generate -- src/migrations/<MigrationName>
npm run migration:run
npm run migration:revert
npm run migration:show
```

API is served at `http://localhost:4033/api/v1`. Swagger docs at `/api/docs`.

## Architecture

**Framework:** NestJS 11 with TypeORM 0.3 on PostgreSQL.

**Module structure:** Each feature follows the same pattern:

- `<feature>.module.ts` — wires dependencies
- `<feature>.controller.ts` — HTTP routes
- `<feature>.service.ts` — business logic
- `dto/` — request/response shapes (validated via class-validator)
- `entities/` — TypeORM entities
- `enums/` — shared constants

**Global setup (main.ts):**

- API prefix: `/api/v1`
- `ValidationPipe` (whitelist mode) — strips unknown fields
- `TransformInterceptor` — wraps all responses in `{ data, message, statusCode }`
- `HttpExceptionFilter` — centralized error formatting

**Key modules:**

- `auth/` — JWT + Google OAuth2; produces access/refresh tokens
- `users/` — user CRUD; refs affiliate tree structure
- `affiliate/` — affiliate program with commission tracking
- `payment/` — VNPay and MoMo gateway integration
- `pricing/` — subscription plans and user subscriptions
- `signal/` — trading signals and user favorites
- `notification/` — in-app notifications + Telegram bot
- `mail/` — Handlebars email templates (`.hbs` assets compiled into dist)
- `crawler/` — SSI stock market data ingestion
- `market/` + `company/` — market/company data endpoints
- `data-import/` — CSV import pipeline

**Data source:** `src/data-source.ts` is the TypeORM CLI config (used by migration commands). The app itself uses the config in `app.module.ts`. `synchronize` is **disabled** — always use migrations for schema changes.

**Auth guards:**

- `JwtAuthGuard` — requires valid bearer token (default on protected routes)
- `OptionalJwtAuthGuard` — attaches user if token present, allows anonymous

## Code Style

- 4-space indentation, single quotes, semicolons, max line length 200, no trailing commas
- `@typescript-eslint/no-explicit-any` is off; avoid it anyway
- Floating promises and unsafe arguments trigger ESLint warnings — always `await` or handle promises

## Environment

Copy `.env` and fill in values. Required vars: `DB_*`, `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `VNP_*`, `MOMO_*`, `MAIL_*`, `GOOGLE_*`, `SSI_*`, `AFFILIATE_*`, `APP_URL`, `FRONTEND_URL`.

## SPECS

- When I ask to change any feature, if you don't have context about that feature, please read it in @\_specs folder. If specs of that feature is not existed, generate a high-level specs for it like @\_specs/affiliate.md
- If feature have any update, also update the specs with updated time.
