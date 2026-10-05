/**
 * The participant token: proof that a socket or request belongs to a
 * participant of one specific session.
 *
 * session-service issues it on join; fanout-service and session-service's
 * participant endpoints verify it. It is signed with PARTICIPANT_TOKEN_SECRET,
 * never JWT_SECRET, so it cannot pass as an identity token and an identity
 * token cannot open a socket. The audience check keeps that separation even if
 * the two secrets were ever configured identically.
 *
 * Lives here rather than in shared-auth so a verifier can use it without
 * pulling in Passport.
 */
export const PARTICIPANT_TOKEN_AUDIENCE = "inclusaai:session-participant";

export interface ParticipantTokenClaims {
  /** SessionParticipant id. */
  sub: string;

  /** Session id. */
  sid: string;

  /** identity-service user id, or null for an anonymous participant. */
  uid: string | null;

  /**
   * Captions setting when the token was issued. A verifier holding a newer
   * value (from session.participant.updated) should prefer that.
   */
  captionsEnabled: boolean;
}
