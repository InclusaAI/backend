# Review and next steps — backend, ai-services, realtime-media-backend

**Date:** 2026-11-03
**Scope:** this repository (`backend`, the platform/business plane) read against
the two repos it shares an event bus with: `ai-services` (Python inference) and
`realtime-media-backend` (LiveKit media plane).

What was checked: `pnpm build` (12/12 tasks), `pnpm test` (11/11 tasks). Not
checked, because this machine has no Docker, Kafka or Redis: the e2e suites
(`test:e2e`), the fanout load test, and `docker build` of any image. Those are
called out as unverified wherever they matter.

## 1. The branch was a broken merge — fixed here

`main` at `c5dcad9` merged `origin/main` (`fa64160`, Oct 9) with an older local
line (`712573c`, Sep 7) and resolved the conflicts toward the **old** side. The
result did not build:

- `pnpm install --frozen-lockfile` failed: the lockfile listed fanout's
  `@nestjs/jwt`, `@socket.io/redis-streams-adapter`, `kafkajs` and `redis`, while
  `package.json` had lost them all.
- `libs/kafka-contracts` had lost `SESSION_PARTICIPANT_UPDATED_EVENT` and
  `SessionParticipantUpdatedPayload`, which fanout-service and session-service
  both import.
- `accessibility.preference.updated` was declared twice — once account-scoped in
  `accessibility.ts`, once participant-scoped in `sessions.ts` — with the same
  exported names.

Fixed by keeping the newer participant-scoped work and reconciling it:

| Change | Why |
|---|---|
| One canonical `AccessibilityPreferenceUpdatedPayload` (snake_case, session + participant scoped) in `libs/kafka-contracts/src/accessibility.ts` | It is the shape ai-services validates; two definitions meant behaviour depended on export order |
| `SessionParticipantUpdatedPayload` restored in `sessions.ts` | fanout materialises participant state from it |
| `fanout-service` wired to `RealtimeModule`, old `fanout/` and `kafka/` modules deleted | see below |
| `preference-service` restored its auth, and now authenticates with the **participant token** | it had no guard at all |
| `presenter-assist-service` got the deps it imports (`@nestjs/microservices`, `@nestjs/config`, `@nestjs/websockets`, `@nestjs/platform-socket.io`) | it could not compile |
| All five Dockerfiles rewritten for Node 20 + `corepack`, workspace-aware build, service-local Prisma client | none of them built |

### The security bug this hid

The old `FanoutGateway` was the live one: it accepted a bare `join-session`
message with **any** `sessionId` and emitted every AI output to that room. No
token, no membership check, `cors: { origin: "*" }`. Anyone who could guess or
observe a session id could receive that session's captions — private speech — and
sign-recognition, translation and avatar output.

The secure implementation (`CaptionsGateway`, participant-token middleware,
captions-only rooms, Redis streams adapter, connection-state recovery) existed in
`src/realtime/` but was never imported. It is now the only gateway.

## 2. Cross-repo contract drift (the thing that will bite in staging)

Verified by reading `ai-services/shared/contracts/src/inclusaai_contracts/` and
`realtime-media-backend/apps/media-control/src/contracts/kafka-events.ts`.

### 2.1 `accessibility.preference.updated` — the gating event

| | ai-services requires (`AccessibilityPreferenceUpdated`, validated through `schema_registry.py`) | backend at `origin/main` published |
|---|---|---|
| ids | `session_id`, `participant_id` | `userId` only |
| channels | `channels: ["captions"]` | `captionsEnabled` / `avatarEnabled` |
| time | `updated_at_ms: int` | `updatedAt: ISO string` |

Every message failed Pydantic validation on the ai-services side, so
**preference-aware gating never worked**: ASR, translation, avatar and TTS either
ran for everyone or for no one. This repo now publishes exactly ai-services'
shape (ids from the participant token, channels lower-case, epoch ms), and
session-service consumes the same shape. ai-services needs no change.

Open decision: the topic used to be keyed by `userId` and compacted, acting as
"the current setting for every participant". It is now per session and
participant, so there is no durable cross-session state. That is the right shape
for gating and the wrong shape for "remember my settings next time". See §3.1.

### 2.2 `ai.transcript.segment` — captions still arrive, but degraded

`ai-services` publishes `speaker_id` (from `media.session.<id>.audio.chunk`)
and has no `sequence`; this repo's proposed contract said
`speaker_participant_id` and a required `sequence`. fanout now accepts either
speaker field name and treats `sequence` as optional, so captions and speaker
names work if media-control's `speaker_id` is the SessionParticipant id. Two
follow-ups:

- ai-services: add `sequence` (or let clients order by `start_ms`, which works
  but re-orders interim segments of the same utterance), plus `schema_version`.
- Confirm the identity mapping: media-control puts LiveKit participant identity
  in `speaker_id`; session-service's participant id is what fanout looks names up
  by. If the LiveKit identity is anything else (a join token id, an email), names
  silently never resolve.

### 2.3 Roster events nothing consumes

`realtime-media-backend` publishes `media.session.<id>.participant.joined/left`
for engagement-service. `platform-backend-IMPLEMENTATION.md` says session-service
consumes them to keep a live roster, and it does not. So `GET
/sessions/:id/participants` only reflects join/leave through this service, not
what actually connected to the media plane. Consuming those events (and letting
`left` close the participant row) is the missing link between the two planes.

## 3. What to do next, in order

### 3.1 Decide what "durable preferences" means (blocks a product claim)

`PreferenceClientService` calls `GET /preferences` with the joiner's **account**
token to seed their settings on join. That endpoint does not exist, so every
join falls back to defaults (`captions: off`, `avatar: on`). Meanwhile the
preference API is now participant-token authenticated and per session, so a
first-time joiner has no stored row to read.

Options, cheapest first:

1. **Session-scoped only.** Delete the join-time lookup and its warning; a
   participant sets channels after joining (`POST /preferences` with the
   participant token, or `PATCH /sessions/participants/me`). Honest, and it
   matches the ai-services contract.
2. **Durable defaults + session override.** Add a `UserPreference` keyed by
   `userId` to preference-service, `GET /preferences` behind the account JWT for
   it, and have session-service copy it onto the new participant row at join and
   publish `session.participant.updated`. This is what the spec promises, and it
   is the only option that survives a new session.

Pick one and write it down; today the code implies (2) and implements (1).

### 3.2 Broker hygiene

- The seven topics this repo publishes to / consumes exist on the Aiven broker
  (`identity.invitation.created`, `session.updated` and
  `session.participant.updated` were created on 2026-11-03; the others already
  came from ai-services). Auto-creation is normally off, so a new broker needs
  them created again — list in [RENDER.md](RENDER.md).
- Make `accessibility.preference.updated` compacted if you keep any
  "latest state" reading of it; otherwise retention silently drops participants.
- `session.created` / `session.ended` are what media-control uses to pre-warm and
  clean up LiveKit rooms, so identity → session → media must share one broker.
  They do now (Aiven), which is why the Render blueprint points at Aiven rather
  than running a second broker.

### 3.3 Media join path

session-service issues a `participantToken` but nothing issues a LiveKit token:
media-control creates rooms through `POST /api/sessions`. The frontend therefore
has to call two services to join one session. Either session-service proxies the
media-control call at join (one round trip for the client, and it can pass the
participant id as the LiveKit identity — which fixes §2.2's name lookup), or this
is documented as a client responsibility. Right now neither is written down.

### 3.4 Production readiness (unchanged by this pass)

- `/healthz` is a static `OK`. Render will keep a service alive that cannot reach
  Postgres, Redis or Kafka. Add a real probe (Prisma `$queryRaw SELECT 1`, Redis
  `PING`, Kafka admin `describeCluster`) with a short timeout.
- No metrics, no tracing, no config-schema validation (spec §8).
- At-most-once event delivery: publish happens after the write, with no outbox.
- CI still points at the non-existent `inclusaai-infra` organisation and
  provisions no Postgres/Kafka, so nothing is verified before deploy. Given that
  this repo's failure mode was a merge that did not compile, a single
  `pnpm build && pnpm test` job would have caught it.
- `presenter-assist-service` remains a scaffold with an HTTP controller and Kafka
  consumer but no persistence; leave it out of deploys (the blueprint does).

### 3.5 Housekeeping

- `docs/DEVELOPMENT-STATUS.md` is stale: it describes the account-scoped
  preference API, "Dockerfiles are broken" and "CI misconfigured" as current.
- `certs/aiven-kafka-ca.pem` is in the working tree, still untracked — commit it
  with this work. Every Dockerfile now copies `certs/` into the runtime image, so
  `KAFKA_CA_CERT` can be the in-image path
  (`/usr/src/app/certs/aiven-kafka-ca.pem`) instead of inline PEM.
- `kafkajs` was only a dependency of fanout-service, while the other four
  services reach Kafka through `@nestjs/microservices`, where it is an *optional*
  peer dependency. They therefore threw `Cannot find module 'kafkajs'` the first
  time the Kafka client connected. It is now declared in all four.
- Root `tsconfig.json` still has `strictNullChecks: false` and
  `noImplicitAny: false`.

## 4. Deployment

`render.yaml` + [RENDER.md](RENDER.md) describe four web services (identity,
session, preference, fanout), one Key Value instance, one Postgres instance
shared by the three services that own data (the free plan allows only one), and
a shared `backend-shared` env group carrying the Aiven broker settings. Because
free web services have no `preDeployCommand`, migrations run from the image
entrypoint (`docker/entrypoint.sh` → `prisma migrate deploy`), each service
applying only its own `migrations/` directory. `db push` is not used: it would
sync the shared database to one service's schema and drop the other services'
tables.

Not verified from here: the Docker images themselves (no Docker available), so
the first Blueprint apply is also the first image build. Watch that first build;
the Dockerfiles are workspace-aware, so `pnpm install` must succeed at the repo
root inside the image — which the local `pnpm install --frozen-lockfile` now also
does.
