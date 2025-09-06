# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.# mk-backend

---

# Database (Drizzle ORM + Postgres)

This project uses Drizzle ORM with Postgres (via postgres-js) and Drizzle Kit for schema generation.

## 1) Install dependencies

```bash
bun install
```

## 2) Configure environment

Create a `.env` using the example below:

```
APP_URL=http://localhost:3000
PORT=8081

# Postgres connection string
# Format: postgres://USER:PASSWORD@HOST:PORT/DB_NAME
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mk_backend
```

You can copy `.env.example` and customize.

## 3) Generate SQL from schema

The schema lives in `src/db/schema/*.ts` (split by table with relations in `relations.ts`). To generate SQL and sync your database:

```bash
# Generate SQL into ./drizzle
bun run db:generate

# Apply SQL to your database
bun run db:push
```

Optional: open Drizzle Studio

```bash
bun run db:studio
```

## 4) Verify DB connectivity

Start the server and hit the DB health endpoint:

```bash
bun run dev
# in another terminal
curl http://localhost:8081/db/health
```

You should see a JSON response `{ ok: true, result: [...] }`.

## Schema files

- `src/db/schema/` — Drizzle schema for tables based on docs in `docs/model.md`.
- `src/db/schema/relations.ts` — Relations between tables.
- `src/db/client.ts` — Postgres connection and Drizzle client.
- `src/db/index.ts` — Exports for convenience.
- `drizzle.config.ts` — Drizzle Kit configuration.

The Drizzle client is fully typed by passing the aggregated schema to `drizzle()` in `src/db/client.ts`.
