# syntax=docker/dockerfile:1

# ---------- dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    STANDALONE=1
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

RUN addgroup -S node -g 1001 \
  && adduser -S nextjs -u 1001 \
  && mkdir -p /app/data \
  && chown -R nextjs:node /app/data

COPY --from=builder --chown=nextjs:node /app/.next/standalone ./
COPY --from=builder --chown=nextjs:node /app/public ./public
COPY --from=builder --chown=nextjs:node /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:node /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
