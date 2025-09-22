# Multi-stage Dockerfile for Bun + Fastify app

# 1) Builder stage: install deps and build
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Install dependencies first (leverages layer caching)
COPY package.json bun.lock ./
RUN bun install --ci

# Copy source and build
COPY . .
# Build to dist/ using your package.json script
RUN bun run build

# 2) Runtime stage: minimal runtime with only what we need
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8081 \
    HOST=0.0.0.0

# Copy only necessary files from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# If your app reads any runtime assets/templates, copy them too
# (Uncomment or add paths as needed)
# COPY --from=builder /app/src/templates ./src/templates

EXPOSE 8081

# Optional: container healthcheck hitting your health endpoint
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8081/health || exit 1

# Start the app (uses your package.json "start": "bun run dist/server.js")
CMD ["bun", "run", "start"]
