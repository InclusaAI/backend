import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-streams-adapter";
import { ServerOptions } from "socket.io";
import { createClient } from "redis";

export interface RedisIoAdapterOptions {
  redisUrl: string;
  corsOrigins: string[];
  /**
   * Entries kept in the shared Redis stream. This bounds how far back a
   * reconnecting client can be caught up, so it has to hold well over
   * `recoveryWindowMs` worth of traffic across all sessions.
   */
  streamMaxLen: number;
  recoveryWindowMs: number;
}

/**
 * Runs socket.io over Redis streams so that any number of instances behave as
 * one: a caption consumed from Kafka by one instance reaches sockets held by
 * all of them.
 *
 * This adapter is also what makes reconnection work. Socket.io's connection
 * state recovery needs an adapter that stores sessions and can replay what a
 * socket missed; the streams adapter supports it, while the classic Redis
 * adapter does not.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private redis: ReturnType<typeof createClient>;
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly options: RedisIoAdapterOptions,
  ) {
    super(app);
  }

  /** Must be awaited before the adapter is handed to Nest. */
  async connect(): Promise<void> {
    this.redis = createClient({ url: this.options.redisUrl });
    this.redis.on("error", (error: Error) =>
      this.logger.error(`Redis adapter client error: ${error.message}`),
    );
    await this.redis.connect();

    this.adapterConstructor = createAdapter(this.redis, {
      maxLen: this.options.streamMaxLen,
      // The polling read blocks for this long, and shutdown waits for the
      // read in flight, so keep it short enough not to stall a deploy.
      blockTimeInMs: 1_000,
    });
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.options.corsOrigins, credentials: true },
      connectionStateRecovery: {
        maxDisconnectionDuration: this.options.recoveryWindowMs,
        // The connection was authenticated when it was first established, and
        // recovery restores that state, so don't re-run the auth middleware.
        skipMiddlewares: true,
      },
    });

    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(server: unknown): Promise<void> {
    await super.close(server as never);

    try {
      await this.redis.close();
    } catch {
      this.redis.destroy();
    }
  }
}
