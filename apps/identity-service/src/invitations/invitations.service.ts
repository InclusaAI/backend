import { Injectable, Inject, UnauthorizedException, ConflictException, ForbiddenException, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { randomBytes } from 'crypto';
import { add } from 'date-fns';
import { ClientKafka } from '@nestjs/microservices';
import { KAFKA_SERVICE } from '../kafka/kafka.module';
import { INVITATION_CREATED_EVENT, InvitationCreatedPayload } from '@inclusaai/kafka-contracts';

@Injectable()
export class InvitationsService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async create(createInvitationDto: CreateInvitationDto, inviterId: string) {
    const { email, organizationId } = createInvitationDto;

    // 1. Verify the inviter is an ADMIN of the organization
    const inviterMembership = await this.prisma.orgMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: inviterId,
        },
      },
      include: {
        user: true,
        organization: true,
      }
    });

    if (!inviterMembership || inviterMembership.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to invite users to this organization.');
    }

    // 2. Check if the invited user is already a member
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.prisma.orgMembership.findFirst({
        where: {
          organizationId,
          userId: existingUser.id,
        },
      });
      if (existingMembership) {
        throw new ConflictException('This user is already a member of the organization.');
      }
    }

    // 3. Check for an existing pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
        where: {
            email,
            organizationId,
            status: 'PENDING',
        }
    });

    if (existingInvitation) {
        throw new ConflictException('An invitation for this email address to this organization is already pending.');
    }

    // 4. Generate a secure token and set expiration
    const token = randomBytes(32).toString('hex');
    const expiresAt = add(new Date(), { days: 7 }); // Invitation expires in 7 days

    // 5. Create the invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        organizationId,
        inviterId,
        token,
        expiresAt,
      },
    });

    // 6. Publish kafka event
    const payload: InvitationCreatedPayload = {
        invitationId: invitation.id,
        email: invitation.email,
        organizationName: inviterMembership.organization.name,
        inviterName: inviterMembership.user.name,
    };
    this.kafkaClient.emit(INVITATION_CREATED_EVENT, payload);


    return {
        message: 'Invitation sent successfully.',
        invitationId: invitation.id,
    };
  }
}