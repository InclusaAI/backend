import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientProxyFactory, Transport } from "@nestjs/microservices";

/** Injection token for this service's Kafka client. */
export const KAFKA_SERVICE = "KAFKA_SERVICE";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KAFKA_SERVICE,
      useFactory: (configService: ConfigService) => {
        return ClientProxyFactory.create({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: "session-service",
              brokers: [configService.getOrThrow<string>("KAFKA_BROKER")],
            },
            // This client only emit()s events. Without producerOnlyMode,
            // ClientKafka also starts a consumer group to receive request/reply
            // responses that never come. If shutdown lands while that consumer
            // is still connecting, kafkajs schedules a restart that fires after
            // the app has closed. Inbound events are consumed separately, via
            // connectMicroservice in main.ts.
            producerOnlyMode: true,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [KAFKA_SERVICE],
})
export class KafkaModule {}
