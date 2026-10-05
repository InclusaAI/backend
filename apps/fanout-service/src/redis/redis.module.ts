import { Inject, Logger, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createClient } from "redis";

export const REDIS_CLIENT = "REDIS_CLIENT";

export type RedisClient = ReturnType<typeof createClient>;

/**
 * The service's own Redis connection, used for participant state.
 *
 * The socket.io adapter gets a separate connection (see RedisIoAdapter): it
 * duplicates its client for blocking XREAD calls, and mixing those with
 * ordinary commands on one connection would stall them.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<RedisClient> => {
        const logger = new Logger("Redis");
        const client = createClient({
          url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
        });

        // Without a listener, a connection error is an unhandled 'error' event
        // and takes the process down.
        client.on("error", (error: Error) =>
          logger.error(`Redis client error: ${error.message}`),
        );

        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.redis.close();
    } catch {
      this.redis.destroy();
    }
  }
}
