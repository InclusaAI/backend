# Build from the repository root: the app depends on the pnpm workspace
# (libs/*, the lockfile, turbo.json), so an isolated subdirectory build cannot
# resolve its own dependencies.
#
#   docker build -f apps/identity-service/Dockerfile .

# ---- Build -----------------------------------------------------------------
FROM node:20-alpine AS builder

# node:20-alpine ships no pnpm.
RUN corepack enable && corepack prepare pnpm@8.6.0 --activate

WORKDIR /usr/src/app

# Manifests first, so a source change does not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/identity-service/package.json ./apps/identity-service/
COPY libs/internal-shared/package.json ./libs/internal-shared/
COPY libs/kafka-contracts/package.json ./libs/kafka-contracts/
COPY libs/shared-auth/package.json ./libs/shared-auth/
COPY libs/shared-types/package.json ./libs/shared-types/

RUN pnpm install --frozen-lockfile

COPY . .

# turbo builds the libraries first (build depends on ^build) and runs
# `prisma generate` first (build depends on db:generate), so the service-local
# client in generated/prisma exists afterwards.
RUN pnpm build --filter=identity-service

# ---- Run -------------------------------------------------------------------
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Prisma's query engine links against OpenSSL, which node:alpine does not ship.
RUN apk add --no-cache openssl

# The workspace layout is preserved: node_modules links into libs/*, and the
# app resolves its generated Prisma client from apps/<service>/generated.
COPY --from=builder /usr/src/app/node_modules ./node_modules
# KAFKA_CA_CERT points at /usr/src/app/certs/aiven-kafka-ca.pem in the image.
COPY --from=builder /usr/src/app/certs ./certs
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/libs ./libs
COPY --from=builder /usr/src/app/apps/identity-service ./apps/identity-service

WORKDIR /usr/src/app/apps/identity-service

EXPOSE 3001

CMD ["node", "dist/main.js"]
