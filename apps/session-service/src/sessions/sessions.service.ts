import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSessionDto } from "./dto/create-session.dto";
import { JoinSessionDto } from "./dto/join-session.dto";
import { PreferenceClientService } from "./preference-client.service";
import {
  CommunicationMode,
  Session,
  SessionParticipant,
} from "../prisma/client";
import { ClientProxy } from "@nestjs/microservices";
import {
  SESSION_CREATED_EVENT,
  SESSION_ENDED_EVENT,
  SessionCreatedPayload,
  SessionEndedPayload,
} from "@inclusaai/kafka-contracts";
import { KAFKA_SERVICE } from "../kafka/kafka.module";
import { randomBytes } from "crypto";

@Injectable()
export class SessionsService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);

  // Events handed to Kafka but not yet acknowledged. emit() is fire-and-forget,
  // so a response can go out before its event is sent; shutdown drains these
  // rather than disconnecting the producer underneath them and losing them.
  private readonly pendingEvents = new Set<Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferenceClient: PreferenceClientService,
    @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientProxy,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled(this.pendingEvents);
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
      throw new NotFoundException("Presentation not found.");
    }

    if (presentation.ownerId !== userId) {
      throw new UnauthorizedException("You do not own this presentation.");
    }

    const session = await this.createSessionWithUniqueJoinCode(
      presentationId,
      userId,
      createSessionDto.communicationMode,
    );

    // Create a long-lived join token for the presenter
    await this.createJoinToken(session.id, 24 * 60 * 60); // 24 hours

    const payload: SessionCreatedPayload = {
      sessionId: session.id,
      presentationId: presentation.id,
      organizationId: presentation.organizationId,
      joinCode: session.joinCode,
    };
    this.publish(SESSION_CREATED_EVENT, payload);

    return session;
  }

  async end(sessionId: string, userId: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { presentation: true },
    });

    if (!session) {
      throw new NotFoundException("Session not found.");
    }

    if (session.presentation.ownerId !== userId) {
      throw new UnauthorizedException("You do not own this session.");
    }

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
      },
    });

    const payload: SessionEndedPayload = {
      sessionId: updatedSession.id,
      endedAt: updatedSession.endedAt.toISOString(),
    };
    this.publish(SESSION_ENDED_EVENT, payload);

    return updatedSession;
  }

  /**
   * Admits a participant to an ACTIVE session via its join code.
   *
   * Works for both signed-in and anonymous participants: `userId` is null for
   * anonymous joins, and Postgres treats NULLs as distinct, so the
   * (sessionId, userId) unique constraint still permits many anonymous
   * attendees while keeping signed-in attendance idempotent.
   */
  async join(
    joinSessionDto: JoinSessionDto,
    userId?: string,
    bearerToken?: string,
  ): Promise<SessionParticipant> {
    const session = await this.prisma.session.findUnique({
      where: { joinCode: joinSessionDto.joinCode },
    });

    if (!session) {
      throw new NotFoundException("No session found for that join code.");
    }

    if (session.status !== "ACTIVE") {
      throw new ConflictException("That session is not currently active.");
    }

    const preferences = await this.preferenceClient.resolveFor(bearerToken);

    // Anonymous: always a new attendee row, since there is no identity to
    // reconcile against an existing one.
    if (!userId) {
      return this.prisma.sessionParticipant.create({
        data: {
          sessionId: session.id,
          displayName: joinSessionDto.displayName ?? null,
          ...preferences,
        },
      });
    }

    // Signed in: re-joining (a dropped connection, a second device) updates
    // the existing row rather than creating a duplicate attendee.
    return this.prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: { sessionId: session.id, userId },
      },
      create: {
        sessionId: session.id,
        userId,
        displayName: joinSessionDto.displayName ?? null,
        ...preferences,
      },
      update: {
        leftAt: null,
        ...preferences,
      },
    });
  }

  /**
   * Applies a participant's updated accessibility preferences to every session
   * they are currently attending.
   *
   * Scoped to `SessionParticipant`, not `Session`: `Session.userId` is the
   * presenter who started the session, so matching on it would apply an
   * audience member's preference to the wrong person's session — or, far more
   * often, to nothing at all.
   */
  async updateAccessibilityPreferences(
    userId: string,
    captionsEnabled: boolean,
    avatarEnabled: boolean,
  ): Promise<number> {
    const { count } = await this.prisma.sessionParticipant.updateMany({
      where: {
        userId,
        leftAt: null,
        session: { status: "ACTIVE" },
      },
      data: {
        captionsEnabled,
        avatarEnabled,
      },
    });

    return count;
  }

  /**
   * Creates the session, retrying on the (rare) chance of a join-code
   * collision. `Session.joinCode` is unique, so without this a collision
   * surfaces to the caller as an unhandled Prisma P2002.
   */
  private async createSessionWithUniqueJoinCode(
    presentationId: string,
    userId: string,
    communicationMode: CommunicationMode,
    maxAttempts = 5,
  ): Promise<Session> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const joinCode = this.generateJoinCode();

      try {
        return await this.prisma.session.create({
          data: {
            presentationId,
            userId,
            communicationMode,
            joinCode,
            qrPayload: JSON.stringify({ presentationId, joinCode }),
            status: "ACTIVE",
            startedAt: new Date(),
          },
        });
      } catch (error) {
        if (attempt === maxAttempts || !this.isJoinCodeCollision(error)) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or throws.
    throw new ConflictException("Could not allocate a unique join code.");
  }

  private isJoinCodeCollision(error: unknown): boolean {
    const target = error as { code?: string; meta?: { target?: string[] } };
    return (
      target?.code === "P2002" &&
      (target.meta?.target ?? []).some((field) => field.includes("joinCode"))
    );
  }

  /**
   * Generates a join code using a CSPRNG over an unambiguous alphabet.
   *
   * A join code is the credential for entering a live session, so `Math.random`
   * is not acceptable here. The alphabet omits I, O, 0 and 1 because these get
   * read aloud and typed in from a projected slide.
   */
  private generateJoinCode(length = 6): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(length);
    let code = "";

    for (let i = 0; i < length; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }

    return code;
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

  private async createJoinToken(
    sessionId: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const token = randomBytes(32).toString("hex");
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
