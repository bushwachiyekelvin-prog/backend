# Single-stage Dockerfile for Bun + Fastify app (runs TypeScript directly)
FROM oven/bun:1.2-alpine
WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=8081 \
    HOST=0.0.0.0

# Install dependencies first (leverages layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and configuration files
COPY src/ ./src/
COPY tsconfig.json ./
COPY drizzle.config.ts ./

EXPOSE 8081

# Container healthcheck hitting your health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8081/health || exit 1

# Run TypeScript directly like dev (without --watch)
CMD ["bun", "run", "src/server.ts"]
