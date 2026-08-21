import { OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { ClientKafka } from '@nestjs/microservices';
export declare class InvitationsService implements OnModuleDestroy {
    private readonly prisma;
    private readonly kafkaClient;
    constructor(prisma: PrismaService, kafkaClient: ClientKafka);
    onModuleDestroy(): Promise<void>;
    create(createInvitationDto: CreateInvitationDto, inviterId: string): Promise<{
        message: string;
        invitationId: any;
    }>;
}
