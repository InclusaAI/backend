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

/**
 * Fanout Gateway — WebSocket server that pushes real-time AI outputs
 * to connected web-app clients (presenter workspace, audience portal).
 *
 * Clients join a room by session ID. When AI services produce outputs
 * (captions, sign recognition, translations, avatar poses, etc.),
 * this gateway fans them out to all participants in the session.
 *
 * Event flow:
 *   ai-services → Kafka → FanoutGateway → WebSocket → web-apps
 *
 * Client protocol:
 *   1. Connect to ws://localhost:3004
 *   2. Send: { event: 'join-session', data: { sessionId, role } }
 *   3. Receive: ai.transcript.segment, ai.sign.recognition.result, etc.
 *   4. Send: { event: 'leave-session', data: { sessionId } }
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class FanoutGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(FanoutGateway.name);

  @WebSocketServer()
  server: Server;

  /** Track socket -> session mapping for cleanup */
  private readonly socketSessions: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const sessions = this.socketSessions.get(client.id);
    if (sessions) {
      for (const sessionId of sessions) {
        client.leave(sessionId);
      }
      this.socketSessions.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a session room to receive AI outputs.
   */
  @SubscribeMessage('join-session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; role?: string },
  ): void {
    if (!data?.sessionId) {
      client.emit('error', { message: 'Missing sessionId' });
      return;
    }

    client.join(data.sessionId);

    if (!this.socketSessions.has(client.id)) {
      this.socketSessions.set(client.id, new Set());
    }
    this.socketSessions.get(client.id)!.add(data.sessionId);

    this.logger.log(
      `Client ${client.id} joined session ${data.sessionId} (role: ${data.role ?? 'unknown'})`,
    );

    client.emit('session-joined', {
      sessionId: data.sessionId,
      message: 'Connected to session fanout',
    });
  }

  /**
   * Client leaves a session room.
   */
  @SubscribeMessage('leave-session')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): void {
    if (!data?.sessionId) return;

    client.leave(data.sessionId);
    this.socketSessions.get(client.id)?.delete(data.sessionId);

    this.logger.log(`Client ${client.id} left session ${data.sessionId}`);
  }

  // -------------------------------------------------------------------------
  // Methods called by KafkaConsumerService to fan out AI outputs
  // -------------------------------------------------------------------------

  /**
   * Push a transcript segment to all clients in a session.
   */
  pushTranscript(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.transcript.segment', payload);
  }

  /**
   * Push a sign recognition result to all clients in a session.
   */
  pushSignRecognition(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.sign.recognition.result', payload);
  }

  /**
   * Push a translation result to all clients in a session.
   */
  pushTranslation(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.translation.result', payload);
  }

  /**
   * Push a TTS audio chunk to all clients in a session.
   */
  pushTtsAudio(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.tts.audio.chunk', payload);
  }

  /**
   * Push an avatar pose frame to all clients in a session.
   */
  pushAvatarPose(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.avatar.pose.frame', payload);
  }

  /**
   * Push a vision quality signal to all clients in a session.
   */
  pushVisionQuality(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.vision.quality.signal', payload);
  }

  /**
   * Push an engagement signal to all clients in a session.
   */
  pushEngagement(sessionId: string, payload: any): void {
    this.server.to(sessionId).emit('ai.engagement.signal.aggregate', payload);
  }

  /**
   * Push participant events to all clients in a session.
   */
  pushParticipantEvent(sessionId: string, eventType: string, payload: any): void {
    this.server.to(sessionId).emit(`participant.${eventType}`, payload);
  }

  /**
   * Get the number of connected clients in a session.
   */
  getSessionClientCount(sessionId: string): number {
    const room = this.server.sockets.adapter.rooms.get(sessionId);
    return room?.size ?? 0;
  }
}
