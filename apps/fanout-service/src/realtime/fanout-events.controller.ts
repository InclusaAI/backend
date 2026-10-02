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
  async handleTranscriptSegment(
    @Payload() segment: TranscriptSegmentPayload,
  ): Promise<void> {
    if (!segment?.session_id || typeof segment.text !== "string") {
      this.logger.warn(
        "Discarded a transcript segment with no session or text",
      );
      return;
    }

    // ai-services names a speaker by participant id; the display name lives in
    // session-service and reached us on session.participant.updated. Only look
    // it up when there is a speaker to name.
    const speaker = segment.speaker_participant_id
      ? await this.state.get(segment.speaker_participant_id)
      : null;

    this.gateway.broadcastSegment(segment.session_id, {
      segmentId: segment.segment_id,
      sequence: segment.sequence,
      text: segment.text,
      isFinal: segment.is_final,
      language: segment.language,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      ...(speaker?.displayName ? { speakerName: speaker.displayName } : {}),
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
