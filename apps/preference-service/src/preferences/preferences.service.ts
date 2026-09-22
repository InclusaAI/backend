import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import {
  ACCESSIBILITY_PREFERENCE_UPDATED_EVENT,
  AccessibilityPreferenceUpdatedPayload,
} from "@inclusaai/kafka-contracts";
import { ClientKafka } from "@nestjs/microservices";
import { OnModuleDestroy } from "@nestjs/common";
import { lastValueFrom } from "rxjs";

@Injectable()
export class PreferencesService implements OnModuleDestroy {
  private readonly logger = new Logger(PreferencesService.name);

  // Events handed to Kafka but not yet acknowledged. emit() is fire-and-forget,
  // so a response can go out before its event is sent; shutdown drains these
  // rather than disconnecting the producer underneath them and losing them.
  private readonly pendingEvents = new Set<Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject("KAFKA_SERVICE") private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled(this.pendingEvents);
    await this.kafkaClient.close();
  }

  async findOne(userId: string) {
    // upsert rather than find-then-create: two concurrent first reads would
    // otherwise race and one would fail the userId unique constraint.
    return this.prisma.accessibilityPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async update(userId: string, updatePreferencesDto: UpdatePreferencesDto) {
    // upsert, not update: a participant may set a preference before anything
    // has read one for them, and there is no separate "create preferences"
    // step in the API. A plain update throws P2025 for a first-time user,
    // surfacing as a 500 on what is a perfectly ordinary first request.
    const updatedPreferences = await this.prisma.accessibilityPreference.upsert(
      {
        where: { userId },
        create: { userId, ...updatePreferencesDto },
        update: updatePreferencesDto,
      },
    );

    // Construct the event payload with the full current state
    const payload: AccessibilityPreferenceUpdatedPayload = {
      userId: updatedPreferences.userId,
      captionsEnabled: updatedPreferences.captionsEnabled,
      avatarEnabled: updatedPreferences.avatarEnabled,
    };

    // Publish the event to Kafka only after the DB update is successful
    this.publish(ACCESSIBILITY_PREFERENCE_UPDATED_EVENT, payload);

    return updatedPreferences;
  }

  /**
   * Publishes an event without making the caller wait for Kafka, while keeping
   * it tracked until acknowledged so shutdown can drain it. A failed send is
   * logged: previously it was dropped with no trace at all.
   */
  private publish(topic: string, payload: unknown): void {
    const sent: Promise<unknown> = lastValueFrom(
      this.kafkaClient.emit(topic, payload),
      { defaultValue: undefined },
    )
      .catch((error: Error) =>
        this.logger.error(`Failed to publish ${topic}`, error?.stack),
      )
      .finally(() => this.pendingEvents.delete(sent));
    this.pendingEvents.add(sent);
  }
}
