/**
 * @file Defines the contract for the accessibility.preference.updated event.
 */

/**
 * The topic name for the event published when a user's accessibility preferences are updated.
 */
export const ACCESSIBILITY_PREFERENCE_UPDATED_EVENT =
  "accessibility.preference.updated";

/**
 * The payload for the ACCESSIBILITY_PREFERENCE_UPDATED_EVENT.
 * It contains the complete state of the user's MVP accessibility preferences.
 */
export interface AccessibilityPreferenceUpdatedPayload {
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
}
