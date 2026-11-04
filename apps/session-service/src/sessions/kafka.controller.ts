import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  ACCESSIBILITY_PREFERENCE_UPDATED_EVENT,
  AccessibilityPreferenceUpdatedPayload,
} from "@inclusaai/kafka-contracts";
import { SessionsService } from "./sessions.service";

@Controller()
export class KafkaController {
  private readonly logger = new Logger(KafkaController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * `@EventPattern`, not `@MessagePattern`: this is a fire-and-forget event.
   * On the Kafka transport `@MessagePattern` implies request/reply, so Nest
   * would subscribe to a reply topic and expect to send a response back to a
   * producer that is not waiting for one.
   */
  @EventPattern(ACCESSIBILITY_PREFERENCE_UPDATED_EVENT)
  async handleAccessibilityPreferenceUpdated(
    @Payload() message: AccessibilityPreferenceUpdatedPayload,
  ): Promise<void> {
    // The event is snake_case and participant-scoped, because ai-services
    // validates it against the same contract. A payload without both ids
    // cannot be applied to anyone, so it is dropped rather than guessed at.
    if (!message?.session_id || !message?.participant_id) {
      this.logger.warn(
        "Discarded an accessibility preference event with no session or participant",
      );
      return;
    }

    const updated = await this.sessionsService.updateAccessibilityPreferences(
      message.session_id,
      message.participant_id,
      message.channels ?? [],
    );

    if (!updated) {
      this.logger.debug(
        `No participant ${message.participant_id} in session ${message.session_id}; preference stored for a later join`,
      );
      return;
    }

    this.logger.log(
      `Applied accessibility preferences to participant ${updated.id} in session ${updated.sessionId} (captions: ${updated.captionsEnabled}, avatar: ${updated.avatarEnabled})`,
    );
  }
}
