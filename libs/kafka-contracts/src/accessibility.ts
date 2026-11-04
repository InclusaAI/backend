/**
 * @file Defines the contract for the accessibility.preference.updated event.
 *
 * This is the ONLY definition of this event. An earlier revision also declared
 * it in `sessions.ts`, with a different (account-scoped) shape, so which one a
 * service saw depended on export order. The participant-scoped shape below is
 * canonical because it is what `ai-services` consumes — it is validated against
 * `inclusaai_contracts.events.AccessibilityPreferenceUpdated` on that side, and
 * a payload with different field names fails validation there instead of
 * gating any work.
 */

/** The topic ai-services reads to decide which outputs a participant needs. */
export const ACCESSIBILITY_PREFERENCE_UPDATED_EVENT =
  "accessibility.preference.updated";

/** Current shape of AccessibilityPreferenceUpdatedPayload. */
export const ACCESSIBILITY_PREFERENCE_UPDATED_SCHEMA_VERSION = 1;

/**
 * Accessibility channels a participant may need.
 * Matches inclusaai_contracts.events.AccessibilityChannel.
 */
export type AccessibilityChannel =
  | "captions"
  | "avatar"
  | "gestures"
  | "translation"
  | "tts";

/**
 * The payload for ACCESSIBILITY_PREFERENCE_UPDATED_EVENT.
 *
 * It contains the complete state of one participant's preferences for one
 * session, so a consumer can gate work without asking for anything else.
 */
export interface AccessibilityPreferenceUpdatedPayload {
  /**
   * The session-service session the participant is in. ai-services gates
   * pipeline work per session, so this is not optional.
   */
  session_id: string;

  /**
   * The session-service SessionParticipant id — the same id the participant
   * token carries as `sub`, and the id `media.session.*` events use as
   * `speaker_id`.
   */
  participant_id: string;

  /** Every channel this participant wants generated for them. */
  channels: AccessibilityChannel[];

  /** BCP 47 language tag for captions, when the participant chose one. */
  caption_language?: string | null;

  /** BCP 47 language tag for translated output, when requested. */
  translation_target_language?: string | null;

  /** ASL only for the MVP (ADR-0002). */
  sign_language?: string;

  /**
   * When the preference was stored, in epoch milliseconds, like the rest of
   * the snake_case events. A consumer holding a newer value should ignore this
   * message: on redelivery an older state can arrive after a newer one.
   */
  updated_at_ms: number;
}
