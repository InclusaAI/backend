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
import { UpdateParticipantPreferencesDto } from "./dto/update-participant-preferences.dto";
import { PreferenceClientService } from "./preference-client.service";
import { ParticipantTokenService } from "./participant-token.service";
import { ParticipantTokenClaims } from "@inclusaai/shared-types";
import {
  CommunicationMode,
  Session,
  SessionParticipant,
} from "../prisma/client";
import { ClientProxy } from "@nestjs/microservices";
import {
  SESSION_CREATED_EVENT,
  SESSION_ENDED_EVENT,
  SESSION_PARTICIPANT_UPDATED_EVENT,
  SessionCreatedPayload,
  SessionEndedPayload,
  SessionParticipantUpdatedPayload,
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
    private readonly participantTokens: ParticipantTokenService,
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
  ): Promise<SessionParticipant & { participantToken: string }> {
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

    const participant = userId
      ? // Signed in: re-joining (a dropped connection, a second device)
        // updates the existing row rather than creating a duplicate attendee.
        await this.prisma.sessionParticipant.upsert({
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
        })
      : // Anonymous: always a new attendee row, since there is no identity to
        // reconcile against an existing one.
        await this.prisma.sessionParticipant.create({
          data: {
            sessionId: session.id,
            displayName: joinSessionDto.displayName ?? null,
            ...preferences,
          },
        });

    this.publishParticipant(participant);

    // The credential for this participant's realtime connection (fanout) and
    // for changing their own settings in this session.
    const participantToken = await this.participantTokens.issue({
      sub: participant.id,
      sid: participant.sessionId,
      uid: participant.userId,
      captionsEnabled: participant.captionsEnabled,
    });

    return { ...participant, participantToken };
  }

  /**
   * Changes the calling participant's settings for this session only. Works
   * for anonymous participants, who have no durable preferences to change.
   */
  async updateOwnPreferences(
    caller: ParticipantTokenClaims,
    dto: UpdateParticipantPreferencesDto,
  ): Promise<SessionParticipant> {
    const participant = await this.prisma.sessionParticipant.findUnique({
      where: { id: caller.sub },
      include: { session: true },
    });

    // The token names both ids; refuse a mismatch rather than trust either.
    if (!participant || participant.sessionId !== caller.sid) {
      throw new NotFoundException("Participant not found.");
    }

    if (participant.session.status !== "ACTIVE") {
      throw new ConflictException("That session is not currently active.");
    }

    const updated = await this.prisma.sessionParticipant.update({
      where: { id: participant.id },
      data: {
        captionsEnabled: dto.captionsEnabled,
        avatarEnabled: dto.avatarEnabled,
      },
    });

    this.publishParticipant(updated);
    return updated;
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
    const where = {
      userId,
      leftAt: null,
      session: { status: "ACTIVE" },
    };

    const { count } = await this.prisma.sessionParticipant.updateMany({
      where,
      data: {
        captionsEnabled,
        avatarEnabled,
      },
    });

    if (count === 0) {
      return 0;
    }

    // One event per session the participant is in, so each session's
    // consumers (fanout, ai-services) see the change.
    const updated = await this.prisma.sessionParticipant.findMany({ where });
    for (const participant of updated) {
      this.publishParticipant(participant);
    }

    return updated.length;
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

  /** Publishes a participant's current settings for their session. */
  private publishParticipant(participant: SessionParticipant): void {
    const payload: SessionParticipantUpdatedPayload = {
      sessionId: participant.sessionId,
      participantId: participant.id,
      userId: participant.userId,
      captionsEnabled: participant.captionsEnabled,
      avatarEnabled: participant.avatarEnabled,
      updatedAt: new Date().toISOString(),
    };
    this.publish(
      SESSION_PARTICIPANT_UPDATED_EVENT,
      payload,
      participant.sessionId,
    );
  }

  /**
   * Publishes an event without making the caller wait for Kafka, while keeping
   * it tracked until acknowledged so shutdown can drain it. A failed send is
   * logged: previously it was dropped with no trace at all.
   */
  private publish(topic: string, payload: unknown, key?: string): void {
    // A key keeps related events (e.g. one session's) on one partition, and
    // therefore in order.
    const message = key === undefined ? payload : { key, value: payload };
    const sent: Promise<unknown> = lastValueFrom(
      this.kafkaClient.emit(topic, message),
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
