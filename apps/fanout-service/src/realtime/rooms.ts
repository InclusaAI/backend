/**
 * socket.io room names.
 *
 * Captions are broadcast to the captions room rather than the session room, so
 * preference filtering is a property of room membership: a participant who
 * turns captions off is removed from it and simply stops receiving them.
 */

/** Everyone in the session, whatever their settings. */
export const sessionRoom = (sessionId: string): string =>
  `session:${sessionId}`;

/** Only those receiving captions. */
export const captionsRoom = (sessionId: string): string =>
  `session:${sessionId}:captions`;

/**
 * One participant's sockets, possibly on several instances or devices.
 * Lets a preference change move all of them at once.
 */
export const participantRoom = (participantId: string): string =>
  `participant:${participantId}`;
