import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";

/** Injection token for this service's Kafka client. */
export const KAFKA_SERVICE = "KAFKA_SERVICE";

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: "identity-service",
              brokers: [configService.getOrThrow<string>("KAFKA_BROKER")],
            },
            // This client only emit()s events. Without producerOnlyMode,
            // ClientKafka also starts a consumer group to receive request/reply
            // responses that never come, and that consumer can still be
            // reconnecting after the app has closed.
            producerOnlyMode: true,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}
