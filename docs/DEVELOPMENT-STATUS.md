# Development Status

Implementation status of the InclusaAI platform-backend MVP.

**Last updated:** 2026-09-22
**Canonical spec:** [`platform-backend-IMPLEMENTATION.md`](../platform-backend-IMPLEMENTATION.md)

> This is the single source of truth for status. A second `DEVELOPMENT-STATUS.md`
> previously existed at the repo root with a conflicting issue-numbering scheme;
> it has been removed. Issue numbers below match the `feature/<n>-*` branches.

## Issue status

| Issue | Service(s) | Feature | Status |
|---|---|---|---|
| #1 | all | Monorepo scaffolding (Turborepo + pnpm) | DONE |
| #2 | `identity-service` | Auth, organizations, invitations | DONE |
| #3 | `session-service` | Presentations, sessions, join by code | DONE |
| #4 | `preference-service` | Accessibility preference CRUD | DONE — merge gated on `ai-services` sign-off of the event schema |
| #5 | `fanout-service` | Caption fan-out over WebSocket | NOT STARTED |
| #6 | `libs/*` | Shared contracts and auth | DONE |
| #7 | `presenter-assist-service` | Presenter recommendations | DEFERRED (per spec §7) |

## Verification

Run from the repo root.

| Check | Command | Result |
|---|---|---|
| Build | `pnpm build` | **PASSING** — 12/12 tasks |
| Lint | `pnpm lint` | **PASSING** — 9/9 packages, 0 errors |
| Unit tests | `pnpm test` | **PASSING** — 9 tests |
| Migrations | `pnpm --filter <svc> db:migrate` | **APPLIED** — one `init` migration per service |
| E2E tests | `pnpm --filter <svc> test:e2e` | **PASSING** — 16 tests (identity 4, session 6, preference 6) |
| Cross-service flow | manual smoke | **PASSING** — see below |

The cross-service smoke test exercises the path the realignment exists to support:
create presentation → start session → join as an authenticated participant →
`PATCH /preferences` on preference-service → `accessibility.preference.updated`
over Kafka → session-service's consumer updates that participant's row. Verified
end to end against live Postgres and Kafka.

Issue #4's first acceptance criterion is verified the same way: a participant
saves a preference, then joins two different sessions, and the saved preference
is applied on joining each. `preferences.e2e-spec.ts` covers persistence across
two login sessions and a participant's very first `PATCH` (which previously
returned 500 because no row existed yet).

`fanout-service` and `presenter-assist-service` are scaffolds with no tests; their
`test` scripts use `--passWithNoTests` so an empty suite is not reported as a failure.

## Architecture

### Database isolation (ADR-0003)

Each service owns a separate logical database on a shared Postgres instance, with
its own `prisma/schema.prisma` and its own migration history:

| Service | Database | Models |
|---|---|---|
| `identity-service` | `synapgrid-identity` | `User`, `Organization`, `OrgMembership`, `Invitation` |
| `session-service` | `synapgrid-sessions` | `Presentation`, `Session`, `SessionParticipant`, `JoinToken` |
| `preference-service` | `synapgrid-preferences` | `AccessibilityPreference` |
| `fanout-service` | none (Redis only) | — |

No cross-service foreign keys exist. `Presentation.ownerId` and
`Presentation.organizationId` reference identity-service records as plain strings;
cross-service reads go over REST or Kafka.

Each schema generates its client to a service-local `generated/prisma` directory.
This is required, not stylistic: pnpm dedupes an identical `@prisma/client`
version across packages into one physical directory, so with the default output
each service's `prisma generate` silently overwrites the previous service's
client. Import the client from `src/prisma/client.ts`, never from
`@prisma/client` directly.

### Per-participant accessibility

`SessionParticipant` carries `captionsEnabled` / `avatarEnabled` per attendee.
These were previously single booleans on `Session`, which could only describe the
presenter — two people in the same session could not have different settings.

`userId` is nullable so audience members can join by code without an account.
Postgres treats NULLs as distinct, so the `(sessionId, userId)` unique constraint
still permits many anonymous attendees while keeping signed-in attendance
idempotent across reconnects.

### Shared auth and the single-Passport rule

`libs/shared-auth` declares `passport`, `@nestjs/passport`, `@nestjs/common` and
`@nestjs/config` as **peerDependencies**, not dependencies. Passport keeps its
registered strategies in module-level state, so if the library resolved its own
copy while a consuming service resolved another, `JwtStrategy` would register
into one registry and that service's guards would look in the other — failing at
runtime with `Unknown authentication strategy "jwt"` while identical-looking
guards from the library still worked.

This is not hypothetical: `shared-auth` resolved passport 0.6.0 while
`session-service` resolved 0.7.0, and a guard defined locally in session-service
silently fell through to the anonymous path for *authenticated* callers. All
services are pinned to `passport@^0.7.0`.

**Guards that extend `AuthGuard` belong in `libs/shared-auth`**, next to the
strategy they depend on — not in individual services.

### API gateway

Not used. `Structure.text` describes one, but
`platform-backend-IMPLEMENTATION.md` — the newer, ADR-backed document — does not,
and it is authoritative. Each service enables its own CORS via `CORS_ORIGINS`.
Revisit if frontend integration proves painful.

## Local development

```bash
docker compose -f docker-compose.dev.yml up -d       # postgres, redis, kafka
cp apps/<service>/.env.example apps/<service>/.env   # then fill in JWT_SECRET
pnpm install
pnpm db:generate
pnpm --filter identity-service db:migrate            # repeat per service
pnpm dev
```

**Postgres is published on host port 5440**, not 5432. Native Postgres installs
commonly occupy 5432 and 5433; two servers competing for a port makes which one
you reach non-deterministic, and the failure surfaces confusingly as an
authentication error. Inside the compose network it is still 5432.

`JWT_SECRET` must be **identical** across every service that verifies tokens;
only `identity-service` issues them.

If you have a `postgres-data` volume from before the per-service split, the init
script that creates the three databases will not re-run — recreate the volume
with `docker compose -f docker-compose.dev.yml down -v`.

| Service | Port | Docs |
|---|---|---|
| `identity-service` | 3001 | `/api/docs`, `/api/openapi.json` |
| `session-service` | 3002 | `/api/docs`, `/api/openapi.json` |
| `preference-service` | 3003 | `/api/docs`, `/api/openapi.json` |
| `fanout-service` | 3004 | scaffold |
| `presenter-assist-service` | 3005 | scaffold |

API documentation is Swagger UI (`@nestjs/swagger`). An earlier revision of this
document described it as Scalar; that was inaccurate.

## Kafka events

| Event | Producer | Consumer |
|---|---|---|
| `identity.invitation.created` | `identity-service` | *(none yet)* |
| `session.created` / `session.ended` | `session-service` | *(none yet)* |
| `accessibility.preference.updated` | `preference-service` | `session-service` |

Event consumers use `@EventPattern`, not `@MessagePattern` — on the Kafka
transport the latter implies request/reply and waits on a response topic.

Topics are provisioned by the one-shot `kafka-init` container in
`docker-compose.dev.yml` (1 partition each); add new contract topics there.
Producers run in `producerOnlyMode` (none of them uses request/reply) and publish
fire-and-forget, but each service tracks in-flight events and drains them on
shutdown before disconnecting, so a deploy does not drop events mid-send. A
failed publish is logged as `Failed to publish <topic>` and is **not retried**.

## Known gaps

Carried forward deliberately; none block the checks above.

- **`fanout-service` is unimplemented** (issue #5). Needs socket.io per ADR-0010,
  Redis state, and an `ai.transcript.segment` consumer. This is the piece that
  makes delivery *personalized*.
- **Dockerfiles are broken.** All five run `pnpm install` on `node:18-alpine`,
  which ships no pnpm and has no `corepack enable`; none run `prisma generate`;
  and the spec calls for Node 20+.
- **CI is misconfigured.** `.github/workflows/ci.yml` references the org
  `inclusaai-infra`; the actual org is `InclusaAI`. It also provisions no
  Postgres or Kafka services, so e2e tests could not run there.
- **Quality bar (spec §8) is largely unmet.** No Prometheus metrics, no
  OpenTelemetry, no config-schema validation. `/healthz` returns a static string
  rather than checking database, Kafka, or Redis connectivity. Graceful shutdown
  *is* wired (`enableShutdownHooks`, plus draining in-flight Kafka events).
- **Event delivery is at-most-once.** Events are published after the database
  write with no outbox, so an event is lost (and logged) if Kafka is unavailable
  at that moment.
- **E2E tests do not assert that events are published.** They pass with Kafka
  down; publication is currently verified only by the manual smoke test.
- **`accessibility.preference.updated` is published without a message key**, so
  per-participant ordering holds only while the topic has a single partition.
  Pending the `ai-services` schema review (issue #4).
- **No organization-membership check** when creating a presentation
  (`presentations.service.ts`) — the owning organization is taken on trust from
  the request body.
- Root `tsconfig.json` sets `strictNullChecks: false` and `noImplicitAny: false`.
