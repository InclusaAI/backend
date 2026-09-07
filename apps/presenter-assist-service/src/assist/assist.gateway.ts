import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CoachingHint } from './assist.service';

/**
 * Presenter Assist Gateway — WebSocket server that pushes real-time
 * coaching hints to the presenter's workspace.
 *
 * The presenter connects and joins their session. When the assist service
 * detects issues (lighting, framing, pace, engagement), hints are pushed
 * in real-time.
 *
 * Protocol:
 *   1. Connect to ws://localhost:3005
 *   2. Send: { event: 'join-session', data: { sessionId, presenterId } }
 *   3. Receive: coaching-hint events with type, severity, message, suggestion
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class AssistGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AssistGateway.name);

  @WebSocketServer()
  server: Server;

  /** Track socket -> session mapping */
  private readonly socketSessions: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket): void {
    this.logger.log(`Presenter connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const sessions = this.socketSessions.get(client.id);
    if (sessions) {
      for (const sessionId of sessions) {
        client.leave(`presenter:${sessionId}`);
      }
      this.socketSessions.delete(client.id);
    }
    this.logger.log(`Presenter disconnected: ${client.id}`);
  }

  /**
   * Presenter joins their session to receive coaching hints.
   */
  @SubscribeMessage('join-session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; presenterId: string },
  ): void {
    if (!data?.sessionId) {
      client.emit('error', { message: 'Missing sessionId' });
      return;
    }

    // Join the presenter-specific room
    client.join(`presenter:${data.sessionId}`);

    if (!this.socketSessions.has(client.id)) {
      this.socketSessions.set(client.id, new Set());
    }
    this.socketSessions.get(client.id)!.add(data.sessionId);

    this.logger.log(
      `Presenter ${data.presenterId} joined assist session ${data.sessionId}`,
    );

    client.emit('session-joined', {
      sessionId: data.sessionId,
      message: 'Connected to presenter assist',
    });
  }

  /**
   * Push a coaching hint to the presenter in a session.
   */
  pushHint(hint: CoachingHint): void {
    this.server.to(`presenter:${hint.sessionId}`).emit('coaching-hint', {
      type: hint.type,
      severity: hint.severity,
      message: hint.message,
      suggestion: hint.suggestion,
      timestamp_ms: hint.timestamp_ms,
    });
  }

  /**
   * Get the number of connected presenters in a session.
   */
  getSessionPresenterCount(sessionId: string): number {
    const room = this.server.sockets.adapter.rooms.get(`presenter:${sessionId}`);
    return room?.size ?? 0;
  }
}
