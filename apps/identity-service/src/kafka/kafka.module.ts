import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule } from "@nestjs/config";
import { kafkaClientConfig } from "@inclusaai/kafka-contracts";

/** Injection token for this service's Kafka client. */
export const KAFKA_SERVICE = "KAFKA_SERVICE";

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_SERVICE,
        imports: [ConfigModule],
        useFactory: () => ({
          transport: Transport.KAFKA,
          options: {
            // Brokers, TLS and SASL come from the environment; see
            // kafkaClientConfig. Throws if no broker is configured, so the
            // service fails at boot rather than never connecting.
            client: {
              clientId: "identity-service",
              ...kafkaClientConfig(),
            },
            // This client only emit()s events. Without producerOnlyMode,
            // ClientKafka also starts a consumer group to receive request/reply
            // responses that never come, and that consumer can still be
            // reconnecting after the app has closed.
            producerOnlyMode: true,
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}
