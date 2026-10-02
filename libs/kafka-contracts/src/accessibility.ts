/**
 * @file Defines the contract for the accessibility.preference.updated event.
 */

/**
 * The topic name for the event published when a user's accessibility preferences are updated.
 *
 * The topic is **compacted** and messages are **keyed by `userId`**, so it
 * doubles as the current setting for every participant: a consumer starting
 * from the beginning learns everyone's latest state, however long ago they set
 * it. There is no API for reading another user's preferences, so this is the
 * only way for another service to obtain them.
 */
export const ACCESSIBILITY_PREFERENCE_UPDATED_EVENT =
  "accessibility.preference.updated";

/** Current shape of AccessibilityPreferenceUpdatedPayload. */
export const ACCESSIBILITY_PREFERENCE_UPDATED_SCHEMA_VERSION = 1;

/**
 * The payload for the ACCESSIBILITY_PREFERENCE_UPDATED_EVENT.
 * It contains the complete state of the user's MVP accessibility preferences.
 */
export interface AccessibilityPreferenceUpdatedPayload {
  /**
   * Which shape this message follows, so a consumer can tell the formats apart
   * rather than inferring from which fields happen to be present. Bump it when
   * a field's meaning changes or one is removed; adding an optional field does
   * not need a bump.
   */
  schemaVersion: number;

  /**
   * The unique identifier of the user whose preference has changed.
   * This is the persistent ID from the User model in identity-service.
   */
  userId: string;

  /**
   * The new state of the captions preference for the user.
   */
  captionsEnabled: boolean;

  /**
   * The new state of the avatar preference for the user.
   */
  avatarEnabled: boolean;

  /**
   * When the preference was stored, ISO-8601 from the owning row rather than
   * publish time. A consumer holding a newer value should ignore this message:
   * on redelivery or a retry, an older state can arrive after a newer one.
   */
  updatedAt: string;
}
