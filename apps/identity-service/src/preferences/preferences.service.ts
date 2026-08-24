import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ACCESSIBILITY_PREFERENCE_UPDATED_EVENT, AccessibilityPreferenceUpdatedPayload } from '@inclusaai/kafka-contracts';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async findOne(userId: string) {
    let preferences = await this.prisma.accessibilityPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await this.prisma.accessibilityPreference.create({
        data: { userId },
      });
    }

    return preferences;
  }

  async update(userId: string, updatePreferencesDto: UpdatePreferencesDto) {
    const preferences = await this.findOne(userId);

    const updatedPreferences = await this.prisma.accessibilityPreference.update({
      where: { id: preferences.id },
      data: updatePreferencesDto,
    });

    const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true },
    });

    if (!user) {
        throw new NotFoundException('User not found');
    }

    const payload: AccessibilityPreferenceUpdatedPayload = {
      userId: updatedPreferences.userId,
      organizationId: user.memberships[0]?.organizationId, // Assuming user belongs to at least one org
      captionsEnabled: updatedPreferences.captionsEnabled,
      avatarEnabled: updatedPreferences.avatarEnabled,
    };

    this.kafkaClient.emit(ACCESSIBILITY_PREFERENCE_UPDATED_EVENT, payload);

    return updatedPreferences;
  }
}