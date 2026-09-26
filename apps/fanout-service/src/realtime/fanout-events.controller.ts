import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  AI_TRANSCRIPT_SEGMENT_EVENT,
  SESSION_ENDED_EVENT,
  SESSION_PARTICIPANT_UPDATED_EVENT,
  SessionEndedPayload,
  SessionParticipantUpdatedPayload,
  TranscriptSegmentPayload,
} from "@inclusaai/kafka-contracts";
import { CaptionsGateway } from "./captions.gateway";
import { ParticipantStateStore } from "./participant-state.store";

/**
 * Kafka consumers.
 *
 * `@EventPattern`, not `@MessagePattern`: these are fire-and-forget events, and
 * on the Kafka transport `@MessagePattern` implies request/reply.
 *
 * Every instance shares one consumer group, so each event is handled once; the
 * Redis adapter then delivers the broadcast to sockets on every instance.
 */
@Controller()
export class FanoutEventsController {
  private readonly logger = new Logger(FanoutEventsController.name);

  constructor(
    private readonly gateway: CaptionsGateway,
    private readonly state: ParticipantStateStore,
  ) {}

  @EventPattern(AI_TRANSCRIPT_SEGMENT_EVENT)
  handleTranscriptSegment(@Payload() segment: TranscriptSegmentPayload): void {
    if (!segment?.sessionId || typeof segment.text !== "string") {
      this.logger.warn(
        "Discarded a transcript segment with no session or text",
      );
      return;
    }

    this.gateway.broadcastSegment(segment.sessionId, {
      segmentId: segment.segmentId,
      sequence: segment.sequence,
      text: segment.text,
      isFinal: segment.isFinal,
      language: segment.language,
      startMs: segment.startMs,
      endMs: segment.endMs,
    });
  }

  @EventPattern(SESSION_PARTICIPANT_UPDATED_EVENT)
  async handleParticipantUpdated(
    @Payload() event: SessionParticipantUpdatedPayload,
  ): Promise<void> {
    if (!event?.participantId || !event.sessionId) {
      this.logger.warn("Discarded a participant event with no participant");
      return;
    }

    // apply() reports false for an event older than what we hold, which would
    // otherwise undo a newer change.
    const applied = await this.state.apply(event);
    if (!applied) {
      return;
    }

    await this.gateway.setCaptions(
      event.sessionId,
      event.participantId,
      event.captionsEnabled,
    );
  }

  @EventPattern(SESSION_ENDED_EVENT)
  async handleSessionEnded(
    @Payload() event: SessionEndedPayload,
  ): Promise<void> {
    if (!event?.sessionId) {
      return;
    }

    await this.state.markSessionEnded(event.sessionId);
    await this.gateway.endSession(event.sessionId);
    this.logger.log(`Closed connections for ended session ${event.sessionId}`);
  }
}
