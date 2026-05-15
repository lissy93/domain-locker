# syntax=docker/dockerfile:1.7

# Stage 1 - build: install all dependencies and compile the app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests + npm config for reproducible installs
COPY package.json package-lock.json .npmrc ./

# Install deps with a BuildKit cache mount so re-runs reuse the npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy source and build the production bundle
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV DL_ENV_TYPE="selfHosted"
RUN npm run build && test -f dist/analog/server/index.mjs

# Drop devDependencies in place so node_modules can be copied to runner as-is
RUN --mount=type=cache,target=/root/.npm \
    npm prune --omit=dev

# Strip esbuild (it's build-time only, and there's a CVE)
RUN find node_modules \( -type d -name '@esbuild' -o -type d -name 'esbuild' \) \
        -prune -exec rm -rf {} + && \
    find node_modules -type l -name esbuild -exec rm -f {} +

# Stage 2 - runner: minimal image to serve the app
FROM node:20-alpine AS runner

# Postgres client for schema/init, whois for app lookups, wget for healthcheck
RUN apk add --no-cache postgresql-client whois wget

# Non-root app user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# Pull build output and pruned deps from builder
COPY --chown=appuser:appgroup --from=builder /app/dist          ./dist
COPY --chown=appuser:appgroup --from=builder /app/node_modules  ./node_modules
COPY --chown=appuser:appgroup --from=builder /app/package.json  ./package.json
COPY --chown=appuser:appgroup --from=builder /app/db/schema.sql ./schema.sql
COPY --chown=appuser:appgroup --from=builder /app/start.sh      ./start.sh

USER appuser
EXPOSE 3000
ENV DL_ENV_TYPE="selfHosted"

HEALTHCHECK --interval=15s --timeout=2s --start-period=5s --retries=5 \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1

# start.sh waits for Postgres, applies schema, then starts the app server.
# To skip init and start directly: node ./dist/analog/server/index.mjs
CMD ["./start.sh"]
