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
    const updated = await this.sessionsService.updateAccessibilityPreferences(
      message.userId,
      message.captionsEnabled,
      message.avatarEnabled,
    );

    this.logger.log(
      `Applied accessibility preferences for user ${message.userId} to ${updated} active session participant(s)`,
    );
  }
}
