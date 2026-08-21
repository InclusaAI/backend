# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Copy root package.json and pnpm lockfile
COPY package.json pnpm-lock.yaml ./

# Copy application-specific package.json
COPY apps/fanout-service/package.json ./apps/fanout-service/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the monorepo source code
COPY . .

# Build the application
RUN pnpm build --filter=fanout-service

# Stage 2: Create the production image
FROM node:18-alpine AS production
WORKDIR /usr/src/app

# Copy production dependencies from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/apps/fanout-service/node_modules ./apps/fanout-service/node_modules
COPY --from=builder /usr/src/app/dist/apps/fanout-service ./dist

# Expose the application port
EXPOSE 3004

# Start the application
CMD ["node", "dist/main.js"]