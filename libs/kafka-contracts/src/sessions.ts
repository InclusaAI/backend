export const SESSION_CREATED_EVENT = "session.created";
export const SESSION_UPDATED_EVENT = "session.updated";
export const SESSION_ENDED_EVENT = "session.ended";

export interface SessionCreatedPayload {
  sessionId: string;
  presentationId: string;
  organizationId: string;
  joinCode: string;
}

export interface SessionUpdatedPayload {
  sessionId: string;
  status: string;
}

export interface SessionEndedPayload {
  sessionId: string;
  endedAt: string;
}

export const SESSION_PARTICIPANT_UPDATED_EVENT = "session.participant.updated";

/** Current shape of SessionParticipantUpdatedPayload. */
export const SESSION_PARTICIPANT_UPDATED_SCHEMA_VERSION = 1;

/**
 * A participant's accessibility settings as they apply in one session.
 *
 * Published by session-service, keyed by sessionId, whenever a participant
 * joins, changes a setting for the session, or has their durable preference
 * (accessibility.preference.updated) applied. Always the full current state.
 *
 * Consumed by fanout-service to decide which sockets receive captions. Also
 * proposed to ai-services for per-session pipeline gating (issue #4).
 */
export interface SessionParticipantUpdatedPayload {
  /** Which shape this message follows; see the note on the other events. */
  schemaVersion: number;

  sessionId: string;
  participantId: string;

  /** null for an anonymous participant who joined by code. */
  userId: string | null;

  /**
   * What the participant is called, as they gave it when joining. Carried here
   * so a consumer can label a speaker without querying session-service:
   * ai.transcript.segment identifies a speaker by participant id only.
   */
  displayName: string | null;

  captionsEnabled: boolean;
  avatarEnabled: boolean;

  /** ISO-8601. Consumers ignore an update older than the one they hold. */
  updatedAt: string;
}
