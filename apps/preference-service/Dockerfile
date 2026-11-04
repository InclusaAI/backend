# Build from the repository root: the app depends on the pnpm workspace
# (libs/*, the lockfile, turbo.json), so an isolated subdirectory build cannot
# resolve its own dependencies.
#
#   docker build -f apps/preference-service/Dockerfile .

# ---- Build -----------------------------------------------------------------
FROM node:20-alpine AS builder

# Prisma resolves its query engine against the OpenSSL version at
# install/generate time. The production stage installs OpenSSL 3, so install it
# here as well or the generated client targets an engine the runtime lacks.
RUN apk add --no-cache openssl

# node:20-alpine ships no pnpm.
RUN corepack enable && corepack prepare pnpm@8.6.0 --activate

WORKDIR /usr/src/app

# Manifests first, so a source change does not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/preference-service/package.json ./apps/preference-service/
COPY libs/internal-shared/package.json ./libs/internal-shared/
COPY libs/kafka-contracts/package.json ./libs/kafka-contracts/
COPY libs/shared-auth/package.json ./libs/shared-auth/
COPY libs/shared-types/package.json ./libs/shared-types/

# --prod=false keeps devDependencies (turbo, @nestjs/cli, prisma) available for
# the build even if NODE_ENV is set to production in the build environment.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# turbo builds the libraries first (build depends on ^build) and runs
# `prisma generate` first (build depends on db:generate), so the service-local
# client in generated/prisma exists afterwards.
RUN pnpm build --filter=preference-service

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
COPY --from=builder /usr/src/app/apps/preference-service ./apps/preference-service

# Render's free plan has no pre-deploy command, so the entrypoint applies this
# service's Prisma migrations before starting the process.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN tr -d '\r' < /usr/local/bin/entrypoint.sh > /tmp/entrypoint.sh \
    && mv /tmp/entrypoint.sh /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

WORKDIR /usr/src/app/apps/preference-service

EXPOSE 3003

CMD ["node", "dist/main.js"]
