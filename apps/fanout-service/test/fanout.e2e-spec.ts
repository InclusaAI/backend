import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Kafka, logLevel, Producer } from "kafkajs";
import * as jwt from "jsonwebtoken";
import { io, Socket } from "socket.io-client";
import {
  PARTICIPANT_TOKEN_AUDIENCE,
  ParticipantTokenClaims,
} from "@inclusaai/shared-types";
import {
  AI_TRANSCRIPT_SEGMENT_EVENT,
  SESSION_ENDED_EVENT,
  SESSION_PARTICIPANT_UPDATED_EVENT,
} from "@inclusaai/kafka-contracts";
import { AppModule } from "../src/app.module";
import { RedisIoAdapter } from "../src/realtime/redis-io.adapter";
import { CAPTION_SEGMENT_EVENT } from "../src/realtime/captions.gateway";

/**
 * Runs against the real Kafka and Redis from docker-compose.dev.yml.
 *
 * Two instances share one consumer group, as they would in production: each
 * event is consumed once, and the Redis adapter is what gets the broadcast to
 * sockets held by the other instance.
 */
const PORT_A = 3104;
const PORT_B = 3105;
const GROUP = `fanout-e2e-${Date.now()}`;

type Recorder = Socket & { received: { text: string; sequence: number }[] };

const broker = process.env.KAFKA_BROKER ?? "localhost:29092";
const secret = process.env.PARTICIPANT_TOKEN_SECRET as string;

const kafka = new Kafka({
  clientId: "fanout-e2e",
  brokers: [broker],
  logLevel: logLevel.NOTHING,
});

let apps: INestApplication[] = [];
let producer: Producer;
const sockets: Socket[] = [];
let sequence = 0;

const settle = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));
const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createInstance(port: number): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  const adapter = new RedisIoAdapter(app, {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6390",
    corsOrigins: ["*"],
    streamMaxLen: 10_000,
    recoveryWindowMs: 120_000,
  });
  await adapter.connect();
  app.useWebSocketAdapter(adapter);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { clientId: `fanout-e2e-${port}`, brokers: [broker] },
      consumer: { groupId: GROUP },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  return app;
}

function tokenFor(
  participantId: string,
  sessionId: string,
  captionsEnabled: boolean,
  userId: string | null = null,
): string {
  const claims: ParticipantTokenClaims = {
    sub: participantId,
    sid: sessionId,
    uid: userId,
    captionsEnabled,
  };
  return jwt.sign(claims, secret, {
    audience: PARTICIPANT_TOKEN_AUDIENCE,
    expiresIn: "1h",
  });
}

function connect(port: number, token: string): Recorder {
  const socket = io(`http://localhost:${port}`, {
    transports: ["websocket"],
    auth: { token },
    reconnectionDelay: 100,
    reconnectionDelayMax: 300,
  }) as Recorder;

  socket.received = [];
  socket.on(
    CAPTION_SEGMENT_EVENT,
    (segment: { text: string; sequence: number }) =>
      socket.received.push(segment),
  );
  sockets.push(socket);
  return socket;
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", (error) => reject(error));
  });
}

async function publishSegment(
  sessionId: string,
  text = "hello",
): Promise<number> {
  const seq = ++sequence;
  await producer.send({
    topic: AI_TRANSCRIPT_SEGMENT_EVENT,
    messages: [
      {
        key: sessionId,
        value: JSON.stringify({
          sessionId,
          segmentId: unique("seg"),
          sequence: seq,
          text,
          isFinal: true,
          language: "en-US",
          startMs: 0,
          endMs: 1000,
          producedAt: new Date().toISOString(),
        }),
      },
    ],
  });
  return seq;
}

async function publishParticipant(
  sessionId: string,
  participantId: string,
  captionsEnabled: boolean,
): Promise<void> {
  await producer.send({
    topic: SESSION_PARTICIPANT_UPDATED_EVENT,
    messages: [
      {
        key: sessionId,
        value: JSON.stringify({
          sessionId,
          participantId,
          userId: null,
          captionsEnabled,
          avatarEnabled: true,
          updatedAt: new Date().toISOString(),
        }),
      },
    ],
  });
}

beforeAll(async () => {
  producer = kafka.producer();
  await producer.connect();

  apps = [await createInstance(PORT_A), await createInstance(PORT_B)];

  // The consumer group has to finish joining before anything is delivered;
  // publish until a probe socket actually receives something.
  const probeSession = unique("probe");
  const probe = connect(
    PORT_A,
    tokenFor(unique("probe-p"), probeSession, true),
  );
  await connected(probe);

  for (
    let attempt = 0;
    attempt < 30 && probe.received.length === 0;
    attempt++
  ) {
    await publishSegment(probeSession);
    await settle(1000);
  }

  if (probe.received.length === 0) {
    throw new Error("fanout never delivered a probe segment");
  }
  probe.close();
}, 90_000);

afterAll(async () => {
  sockets.forEach((socket) => socket.close());
  await producer?.disconnect();
  for (const app of apps) {
    await app.close();
  }
});

describe("Fanout (e2e)", () => {
  describe("connection", () => {
    it("rejects a connection with no token", async () => {
      const socket = io(`http://localhost:${PORT_A}`, {
        transports: ["websocket"],
        reconnection: false,
      });
      sockets.push(socket);

      await expect(connected(socket)).rejects.toThrow(
        /participant token is required/i,
      );
    });

    it("rejects a token signed with the wrong secret", async () => {
      const forged = jwt.sign(
        { sub: "p", sid: "s", uid: null, captionsEnabled: true },
        "not-the-participant-secret",
        { audience: PARTICIPANT_TOKEN_AUDIENCE, expiresIn: "1h" },
      );
      const socket = io(`http://localhost:${PORT_A}`, {
        transports: ["websocket"],
        auth: { token: forged },
        reconnection: false,
      });
      sockets.push(socket);

      await expect(connected(socket)).rejects.toThrow(/invalid or expired/i);
    });

    it("rejects an account token, which has a different audience", async () => {
      const accountToken = jwt.sign({ sub: "user-1" }, secret, {
        expiresIn: "1h",
      });
      const socket = io(`http://localhost:${PORT_A}`, {
        transports: ["websocket"],
        auth: { token: accountToken },
        reconnection: false,
      });
      sockets.push(socket);

      await expect(connected(socket)).rejects.toThrow(/invalid or expired/i);
    });
  });

  describe("delivery", () => {
    it("delivers captions to a participant who wants them, and not to one who does not", async () => {
      const sessionId = unique("session");
      const wants = connect(PORT_A, tokenFor(unique("p-on"), sessionId, true));
      const doesNot = connect(
        PORT_A,
        tokenFor(unique("p-off"), sessionId, false),
      );
      await Promise.all([connected(wants), connected(doesNot)]);

      await publishSegment(sessionId, "captions please");
      await settle();

      expect(wants.received.map((s) => s.text)).toEqual(["captions please"]);
      expect(doesNot.received).toHaveLength(0);
    });

    it("does not deliver a session's captions to another session", async () => {
      const sessionA = unique("session-a");
      const sessionB = unique("session-b");
      const inA = connect(PORT_A, tokenFor(unique("p-a"), sessionA, true));
      const inB = connect(PORT_A, tokenFor(unique("p-b"), sessionB, true));
      await Promise.all([connected(inA), connected(inB)]);

      await publishSegment(sessionA);
      await settle();

      expect(inA.received).toHaveLength(1);
      expect(inB.received).toHaveLength(0);
    });

    it("reaches sockets on every instance, wherever the event was consumed", async () => {
      const sessionId = unique("session-multi");
      const onA = connect(PORT_A, tokenFor(unique("p-a"), sessionId, true));
      const onB = connect(PORT_B, tokenFor(unique("p-b"), sessionId, true));
      await Promise.all([connected(onA), connected(onB)]);

      await publishSegment(sessionId, "both instances");
      await settle();

      expect(onA.received.map((s) => s.text)).toEqual(["both instances"]);
      expect(onB.received.map((s) => s.text)).toEqual(["both instances"]);
    });
  });

  describe("preference changes", () => {
    it("starts and stops delivery on an already-open socket", async () => {
      const sessionId = unique("session-toggle");
      const participantId = unique("p-toggle");
      const socket = connect(PORT_A, tokenFor(participantId, sessionId, false));
      await connected(socket);

      await publishSegment(sessionId, "before");
      await settle();
      expect(socket.received).toHaveLength(0);

      await publishParticipant(sessionId, participantId, true);
      await settle();
      await publishSegment(sessionId, "after opting in");
      await settle();
      expect(socket.received.map((s) => s.text)).toEqual(["after opting in"]);

      await publishParticipant(sessionId, participantId, false);
      await settle();
      await publishSegment(sessionId, "after opting out");
      await settle();
      expect(socket.received.map((s) => s.text)).toEqual(["after opting in"]);
    });

    it("applies a change to a participant's sockets on another instance", async () => {
      const sessionId = unique("session-cross");
      const participantId = unique("p-cross");
      const socket = connect(PORT_B, tokenFor(participantId, sessionId, false));
      await connected(socket);

      await publishParticipant(sessionId, participantId, true);
      await settle();
      await publishSegment(sessionId, "cross-instance toggle");
      await settle();

      expect(socket.received.map((s) => s.text)).toEqual([
        "cross-instance toggle",
      ]);
    });
  });

  describe("reconnection", () => {
    it("replays what was missed during a drop and resumes", async () => {
      const sessionId = unique("session-recover");
      const socket = connect(
        PORT_A,
        tokenFor(unique("p-recover"), sessionId, true),
      );
      await connected(socket);

      await publishSegment(sessionId, "before the drop");
      await settle();
      expect(socket.received).toHaveLength(1);

      // Drop the transport; socket.io reconnects on its own.
      socket.io.engine.close();
      await publishSegment(sessionId, "during the drop");

      await new Promise<void>((resolve) =>
        socket.once("connect", () => resolve()),
      );
      await settle();

      await publishSegment(sessionId, "after reconnecting");
      await settle();

      expect(socket.recovered).toBe(true);
      expect(socket.received.map((s) => s.text)).toEqual([
        "before the drop",
        "during the drop",
        "after reconnecting",
      ]);
    });
  });

  describe("session end", () => {
    it("disconnects the session's sockets and refuses new connections", async () => {
      const sessionId = unique("session-end");
      const socket = connect(
        PORT_A,
        tokenFor(unique("p-end"), sessionId, true),
      );
      await connected(socket);

      await producer.send({
        topic: SESSION_ENDED_EVENT,
        messages: [
          {
            key: sessionId,
            value: JSON.stringify({
              sessionId,
              endedAt: new Date().toISOString(),
            }),
          },
        ],
      });
      await settle(1500);

      expect(socket.connected).toBe(false);

      const late = io(`http://localhost:${PORT_A}`, {
        transports: ["websocket"],
        auth: { token: tokenFor(unique("p-late"), sessionId, true) },
        reconnection: false,
      });
      sockets.push(late);

      await expect(connected(late)).rejects.toThrow(/has ended/i);
    });
  });
});
