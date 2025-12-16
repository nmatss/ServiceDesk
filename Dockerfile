# ==============================================================================
# ServiceDesk Multi-Stage Production Dockerfile
# Optimized for enterprise deployment with security, performance, and size
# Target: < 200MB final image | Build time: < 5 minutes
# ==============================================================================

# ==============================================================================
# Stage 1: Dependencies - Production node_modules only
# ==============================================================================
FROM node:20-alpine AS deps

# Set working directory
WORKDIR /app

# Install system dependencies for native modules (better-sqlite3, bcrypt, sharp)
# Only install what's absolutely necessary for production
RUN apk add --no-cache \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install production dependencies only with frozen lockfile
# Use npm ci for deterministic builds and better CI/CD performance
RUN npm ci --only=production --prefer-offline --no-audit --progress=false \
    && npm cache clean --force

# ==============================================================================
# Stage 2: Builder - Build the application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build-time dependencies (includes native module compilation tools)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy source code (respects .dockerignore)
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    SKIP_ENV_VALIDATION=1

# Build Next.js application
# The standalone output only includes necessary files
RUN npm run build

# ==============================================================================
# Stage 3: Runner - Minimal production image
# ==============================================================================
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Install only runtime dependencies
# tini: Proper PID 1 for signal handling
# dumb-init: Alternative to tini (using tini for consistency)
# curl: Health checks
# ca-certificates: HTTPS support
RUN apk add --no-cache \
    tini \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user and group for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

# Set production environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
# Next.js standalone output includes everything needed to run
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy database initialization files (for SQLite setup)
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/schema.sql ./lib/db/schema.sql
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/init.ts ./lib/db/init.ts

# Create data directories for SQLite and uploads
RUN mkdir -p /app/data /app/data/uploads \
    && chown -R nextjs:nodejs /app/data

# Switch to non-root user for security
USER nextjs

# Expose application port
EXPOSE 3000

# Health check endpoint
# Starts checking after 40s, every 30s, timeout 10s, 3 retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use tini for proper signal handling (prevents zombie processes)
ENTRYPOINT ["/sbin/tini", "--"]

# Start the Next.js production server
CMD ["node", "server.js"]

# ==============================================================================
# Metadata (OCI Labels)
# ==============================================================================
LABEL org.opencontainers.image.title="ServiceDesk" \
      org.opencontainers.image.description="Enterprise-grade service desk application" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="ServiceDesk Team" \
      org.opencontainers.image.authors="ServiceDesk Team" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.source="https://github.com/your-org/servicedesk" \
      maintainer="ServiceDesk Team"

# ==============================================================================
# Build Arguments (can be overridden at build time)
# ==============================================================================
# Example: docker build --build-arg NODE_VERSION=20.10.0 .
ARG NODE_VERSION=20
ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_BRANCH

# Set build metadata labels
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.ref.name="${GIT_BRANCH}"
