import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

/**
 * Kafka consumer configuration for the fanout service.
 *
 * Subscribes to AI output topics via regex patterns:
 *   - media.session.*.audio.chunk   → asr-service
 *   - media.session.*.video.frame   → sign-recognition, vision-quality
 *   - ai.transcript.segment         → asr-service output
 *   - ai.sign.recognition.result    → sign-recognition output
 *   - ai.translation.result         → translation output
 *   - ai.tts.audio.chunk            → tts output
 *   - ai.avatar.pose.frame          → avatar output
 *   - ai.vision.quality.signal      → vision-quality output
 *   - ai.engagement.signal.aggregate → engagement output
 */
@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CONSUMER',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'fanout-service',
              brokers: [configService.get<string>('KAFKA_BROKER')],
            },
            consumer: {
              groupId: 'fanout-service-consumer',
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  exports: ['KAFKA_CONSUMER'],
})
export class KafkaModule {}
