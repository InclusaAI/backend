/**
 * Load test for issue #5: one session, 50 concurrent sockets, captions at
 * ~10/s.
 *
 *   pnpm --filter fanout-service test:load
 *
 * Needs Kafka and Redis from docker-compose.dev.yml. It boots its own
 * fanout-service instance, so nothing else has to be running.
 *
 * Latency measured here is Kafka publish -> socket receive, which is the hop
 * this service owns. The issue's 300-800ms budget is end to end and also
 * covers audio capture and ASR, neither of which exists yet.
 */
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { NestFactory } from "@nestjs/core";
import { Logger, LogLevel } from "@nestjs/common";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { Kafka, logLevel } from "kafkajs";
import * as jwt from "jsonwebtoken";
import { io, Socket } from "socket.io-client";
import { PARTICIPANT_TOKEN_AUDIENCE } from "@inclusaai/shared-types";
import {
  AI_TRANSCRIPT_SEGMENT_EVENT,
  AI_TRANSCRIPT_SEGMENT_SCHEMA_VERSION,
} from "@inclusaai/kafka-contracts";
import { AppModule } from "../../src/app.module";
import { RedisIoAdapter } from "../../src/realtime/redis-io.adapter";
import { CAPTION_SEGMENT_EVENT } from "../../src/realtime/captions.gateway";

const PORT = Number(process.env.LOAD_PORT ?? 3106);
const CLIENTS = Number(process.env.LOAD_CLIENTS ?? 50);
const SEGMENTS = Number(process.env.LOAD_SEGMENTS ?? 50);
const INTERVAL_MS = Number(process.env.LOAD_INTERVAL_MS ?? 100);

/**
 * Gates: every delivery must arrive, and the median must stay low.
 *
 * p95 is printed but not enforced by default, because on a shared developer
 * machine the tail measures the host rather than this service. Measured here
 * while the host was busy: p50 held at 28-39ms across runs, while p95 ranged
 * from 75ms to 900ms — and it was just as wide with 10 clients as with 50, so
 * it is host contention, not socket count. A gate that fails at random gets
 * ignored, so enforce p95 where the machine is quiet (CI, a dedicated runner)
 * by setting LOAD_MAX_P95_MS, e.g. LOAD_MAX_P95_MS=150.
 */
const MAX_P50_MS = Number(process.env.LOAD_MAX_P50_MS ?? 100);
const MAX_P95_MS = process.env.LOAD_MAX_P95_MS
  ? Number(process.env.LOAD_MAX_P95_MS)
  : null;
/** Reported, not enforced: what p95 should look like on an idle machine. */
const TARGET_P95_MS = 150;
const MIN_DELIVERY_RATIO = 1;

const broker = process.env.KAFKA_BROKER ?? "localhost:29092";
const secret = process.env.PARTICIPANT_TOKEN_SECRET as string;
const sessionId = `load-${Date.now()}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

async function main(): Promise<void> {
  if (!secret) {
    throw new Error("PARTICIPANT_TOKEN_SECRET is not set; copy .env.example");
  }

  const logger = new Logger("LoadTest");

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"] as LogLevel[],
  });
  const adapter = new RedisIoAdapter(app, {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6390",
    corsOrigins: ["*"],
    streamMaxLen: 100_000,
    recoveryWindowMs: 120_000,
  });
  await adapter.connect();
  app.useWebSocketAdapter(adapter);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { clientId: "fanout-load", brokers: [broker] },
      consumer: { groupId: `fanout-load-${Date.now()}` },
    },
  });
  await app.startAllMicroservices();
  await app.listen(PORT);

  const kafka = new Kafka({
    clientId: "fanout-load-producer",
    brokers: [broker],
    logLevel: logLevel.NOTHING,
  });
  const producer = kafka.producer();
  await producer.connect();

  const latencies: number[] = [];
  /** Publish time per sequence number, so each client can measure its own delivery. */
  const publishedAt: Record<number, number> = {};
  let sequence = 0;

  const publish = async (): Promise<void> => {
    const seq = ++sequence;
    await producer.send({
      topic: AI_TRANSCRIPT_SEGMENT_EVENT,
      messages: [
        {
          key: sessionId,
          value: JSON.stringify({
            schema_version: AI_TRANSCRIPT_SEGMENT_SCHEMA_VERSION,
            session_id: sessionId,
            segment_id: `seg-${seq}`,
            sequence: seq,
            text: `segment ${seq}`,
            is_final: true,
            language: "en-US",
            start_ms: seq * 1000,
            end_ms: (seq + 1) * 1000,
            produced_at: new Date().toISOString(),
          }),
        },
      ],
    });
  };

  const sockets: Socket[] = [];
  for (let i = 0; i < CLIENTS; i++) {
    const token = jwt.sign(
      { sub: `load-p-${i}`, sid: sessionId, uid: null, captionsEnabled: true },
      secret,
      { audience: PARTICIPANT_TOKEN_AUDIENCE, expiresIn: "1h" },
    );
    const socket = io(`http://localhost:${PORT}`, {
      transports: ["websocket"],
      auth: { token },
    });
    socket.on(CAPTION_SEGMENT_EVENT, (segment: { sequence: number }) => {
      latencies.push(Date.now() - publishedAt[segment.sequence]);
    });
    sockets.push(socket);
  }

  await Promise.all(
    sockets.map(
      (socket) =>
        new Promise<void>((resolve, reject) => {
          socket.once("connect", () => resolve());
          socket.once("connect_error", reject);
        }),
    ),
  );
  logger.log(`${CLIENTS} sockets connected to session ${sessionId}`);

  // Wait until the consumer group is delivering before measuring.
  for (let attempt = 0; attempt < 30 && latencies.length === 0; attempt++) {
    publishedAt[sequence + 1] = Date.now();
    await publish();
    await sleep(1000);
  }
  if (latencies.length === 0) {
    throw new Error("no segment was delivered; is Kafka reachable?");
  }
  latencies.length = 0;

  logger.log(`publishing ${SEGMENTS} segments at ~${1000 / INTERVAL_MS}/s`);
  for (let i = 0; i < SEGMENTS; i++) {
    publishedAt[sequence + 1] = Date.now();
    await publish();
    await sleep(INTERVAL_MS);
  }
  await sleep(3000);

  const expected = CLIENTS * SEGMENTS;
  const ratio = latencies.length / expected;

  console.log("");
  console.log(`sockets            ${CLIENTS}`);
  console.log(`segments           ${SEGMENTS}`);
  console.log(
    `deliveries         ${latencies.length}/${expected} (${(
      ratio * 100
    ).toFixed(1)}%)`,
  );
  console.log(`latency p50        ${percentile(latencies, 0.5)}ms`);
  console.log(`latency p95        ${percentile(latencies, 0.95)}ms`);
  console.log(`latency max        ${Math.max(...latencies)}ms`);

  sockets.forEach((socket) => socket.close());
  await producer.disconnect();
  await app.close();

  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const failures: string[] = [];
  if (ratio < MIN_DELIVERY_RATIO) {
    failures.push(`delivery ${(ratio * 100).toFixed(1)}% is below 100%`);
  }
  if (p50 > MAX_P50_MS) {
    failures.push(`p50 ${p50}ms is above ${MAX_P50_MS}ms`);
  }
  if (MAX_P95_MS !== null && p95 > MAX_P95_MS) {
    failures.push(`p95 ${p95}ms is above ${MAX_P95_MS}ms`);
  } else if (p95 > TARGET_P95_MS) {
    console.log(
      `note: p95 ${p95}ms is above the ${TARGET_P95_MS}ms target, which on a ` +
        `loaded machine reflects host contention rather than this service. ` +
        `p50 is the number to watch here; enforce p95 on an idle runner with ` +
        `LOAD_MAX_P95_MS.`,
    );
  }

  console.log("");
  console.log(failures.length === 0 ? "PASS" : `FAIL: ${failures.join("; ")}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
