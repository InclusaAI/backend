export const SESSION_CREATED_EVENT = 'session.created';
export const SESSION_UPDATED_EVENT = 'session.updated';
export const SESSION_ENDED_EVENT = 'session.ended';

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