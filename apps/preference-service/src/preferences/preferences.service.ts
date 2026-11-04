import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import {
  AccessibilityChannel,
  CreatePreferenceDto,
} from "./dto/create-preference.dto";
import {
  ACCESSIBILITY_PREFERENCE_UPDATED_EVENT,
  AccessibilityPreferenceUpdatedPayload,
} from "@inclusaai/kafka-contracts";

/** Shape returned to clients: camelCase, like the rest of the public API. */
interface PreferenceResponse {
  sessionId: string;
  participantId: string;
  channels: AccessibilityChannel[];
  captionLanguage: string | null;
  translationTargetLanguage: string | null;
  signLanguage: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class PreferencesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject("KAFKA_SERVICE") private readonly kafkaClient: ClientProxy,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
  }

  /**
   * Create or update this participant's preferences for this session and tell
   * ai-services about the new state.
   *
   * The ids come from the verified participant token, so a caller can only
   * ever write their own record.
   */
  async upsertPreference(
    sessionId: string,
    participantId: string,
    dto: CreatePreferenceDto,
  ) {
    // Prisma stores the channels as an enum (CAPTIONS, AVATAR, ...) while the
    // wire contract uses lower-case values. Passing the DTO straight through
    // would fail Prisma's enum validation at runtime.
    const channels = dto.channels.map((channel) =>
      channel.toUpperCase(),
    ) as unknown as PrismaAccessibilityChannel[];

    const preference = await this.prisma.accessibilityPreference.upsert({
      where: { sessionId_participantId: { sessionId, participantId } },
      create: {
        sessionId,
        participantId,
        channels,
        captionLanguage: dto.captionLanguage,
        translationTargetLanguage: dto.translationTargetLanguage,
        signLanguage: dto.signLanguage ?? "ASL",
      },
      update: {
        channels,
        captionLanguage: dto.captionLanguage,
        translationTargetLanguage: dto.translationTargetLanguage,
        signLanguage: dto.signLanguage ?? "ASL",
      },
    });

    this.logger.log(
      `Preference updated: session=${sessionId} participant=${participantId} channels=[${dto.channels}]`,
    );

    this.publish(participantId, {
      session_id: sessionId,
      participant_id: participantId,
      channels: dto.channels,
      caption_language: dto.captionLanguage ?? null,
      translation_target_language: dto.translationTargetLanguage ?? null,
      sign_language: dto.signLanguage ?? "ASL",
      updated_at_ms: preference.updatedAt.getTime(),
    });

    return { status: "success", data: this.toResponse(preference) };
  }

  /** This participant's settings for this session, or the defaults. */
  async getPreference(sessionId: string, participantId: string) {
    const preference = await this.prisma.accessibilityPreference.findUnique({
      where: { sessionId_participantId: { sessionId, participantId } },
    });

    if (!preference) {
      // Fail-open per IMPLEMENTATION §5: a participant with nothing stored is
      // simply not asking for any extra channel.
      return {
        status: "success",
        data: {
          sessionId,
          participantId,
          channels: [] as AccessibilityChannel[],
          captionLanguage: null,
          translationTargetLanguage: null,
          signLanguage: "ASL",
        },
      };
    }

    return { status: "success", data: this.toResponse(preference) };
  }

  async deletePreference(sessionId: string, participantId: string) {
    await this.prisma.accessibilityPreference.deleteMany({
      where: { sessionId, participantId },
    });

    return {
      status: "success",
      message: `Preferences deleted for participant ${participantId} in session ${sessionId}`,
    };
  }

  /**
   * Publishes a preference change without making the caller wait for Kafka,
   * while keeping the send tracked so a failure is logged rather than lost.
   *
   * Keyed by participant so one participant's updates stay on one partition,
   * and therefore in order.
   */
  private publish(
    key: string,
    payload: AccessibilityPreferenceUpdatedPayload,
  ): void {
    const sent: Promise<unknown> = lastValueFrom(
      this.kafkaClient.emit(
        ACCESSIBILITY_PREFERENCE_UPDATED_EVENT,
        { key, value: payload },
      ),
      { defaultValue: undefined },
    ).catch((error: Error) =>
      this.logger.error(
        `Failed to publish ${ACCESSIBILITY_PREFERENCE_UPDATED_EVENT}`,
        error?.stack,
      ),
    );
    void sent;
  }

  private toResponse(preference: {
    sessionId: string;
    participantId: string;
    channels: PrismaAccessibilityChannel[];
    captionLanguage: string | null;
    translationTargetLanguage: string | null;
    signLanguage: string;
    createdAt: Date;
    updatedAt: Date;
  }): PreferenceResponse {
    return {
      sessionId: preference.sessionId,
      participantId: preference.participantId,
      channels: preference.channels.map((channel) =>
        channel.toLowerCase(),
      ) as AccessibilityChannel[],
      captionLanguage: preference.captionLanguage,
      translationTargetLanguage: preference.translationTargetLanguage,
      signLanguage: preference.signLanguage,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }
}

/** The Prisma enum, named so the mapping above is explicit. */
type PrismaAccessibilityChannel = "CAPTIONS" | "AVATAR" | "GESTURES" | "TRANSLATION" | "TTS";
