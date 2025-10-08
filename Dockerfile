# Multi-stage Dockerfile for ServiceDesk
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies with frozen lockfile
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl \
    ca-certificates

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create directories for SQLite database with proper permissions
RUN mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data

# Copy database schema and initialization scripts
COPY --chown=nextjs:nodejs lib/db/schema.sql ./lib/db/schema.sql
COPY --chown=nextjs:nodejs lib/db/init.ts ./lib/db/init.ts

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "server.js"]

# Metadata
LABEL maintainer="ServiceDesk Team"
LABEL version="1.0"
LABEL description="ServiceDesk Application - Production Ready"
LABEL org.opencontainers.image.source="https://github.com/your-org/servicedesk"
