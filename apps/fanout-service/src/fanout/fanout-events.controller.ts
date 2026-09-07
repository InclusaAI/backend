import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { FanoutGateway } from './fanout.gateway';

/**
 * Kafka event handler for AI service outputs.
 * Receives events from Kafka and fans them out to connected WebSocket clients.
 *
 * Each @EventPattern handler:
 *   1. Receives the Kafka event payload
 *   2. Extracts the sessionId from the payload
 *   3. Pushes the event to all clients in that session room
 */
@Controller()
export class FanoutEventsController {
  private readonly logger = new Logger(FanoutEventsController.name);

  constructor(private readonly fanoutGateway: FanoutGateway) {}

  @EventPattern('ai.transcript.segment')
  handleTranscript(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushTranscript(sessionId, data);
    this.logger.debug(`Fanout transcript to session ${sessionId}`);
  }

  @EventPattern('ai.sign.recognition.result')
  handleSignRecognition(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushSignRecognition(sessionId, data);
    this.logger.debug(`Fanout sign recognition to session ${sessionId}`);
  }

  @EventPattern('ai.translation.result')
  handleTranslation(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushTranslation(sessionId, data);
    this.logger.debug(`Fanout translation to session ${sessionId}`);
  }

  @EventPattern('ai.tts.audio.chunk')
  handleTtsAudio(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushTtsAudio(sessionId, data);
    this.logger.debug(`Fanout TTS audio to session ${sessionId}`);
  }

  @EventPattern('ai.avatar.pose.frame')
  handleAvatarPose(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushAvatarPose(sessionId, data);
    this.logger.debug(`Fanout avatar pose to session ${sessionId}`);
  }

  @EventPattern('ai.vision.quality.signal')
  handleVisionQuality(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushVisionQuality(sessionId, data);
    this.logger.debug(`Fanout vision quality to session ${sessionId}`);
  }

  @EventPattern('ai.engagement.signal.aggregate')
  handleEngagement(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    this.fanoutGateway.pushEngagement(sessionId, data);
    this.logger.debug(`Fanout engagement to session ${sessionId}`);
  }

  @EventPattern('accessibility.preference.updated')
  handlePreferenceUpdated(@Payload() data: any): void {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    // Notify clients about preference changes (for UI updates)
    this.fanoutGateway.pushParticipantEvent(sessionId, 'preference-updated', data);
    this.logger.debug(`Fanout preference update to session ${sessionId}`);
  }
}
