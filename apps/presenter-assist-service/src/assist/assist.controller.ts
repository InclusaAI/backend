import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AssistService, CoachingHint } from './assist.service';
import { AssistGateway } from './assist.gateway';

/**
 * Kafka event handler that receives vision-quality and engagement signals,
 * runs coaching analysis, and pushes hints to the presenter via WebSocket.
 */
@Controller()
export class AssistController {
  private readonly logger = new Logger(AssistController.name);

  constructor(
    private readonly assistService: AssistService,
    private readonly assistGateway: AssistGateway,
  ) {}

  @EventPattern('ai.vision.quality.signal')
  handleVisionQuality(@Payload() data: any): void {
    this.logger.debug(`Vision quality signal: session=${data?.session_id} presenter=${data?.presenter_id}`);

    const hints = this.assistService.processVisionQuality(data);

    for (const hint of hints) {
      this.assistGateway.pushHint(hint);
      this.logger.log(
        `Coaching hint [${hint.type}/${hint.severity}]: ${hint.message} → session ${hint.sessionId}`,
      );
    }
  }

  @EventPattern('ai.engagement.signal.aggregate')
  handleEngagement(@Payload() data: any): void {
    this.logger.debug(`Engagement signal: session=${data?.session_id}`);

    const hints = this.assistService.processEngagement(data);

    for (const hint of hints) {
      this.assistGateway.pushHint(hint);
      this.logger.log(
        `Coaching hint [${hint.type}/${hint.severity}]: ${hint.message} → session ${hint.sessionId}`,
      );
    }
  }
}
