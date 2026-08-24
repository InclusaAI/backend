import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ACCESSIBILITY_PREFERENCE_UPDATED_EVENT, AccessibilityPreferenceUpdatedPayload } from '@inclusaai/kafka-contracts';
import { ClientKafka } from '@nestjs/microservices';
import { OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PreferencesService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async findOne(userId: string) {
    let preferences = await this.prisma.accessibilityPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // If no preferences exist, create them with default values.
      preferences = await this.prisma.accessibilityPreference.create({
        data: { userId },
      });
    }

    return preferences;
  }

  async update(userId: string, updatePreferencesDto: UpdatePreferencesDto) {
    const updatedPreferences = await this.prisma.accessibilityPreference.update({
      where: { userId },
      data: updatePreferencesDto,
    });

    // Construct the event payload with the full current state
    const payload: AccessibilityPreferenceUpdatedPayload = {
      userId: updatedPreferences.userId,
      captionsEnabled: updatedPreferences.captionsEnabled,
      avatarEnabled: updatedPreferences.avatarEnabled,
    };

    // Publish the event to Kafka only after the DB update is successful
    this.kafkaClient.emit(ACCESSIBILITY_PREFERENCE_UPDATED_EVENT, payload);

    return updatedPreferences;
  }
}