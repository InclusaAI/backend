import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreferenceDto, AccessibilityChannel } from './dto/create-preference.dto';
import {
  ACCESSIBILITY_PREFERENCE_UPDATED_EVENT,
  AccessibilityPreferenceUpdatedPayload,
} from '@inclusaai/kafka-contracts';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  /**
   * Create or update accessibility preferences for a participant in a session.
   * Publishes accessibility.preference.updated to Kafka for ai-services consumption.
   */
  async upsertPreference(dto: CreatePreferenceDto) {
    const preference = await this.prisma.accessibilityPreference.upsert({
      where: {
        sessionId_participantId: {
          sessionId: dto.sessionId,
          participantId: dto.participantId,
        },
      },
      create: {
        sessionId: dto.sessionId,
        participantId: dto.participantId,
        channels: dto.channels,
        captionLanguage: dto.captionLanguage,
        translationTargetLanguage: dto.translationTargetLanguage,
        signLanguage: dto.signLanguage ?? 'ASL',
      },
      update: {
        channels: dto.channels,
        captionLanguage: dto.captionLanguage,
        translationTargetLanguage: dto.translationTargetLanguage,
        signLanguage: dto.signLanguage ?? 'ASL',
      },
    });

    this.logger.log(
      `Preference updated: session=${dto.sessionId} participant=${dto.participantId} channels=[${dto.channels}]`,
    );

    // Publish to Kafka for ai-services preference-aware gating
    const event: AccessibilityPreferenceUpdatedPayload = {
      session_id: dto.sessionId,
      participant_id: dto.participantId,
      channels: dto.channels,
      caption_language: dto.captionLanguage ?? null,
      translation_target_language: dto.translationTargetLanguage ?? null,
      sign_language: dto.signLanguage ?? 'ASL',
      updated_at_ms: Date.now(),
    };

    this.kafkaClient.emit(ACCESSIBILITY_PREFERENCE_UPDATED_EVENT, event);

    return {
      status: 'success',
      data: this.toResponse(preference),
    };
  }

  /**
   * Get preferences for a specific participant in a session.
   */
  async getPreference(sessionId: string, participantId: string) {
    const preference = await this.prisma.accessibilityPreference.findUnique({
      where: {
        sessionId_participantId: {
          sessionId,
          participantId,
        },
      },
    });

    if (!preference) {
      // Return empty defaults — fail-open per IMPLEMENTATION §5
      return {
        status: 'success',
        data: {
          sessionId,
          participantId,
          channels: [],
          captionLanguage: null,
          translationTargetLanguage: null,
          signLanguage: 'ASL',
        },
      };
    }

    return {
      status: 'success',
      data: this.toResponse(preference),
    };
  }

  /**
   * Get all preferences for a session.
   */
  async getSessionPreferences(sessionId: string) {
    const preferences = await this.prisma.accessibilityPreference.findMany({
      where: { sessionId },
    });

    return {
      status: 'success',
      data: preferences.map((p) => this.toResponse(p)),
    };
  }

  /**
   * Remove preferences for a participant.
   */
  async deletePreference(sessionId: string, participantId: string) {
    await this.prisma.accessibilityPreference.deleteMany({
      where: { sessionId, participantId },
    });

    return {
      status: 'success',
      message: `Preferences deleted for participant ${participantId} in session ${sessionId}`,
    };
  }

  private toResponse(preference: any) {
    return {
      id: preference.id,
      sessionId: preference.sessionId,
      participantId: preference.participantId,
      channels: preference.channels,
      captionLanguage: preference.captionLanguage,
      translationTargetLanguage: preference.translationTargetLanguage,
      signLanguage: preference.signLanguage,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }
}
