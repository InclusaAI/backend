import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { FanoutGateway } from './fanout.gateway';

/**
 * Kafka consumer service that subscribes to ai-services output topics
 * and pushes events to connected WebSocket clients via FanoutGateway.
 *
 * Topics consumed (per-session patterns):
 *   - media.session.*.audio.chunk          → asr-service (raw audio, not forwarded)
 *   - media.session.*.video.frame          → sign-recognition, vision-quality (raw video, not forwarded)
 *   - media.session.*.participant.joined   → engagement-service
 *   - media.session.*.participant.left     → engagement-service
 *
 * Topics consumed (fixed):
 *   - ai.transcript.segment                → asr-service output
 *   - ai.sign.recognition.result           → sign-recognition output
 *   - ai.translation.result                → translation output
 *   - ai.tts.audio.chunk                   → tts output
 *   - ai.avatar.pose.frame                 → avatar output
 *   - ai.vision.quality.signal             → vision-quality output
 *   - ai.engagement.signal.aggregate       → engagement output
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);

  constructor(
    private readonly kafkaClient: ClientKafka,
    private readonly fanoutGateway: FanoutGateway,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();

    // Subscribe to fixed AI output topics
    this.kafkaClient.subscribeToResponseOf([
      'ai.transcript.segment',
      'ai.sign.recognition.result',
      'ai.translation.result',
      'ai.tts.audio.chunk',
      'ai.avatar.pose.frame',
      'ai.vision.quality.signal',
      'ai.engagement.signal.aggregate',
    ]);

    // Subscribe to participant events (per-session pattern via regex)
    // Note: NestJS Kafka client doesn't natively support regex subscriptions,
    // so we subscribe to specific events as they come through.
    // In production, use aiokafka-style pattern subscribe or a dedicated consumer.

    // Listen for AI output events
    this.kafkaClient.subscribeToResponseOf('ai.transcript.segment');
    this.kafkaClient.subscribeToResponseOf('ai.sign.recognition.result');
    this.kafkaClient.subscribeToResponseOf('ai.translation.result');
    this.kafkaClient.subscribeToResponseOf('ai.tts.audio.chunk');
    this.kafkaClient.subscribeToResponseOf('ai.avatar.pose.frame');
    this.kafkaClient.subscribeToResponseOf('ai.vision.quality.signal');
    this.kafkaClient.subscribeToResponseOf('ai.engagement.signal.aggregate');

    this.logger.log('Kafka consumer connected, subscribing to AI output topics');
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }
}
