import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ParticipantTokenService } from "./participant-token.service";
import { ParticipantStateStore } from "./participant-state.store";
import { captionsRoom, participantRoom, sessionRoom } from "./rooms";

/** The event clients listen for. */
export const CAPTION_SEGMENT_EVENT = "transcript.segment";

/** What a client receives: a subset of the Kafka payload, never the raw message. */
export interface CaptionSegmentMessage {
  segmentId: string;
  sequence: number;
  text: string;
  isFinal: boolean;
  language?: string;
  startMs: number;
  endMs: number;
}

interface ParticipantSocketData {
  participantId: string;
  sessionId: string;
  userId: string | null;
  captionsEnabled: boolean;
}

/**
 * Delivers captions to the participants who want them.
 *
 * A connection is authenticated by the participant token from
 * POST /sessions/join, so a socket is always tied to one participant in one
 * session; there is no "join this session" message a client could use to
 * listen to a session it was never admitted to.
 *
 * CORS, the Redis adapter and connection state recovery are configured on the
 * server in RedisIoAdapter.
 */
@WebSocketGateway()
export class CaptionsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(CaptionsGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly tokens: ParticipantTokenService,
    private readonly state: ParticipantStateStore,
  ) {}

  afterInit(server: Server): void {
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("A participant token is required."));
      }

      try {
        const claims = await this.tokens.verify(token);

        if (await this.state.isSessionEnded(claims.sid)) {
          return next(new Error("That session has ended."));
        }

        const data: ParticipantSocketData = {
          participantId: claims.sub,
          sessionId: claims.sid,
          userId: claims.uid,
          captionsEnabled: claims.captionsEnabled,
        };
        socket.data = data;
        next();
      } catch {
        next(new Error("Invalid or expired participant token."));
      }
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    // A recovered connection already has its rooms and data back, and skipped
    // the middleware above; re-joining would be wrong as well as redundant.
    if (socket.recovered) {
      this.logger.debug(`Socket ${socket.id} recovered its session`);
      return;
    }

    const data = socket.data as ParticipantSocketData;

    await socket.join([
      sessionRoom(data.sessionId),
      participantRoom(data.participantId),
    ]);

    // Prefer what we have been told over the token's snapshot, which was taken
    // when the participant joined and may since have changed.
    const known = await this.state.get(data.participantId);
    const captionsEnabled = known?.captionsEnabled ?? data.captionsEnabled;

    if (captionsEnabled) {
      await socket.join(captionsRoom(data.sessionId));
    }

    this.logger.debug(
      `Participant ${data.participantId} connected to session ${data.sessionId} (captions: ${captionsEnabled})`,
    );
  }

  broadcastSegment(sessionId: string, segment: CaptionSegmentMessage): void {
    this.server
      .to(captionsRoom(sessionId))
      .emit(CAPTION_SEGMENT_EVENT, segment);
  }

  /**
   * Starts or stops captions for every socket this participant has, including
   * those held by other instances.
   */
  async setCaptions(
    sessionId: string,
    participantId: string,
    enabled: boolean,
  ): Promise<void> {
    const sockets = this.server.in(participantRoom(participantId));
    const room = captionsRoom(sessionId);

    if (enabled) {
      await sockets.socketsJoin(room);
    } else {
      await sockets.socketsLeave(room);
    }
  }

  /** Closes every connection for a session that has ended. */
  async endSession(sessionId: string): Promise<void> {
    await this.server.in(sessionRoom(sessionId)).disconnectSockets(true);
  }
}
