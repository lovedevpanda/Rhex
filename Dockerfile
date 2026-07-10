ARG NEXT_ASSET_PREFIX="https://rhex-runtime-asset-prefix.invalid"
ARG NEXT_DEPLOYMENT_ID

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable \
  && corepack prepare pnpm@10.33.4 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder

ARG NEXT_ASSET_PREFIX
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

RUN mkdir -p addons

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run prisma:generate \
  && pnpm run typecheck \
  && pnpm run lint \
  && pnpm run test \
  && pnpm run build

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml .npmrc ./

# tsx is a production dependency because the worker executes TypeScript directly.
RUN pnpm install --prod --frozen-lockfile

FROM base AS runner

ENV NODE_ENV=production

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/lovedevpanda/Rhex"

RUN mkdir -p uploads addons

COPY --from=production-dependencies /app/node_modules ./node_modules
# Prisma's generated client is produced in the checked builder stage.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/addons ./addons
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/write-guard.config.ts ./write-guard.config.ts

RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["pnpm", "run", "start"]
