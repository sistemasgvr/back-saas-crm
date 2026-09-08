# Backend NestJS — EasyPanel / Docker
# Build: npm run build → dist/main.js (webpack) + Prisma Client
# Puerto: EasyPanel inyecta PORT; local default 4000.

# ── Stage 1: build ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

# bcrypt (nativo) + OpenSSL (Prisma)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build \
  && npm prune --omit=dev

# ── Stage 2: runtime ───────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nestjs \
  && useradd --system --uid 1001 --gid nestjs nestjs

ENV NODE_ENV=production

COPY --from=builder --chown=nestjs:nestjs /usr/src/app/package.json ./
COPY --from=builder --chown=nestjs:nestjs /usr/src/app/package-lock.json ./
COPY --from=builder --chown=nestjs:nestjs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nestjs:nestjs /usr/src/app/dist ./dist

USER nestjs

# EasyPanel / proxies suelen mapear este puerto; el proceso usa process.env.PORT
EXPOSE 4000

CMD ["node", "dist/main.js"]
