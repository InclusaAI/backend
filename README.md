# backend
The core application backend for InclusaAI. This repository contains the primary business/domain services and API entry points.

## Architecture

This repository is a monorepo managed by [Turborepo](https://turbo.build/) and [pnpm workspaces](https://pnpm.io/workspaces). It contains multiple, independently deployable NestJS applications.

### Workspace Choice

We use Turborepo for its high-performance build system and its seamless integration with pnpm workspaces. This combination allows us to maintain a single repository for all our backend services while ensuring that each service can be built, tested, and deployed independently.

### Repository Structure

-   `apps/`: Contains the five independent NestJS applications:
    -   `identity-service`: Manages authentication, users, and organizations.
    -   `session-service`: Manages presentations and sessions.
    -   `preference-service`: Manages user accessibility preferences.
    -   `fanout-service`: Handles real-time data fan-out to clients.
    -   `presenter-assist-service`: Provides real-time assistance to presenters.
-   `libs/`: Contains shared libraries used across the monorepo.
    -   `internal-shared`: A private, non-published library for sharing code only within this repository.
-   `docs/`: Contains project documentation, including the `DEVELOPMENT-STATUS.md` file.

## Local Development

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [pnpm](https://pnpm.io/) (v8.6.0 or higher)
-   [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Installation

1.  Clone the repository.
2.  Install dependencies from the root of the repository:
    ```bash
    pnpm install
    ```

### Running the Services

To run all services in development mode, use the following command from the root of the repository:

```bash
pnpm dev
```

This will start all five NestJS applications in watch mode.

### Running the Infrastructure

The local development environment requires PostgreSQL, Redis, and Kafka. These services are managed via Docker Compose.

To start the infrastructure:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

To stop the infrastructure:

```bash
docker-compose -f docker-compose.dev.yml down
```

### Health Checks

Each service exposes a health check endpoint at `/healthz`. You can verify that a service is running by sending a GET request to its health check endpoint. For example, for the `identity-service` running on port 3001:

```bash
curl http://localhost:3001/healthz
```

## Continuous Integration

Our CI pipeline is defined in `.github/workflows/ci.yml` and uses reusable workflows from the `inclusaai-infra` repository. The pipeline validates the following for each application on every push and pull request:

-   Linting
-   Tests
-   Build
-   Security Scan

## Shared Packages

This repository uses several shared packages from the `@inclusaai` scope, which are managed as local packages within the pnpm workspace. This approach allows for type-safe, cross-service code sharing without the overhead of a private npm registry. These packages are located in the `libs/` directory.

### Versioning

All local shared packages are versioned as part of the monorepo. When a service depends on a shared package, its `package.json` should use the `workspace:*` protocol. This ensures that the service always uses the current source code of the local package.

### Upgrading

Since packages are local, there is no "upgrade" process in the traditional sense. Changes made to a shared package are immediately available to all services that depend on it after the project is rebuilt.

### Compatibility Checks

Because all packages (apps and libs) exist within the same monorepo, they share the same `node_modules`, Node.js version, and core dependencies like NestJS and TypeScript. This significantly reduces compatibility issues. The primary check is to ensure the entire workspace builds and passes tests after a change.

### Testing

Before merging a change to a shared package, you must ensure that all of the following checks pass for the entire workspace:

-   **Linting:** `pnpm lint`
-   **Tests:** `pnpm test`
-   **Build:** `pnpm build`

### Creating a New Shared Package

To create a new shared package:

1.  Create a new directory in the `libs/` folder (e.g., `libs/new-package`).
2.  In that directory, create a `package.json` file, naming the package with the `@inclusaai` scope (e.g., `"name": "@inclusaai/new-package"`).
3.  Add a `tsconfig.json` and `.eslintrc.js` file, using the existing shared packages as a template.
4.  Create a `src/index.ts` file to export the package's contents.
5.  Add the new package as a dependency to any service that needs it, using the `workspace:*` protocol in the service's `package.json`.
6.  Run `pnpm install` from the root to ensure pnpm links the new package correctly.