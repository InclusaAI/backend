import { OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { Session } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
export declare class SessionsService implements OnModuleDestroy {
    private readonly prisma;
    private readonly kafkaClient;
    constructor(prisma: PrismaService, kafkaClient: ClientProxy);
    onModuleDestroy(): Promise<void>;
    start(presentationId: string, createSessionDto: CreateSessionDto, userId: string): Promise<Session>;
    end(sessionId: string, userId: string): Promise<Session>;
    updateAccessibilityPreferences(userId: string, captionsEnabled: boolean, avatarEnabled: boolean): Promise<void>;
    private generateJoinCode;
    private createJoinToken;
}
