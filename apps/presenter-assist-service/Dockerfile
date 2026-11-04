# Build from the repository root: the app depends on the pnpm workspace
# (libs/*, the lockfile, turbo.json), so an isolated subdirectory build cannot
# resolve its own dependencies. Deferred post-MVP; not part of the Render
# blueprint.
#
#   docker build -f apps/presenter-assist-service/Dockerfile .

# ---- Build -----------------------------------------------------------------
FROM node:20-alpine AS builder

# node:20-alpine ships no pnpm.
RUN corepack enable && corepack prepare pnpm@8.6.0 --activate

WORKDIR /usr/src/app

# Manifests first, so a source change does not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/presenter-assist-service/package.json ./apps/presenter-assist-service/
COPY libs/internal-shared/package.json ./libs/internal-shared/
COPY libs/kafka-contracts/package.json ./libs/kafka-contracts/
COPY libs/shared-auth/package.json ./libs/shared-auth/
COPY libs/shared-types/package.json ./libs/shared-types/

# --prod=false keeps devDependencies (turbo, @nestjs/cli) available for the
# build even if NODE_ENV is set to production in the build environment.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

RUN pnpm build --filter=presenter-assist-service

# ---- Run -------------------------------------------------------------------
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
# KAFKA_CA_CERT points at /usr/src/app/certs/aiven-kafka-ca.pem in the image.
COPY --from=builder /usr/src/app/certs ./certs
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/libs ./libs
COPY --from=builder /usr/src/app/apps/presenter-assist-service ./apps/presenter-assist-service

# Render's free plan has no pre-deploy command, so the entrypoint applies any
# Prisma migrations before starting the process (this scaffold has none yet).
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN tr -d '\r' < /usr/local/bin/entrypoint.sh > /tmp/entrypoint.sh \
    && mv /tmp/entrypoint.sh /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

WORKDIR /usr/src/app/apps/presenter-assist-service

EXPOSE 3005

CMD ["node", "dist/main.js"]
