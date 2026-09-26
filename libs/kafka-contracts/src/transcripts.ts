/**
 * @file Contract for the ai.transcript.segment event.
 *
 * Published by ai-services' asr-service; relayed by fanout-service to the
 * participants who have captions enabled.
 *
 * PROPOSED. No schema for this event existed when fanout-service was built,
 * and ai-services-IMPLEMENTATION.md says all schemas live in this package, so
 * this is the backend's proposal pending agreement with ai-services.
 */

export const AI_TRANSCRIPT_SEGMENT_EVENT = "ai.transcript.segment";

export interface TranscriptSegmentPayload {
  /** The session-service session the audio belongs to. */
  sessionId: string;

  /**
   * Stable id for one utterance. Interim and final versions of the same
   * utterance share it, so clients replace the segment rather than append.
   */
  segmentId: string;

  /** Increases monotonically within a session; lets clients order segments. */
  sequence: number;

  text: string;

  /** false for an interim hypothesis that may still change; true once settled. */
  isFinal: boolean;

  /** BCP 47 language tag, e.g. "en-US". */
  language?: string;

  /** Offsets into the session's audio, in milliseconds. */
  startMs: number;
  endMs: number;

  /** ISO-8601 time ai-services produced the segment, for latency measurement. */
  producedAt: string;
}
