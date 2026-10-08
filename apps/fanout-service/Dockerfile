# Stage 1: Build the application
FROM node:18-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package manifests
COPY apps/fanout-service/package.json ./apps/fanout-service/

COPY libs/internal-shared/package.json ./libs/internal-shared/
COPY libs/kafka-contracts/package.json ./libs/kafka-contracts/
COPY libs/shared-auth/package.json ./libs/shared-auth/
COPY libs/shared-types/package.json ./libs/shared-types/

# Install dependencies
RUN --mount=type=cache,id=16102cad-dc65-47ee-9e06-3bd4368fa325-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build fanout service
RUN pnpm build --filter=fanout-service


# Stage 2: Production image
FROM node:18-alpine AS production

WORKDIR /usr/src/app

# Copy workspace dependencies
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy the fanout service
COPY --from=builder /usr/src/app/apps/fanout-service ./apps/fanout-service

# Copy workspace libraries required at runtime
COPY --from=builder /usr/src/app/libs ./libs

# Start from the fanout service directory
WORKDIR /usr/src/app/apps/fanout-service

EXPOSE 3004

CMD ["node", "dist/main.js"]