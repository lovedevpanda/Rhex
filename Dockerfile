ARG NEXT_ASSET_PREFIX="https://rhex-runtime-asset-prefix.invalid"
ARG NEXT_DEPLOYMENT_ID
ARG NODE_IMAGE=node:20-bookworm-slim

FROM ${NODE_IMAGE} AS base

ARG APT_MIRROR
ARG PNPM_REGISTRY

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable \
  && if [ -n "${PNPM_REGISTRY}" ]; then \
    npm config set registry "${PNPM_REGISTRY}" \
    && export COREPACK_NPM_REGISTRY="${PNPM_REGISTRY}"; \
  fi \
  && corepack prepare pnpm@10.33.4 --activate \
  && if [ -n "${APT_MIRROR}" ]; then \
    sed -i "s|http://deb.debian.org/debian|${APT_MIRROR}|g; s|http://deb.debian.org/debian-security|${APT_MIRROR}-security|g" /etc/apt/sources.list.d/debian.sources; \
  fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder

ARG NEXT_ASSET_PREFIX
ARG NEXT_DEPLOYMENT_ID
ARG PNPM_REGISTRY
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

RUN mkdir -p addons

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma

RUN if [ -n "${PNPM_REGISTRY}" ]; then pnpm config set registry "${PNPM_REGISTRY}"; fi \
  && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run prisma:generate
RUN pnpm run build
RUN node scripts/verify-docker-build.mjs

FROM base AS runner

ARG NEXT_DEPLOYMENT_ID

ENV NODE_ENV=production
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/momofa/rhex-custom"

RUN mkdir -p uploads addons

COPY --from=builder /app/node_modules ./node_modules
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
