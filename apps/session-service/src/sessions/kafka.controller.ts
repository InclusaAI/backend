
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ACCESSIBILITY_PREFERENCE_UPDATED_EVENT,
  AccessibilityPreferenceUpdatedPayload,
} from '@inclusaai/kafka-contracts';
import { SessionsService } from './sessions.service';

@Controller()
export class KafkaController {
  constructor(private readonly sessionsService: SessionsService) {}

  @MessagePattern(ACCESSIBILITY_PREFERENCE_UPDATED_EVENT)
  async handleAccessibilityPreferenceUpdated(
    @Payload() message: AccessibilityPreferenceUpdatedPayload,
  ) {
    console.log(
      `Received accessibility preference update for user ${message.userId}`,
    );
    await this.sessionsService.updateAccessibilityPreferences(
      message.userId,
      message.captionsEnabled,
      message.avatarEnabled,
    );
  }
}