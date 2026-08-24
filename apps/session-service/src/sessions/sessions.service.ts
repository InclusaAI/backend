import { Injectable, Inject, OnModuleDestroy, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { Session } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { SESSION_CREATED_EVENT, SESSION_ENDED_EVENT, SessionCreatedPayload, SessionEndedPayload } from '@inclusaai/kafka-contracts';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class SessionsService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientProxy,
  ) {}

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async start(
    presentationId: string,
    createSessionDto: CreateSessionDto,
    userId: string,
  ): Promise<Session> {
    const presentation = await this.prisma.presentation.findUnique({
      where: { id: presentationId },
    });

    if (!presentation) {
      throw new NotFoundException('Presentation not found.');
    }

    if (presentation.ownerId !== userId) {
      throw new UnauthorizedException('You do not own this presentation.');
    }

    const joinCode = this.generateJoinCode();
    const qrPayload = JSON.stringify({ presentationId, joinCode });

    const session = await this.prisma.session.create({
      data: {
        presentationId,
        userId,
        communicationMode: createSessionDto.communicationMode,
        joinCode,
        qrPayload,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Create a long-lived join token for the presenter
    await this.createJoinToken(session.id, 24 * 60 * 60); // 24 hours

    const payload: SessionCreatedPayload = {
      sessionId: session.id,
      presentationId: presentation.id,
      organizationId: presentation.organizationId,
      joinCode: session.joinCode,
    };
    this.kafkaClient.emit(SESSION_CREATED_EVENT, payload);

    return session;
  }

  async end(sessionId: string, userId: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { presentation: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    if (session.presentation.ownerId !== userId) {
      throw new UnauthorizedException('You do not own this session.');
    }

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    const payload: SessionEndedPayload = {
      sessionId: updatedSession.id,
      endedAt: updatedSession.endedAt.toISOString(),
    };
    this.kafkaClient.emit(SESSION_ENDED_EVENT, payload);

    return updatedSession;
  }

  async updateAccessibilityPreferences(
    userId: string,
    captionsEnabled: boolean,
    avatarEnabled: boolean,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      data: {
        captionsEnabled,
        avatarEnabled,
      },
    });
  }

  private generateJoinCode(length: number = 6): string {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
  }

  private async createJoinToken(sessionId: string, expiresInSeconds: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.prisma.joinToken.create({
      data: {
        sessionId,
        token,
        expiresAt,
      },
    });

    return token;
  }
}