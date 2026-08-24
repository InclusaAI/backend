export declare const ACCESSIBILITY_PREFERENCE_UPDATED_EVENT = "accessibility.preference.updated";
export interface AccessibilityPreferenceUpdatedPayload {
    userId: string;
    captionsEnabled: boolean;
    avatarEnabled: boolean;
}
