# mk-backend (Fastify + Bun)

Fast, typed backend powered by Fastify (Bun runtime), Drizzle ORM (Postgres), Clerk auth, and Svix webhooks.

## 1) Install dependencies

```bash
bun install
```

## 2) Configure environment

Copy `.env.example` to `.env` and fill in values:

Key variables:

- `APP_URL` — Allowed frontend origins. Multiple origins supported, comma-separated.
- `PORT` / `HOST` — Server binding.
- `DATABASE_URL` — Postgres connection (postgres-js).
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk API keys.
- `WEBHOOK_SECRET` — Svix/Clerk webhook signing secret.
- `SWAGGER_UI_ENABLED` — Set false to disable Swagger UI in production.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW` — Configure rate limiting.

## 3) Database (Drizzle ORM + Postgres)

Generate SQL and sync your database:

```bash
# Generate SQL into ./drizzle
bun run db:generate

# Apply SQL to your database
bun run db:push

# Optional: open Drizzle Studio
bun run db:studio
```

Schema sources:

- `src/db/schema/` — Drizzle schemas.
- `src/db/schema/relations.ts` — Relations between tables.
- `src/db/client.ts` — postgres-js client + Drizzle instance.

## 4) Run the server

```bash
# Elysia legacy (if still needed)
bun run dev

# Fastify server (recommended)
bun run dev:fastify
```

Default health endpoint:

```bash
curl http://localhost:8081/health
```

## 5) API docs (Swagger)

Open Swagger UI at:

```
http://localhost:8081/documentation
```

## 6) Auth & Webhooks (Clerk)

- Clerk plugin is registered globally via `@clerk/fastify`.
- Protected routes use `getAuth(request)` to access `userId`.
- Clerk webhooks (e.g., user.created) verify signatures via Svix.

## 7) Key Routes

- `GET /health` — server + DB check.
- `GET /protected` — requires Clerk bearer token.
- `POST /user/sign-up` — Clerk webhook (user.created) → creates user, sends email + SMS OTP.
- `POST /user/send-phone-otp` — send OTP (auth required).
- `POST /user/verify-phone-otp` — verify OTP (auth required).
- `GET /user/resend-phone-otp` — resend OTP (auth required).

## 8) Testing quickly

See `test/api.http` for ready-to-run examples (VS Code REST Client or JetBrains HTTP client):

- Health, Protected, User OTP flows, Webhook.

## 9) Observability

- Request IDs: `x-request-id` header set per request and included in logs.
- Structured logs via Pino (pretty transport in dev).

---

This project uses Bun. If you prefer Node, adjust scripts accordingly.
