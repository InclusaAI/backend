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

// ---------------------------------------------------------------------------
// Accessibility preference events
// ---------------------------------------------------------------------------

export const ACCESSIBILITY_PREFERENCE_UPDATED_EVENT = 'accessibility.preference.updated';

/**
 * Accessibility channels a participant may need.
 * Matches inclusaai_contracts.events.AccessibilityChannel
 */
export type AccessibilityChannel = 'captions' | 'avatar' | 'gestures' | 'translation' | 'tts';

/**
 * Published when a participant updates their accessibility preferences.
 * Consumed by ai-services for preference-aware gating.
 * Contract: inclusaai_contracts.events.AccessibilityPreferenceUpdated
 */
export interface AccessibilityPreferenceUpdatedPayload {
  session_id: string;
  participant_id: string;
  channels: AccessibilityChannel[];
  caption_language?: string | null;
  translation_target_language?: string | null;
  sign_language?: string;  // default: 'ASL' (ADR-0002)
  updated_at_ms: number;
}