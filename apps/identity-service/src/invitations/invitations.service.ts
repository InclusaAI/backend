import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  OnModuleDestroy,
} from "@nestjs/common";
import { lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { randomBytes } from "crypto";
import { add } from "date-fns";
import { ClientKafka } from "@nestjs/microservices";
import { KAFKA_SERVICE } from "../kafka/kafka.module";
import {
  INVITATION_CREATED_EVENT,
  InvitationCreatedPayload,
} from "@inclusaai/kafka-contracts";

@Injectable()
export class InvitationsService implements OnModuleDestroy {
  private readonly logger = new Logger(InvitationsService.name);

  // Events handed to Kafka but not yet acknowledged. emit() is fire-and-forget,
  // so a response can go out before its event is sent; shutdown drains these
  // rather than disconnecting the producer underneath them and losing them.
  private readonly pendingEvents = new Set<Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled(this.pendingEvents);
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
      },
    });

    if (!inviterMembership || inviterMembership.role !== "ADMIN") {
      throw new ForbiddenException(
        "You do not have permission to invite users to this organization.",
      );
    }

    // 2. Check if the invited user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      const existingMembership = await this.prisma.orgMembership.findFirst({
        where: {
          organizationId,
          userId: existingUser.id,
        },
      });
      if (existingMembership) {
        throw new ConflictException(
          "This user is already a member of the organization.",
        );
      }
    }

    // 3. Check for an existing pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email,
        organizationId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        "An invitation for this email address to this organization is already pending.",
      );
    }

    // 4. Generate a secure token and set expiration
    const token = randomBytes(32).toString("hex");
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
    this.publish(INVITATION_CREATED_EVENT, payload);

    return {
      message: "Invitation sent successfully.",
      invitationId: invitation.id,
    };
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
