/**
 * @file Contract for the ai.transcript.segment event.
 *
 * Published by ai-services' asr-service; relayed by fanout-service to the
 * participants who have captions enabled.
 *
 * PROPOSED. No schema for this event existed when fanout-service was built,
 * and ai-services-IMPLEMENTATION.md says all schemas live in this package, so
 * this is the backend's proposal pending agreement with ai-services.
 *
 * Field names are snake_case here, unlike every other event in this package.
 * That is deliberate: this is the one event a Python service publishes, and it
 * matches the convention on that side. Events this repo publishes stay
 * camelCase.
 */

export const AI_TRANSCRIPT_SEGMENT_EVENT = "ai.transcript.segment";

/** Current shape of TranscriptSegmentPayload. */
export const AI_TRANSCRIPT_SEGMENT_SCHEMA_VERSION = 1;

export interface TranscriptSegmentPayload {
  /** Which shape this message follows; see schemaVersion on the other events. */
  schema_version: number;

  /** The session-service session the audio belongs to. Also the message key. */
  session_id: string;

  /**
   * Stable id for one utterance. Interim and final versions of the same
   * utterance share it, so clients replace the segment rather than append.
   */
  segment_id: string;

  /** Increases monotonically within a session; lets clients order segments. */
  sequence: number;

  text: string;

  /** false for an interim hypothesis that may still change; true once settled. */
  is_final: boolean;

  /**
   * Who was speaking, as the participant id the media layer attaches to the
   * audio. Display names live in session-service, so ai-services is not
   * expected to resolve one: fanout-service attaches the name before sending a
   * caption to clients. Absent when the speaker is unknown.
   */
  speaker_participant_id?: string;

  /** BCP 47 language tag, e.g. "en-US". */
  language?: string;

  /** Offsets into the session's audio, in milliseconds. */
  start_ms: number;
  end_ms: number;

  /** ISO-8601 time ai-services produced the segment, for latency measurement. */
  produced_at: string;
}
