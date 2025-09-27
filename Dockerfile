# Multi-stage Dockerfile for Bun + Fastify app

# 1) Builder stage: install deps and build
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Install dependencies first (leverages layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and configuration files
COPY src/ ./src/
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY drizzle/ ./drizzle/

# Build to dist/ using your package.json script
RUN bun run build

# 2) Runtime stage: minimal runtime with only what we need
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=8081 \
    HOST=0.0.0.0

# Copy package.json and lockfile for dependency resolution
COPY package.json bun.lock ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy any runtime assets/templates if they exist
COPY --from=builder /app/src/templates ./src/templates

EXPOSE 8081

# Container healthcheck hitting your health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8081/health || exit 1

# Start the app using your package.json "start" script
CMD ["bun", "run", "start"]
