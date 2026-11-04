import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClientProxyFactory, Transport } from "@nestjs/microservices";
import { kafkaClientConfig } from "@inclusaai/kafka-contracts";

/** Injection token for this service's Kafka client. */
export const KAFKA_SERVICE = "KAFKA_SERVICE";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KAFKA_SERVICE,
      useFactory: () => {
        return ClientProxyFactory.create({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: "session-service",
              ...kafkaClientConfig(),
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
    },
  ],
  exports: [KAFKA_SERVICE],
})
export class KafkaModule {}
