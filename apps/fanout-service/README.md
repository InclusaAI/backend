# fanout-service

Delivers live captions over WebSocket to the participants who want them.

```
ai-services -> ai.transcript.segment (Kafka) -> fanout-service -> socket.io -> clients
```

It holds no database. Participant state lives in Redis, and socket.io runs over
Redis streams so several instances behave as one.

## Client protocol

### 1. Join the session first

`POST /sessions/join` on session-service returns the participant, including a
`participantToken`. That token is the credential for this connection: it names
one participant in one session. There is no "join a session" message on the
socket, so a client cannot listen to a session it was not admitted to.

### 2. Connect

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3004", {
  transports: ["websocket"],
  auth: { token: participantToken },
});
```

A connection with no token, an expired one, an account token, or a token for a
session that has ended is refused with `connect_error`.

### 3. Receive captions

```js
socket.on("transcript.segment", (segment) => {
  // { segmentId, sequence, text, isFinal, language?, startMs, endMs }
});
```

Segments arrive only while the participant has captions enabled. `segmentId` is
stable across interim and final versions of the same utterance, so replace a
segment you already hold rather than appending it; `sequence` gives the order.

### 4. Turning captions on and off

Call `PATCH /sessions/participants/me` on session-service with the
`participantToken`:

```js
await fetch("http://localhost:3002/sessions/participants/me", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${participantToken}`,
  },
  body: JSON.stringify({ captionsEnabled: true }),
});
```

This works for anonymous participants and applies to this session only. Delivery
starts or stops on the open socket, with no reconnection. Signed-in users who
want the change remembered for future sessions should set it through
preference-service instead, which also feeds through to the open socket.

### 5. Reconnecting

Let socket.io reconnect by itself and **do not create a new socket**. The
connection is restored with the captions missed while it was gone:

```js
socket.on("connect", () => {
  if (socket.recovered) return;      // nothing was missed
  // Gone too long: the socket is fresh. Clear the transcript you hold, or
  // fetch it from your own store, then carry on.
});
```

Recovery covers about two minutes of absence, bounded also by
`FANOUT_STREAM_MAXLEN` worth of traffic. A page reload always starts fresh, so
keep the transcript in the page if the user should still see it afterwards.

When a session ends, the server disconnects everyone and refuses further
connections for that session.

## Running it

```bash
docker compose -f docker-compose.dev.yml up -d   # Kafka and Redis
cp apps/fanout-service/.env.example apps/fanout-service/.env
# PARTICIPANT_TOKEN_SECRET must match session-service's
pnpm --filter fanout-service start:dev
```

| Check | Command |
|---|---|
| e2e (needs Kafka and Redis) | `pnpm --filter fanout-service test:e2e` |
| Load test: 50 sockets, 50 captions | `pnpm --filter fanout-service test:load` |
| Health | `curl http://localhost:3004/healthz` |

## How it works

- **Filtering is room membership.** Captions go to `session:{id}:captions`, and
  only sockets whose participant enabled captions are in it. Nothing is sent to
  a client that then has to discard it.
- **Participant state is materialized in Redis** from `session.participant.updated`,
  so every instance filters the same way and a restarted instance doesn't forget
  live sessions. A change moves that participant's sockets between rooms, on
  whichever instance holds them.
- **One Kafka consumer group across all instances.** Each caption is consumed
  once; the Redis adapter delivers the broadcast to sockets everywhere.
- **Reconnection** uses socket.io connection state recovery, which needs the
  Redis *streams* adapter; the classic Redis adapter does not support it.

## Limits

- Recovery covers ~2 minutes, and no more than `FANOUT_STREAM_MAXLEN` entries of
  broadcast history shared across all sessions. Beyond that a client reconnects
  fresh and those captions are lost.
- Delivery is at-most-once: there is no replay for a client that was never
  connected.
- MVP relays captions only. Avatar and gesture fan-out are deferred (issue #5).
- The `ai.transcript.segment` schema in `libs/kafka-contracts` is the backend's
  proposal until ai-services confirms it.
