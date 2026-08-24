import { AccessibilityPreferenceUpdatedPayload } from '@inclusaai/kafka-contracts';
import { SessionsService } from './sessions.service';
export declare class KafkaController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    handleAccessibilityPreferenceUpdated(message: AccessibilityPreferenceUpdatedPayload): Promise<void>;
}
