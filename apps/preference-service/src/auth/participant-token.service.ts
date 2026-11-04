import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  PARTICIPANT_TOKEN_AUDIENCE,
  ParticipantTokenClaims,
} from "@inclusaai/shared-types";

/**
 * Verifies the participant tokens session-service issues on join.
 *
 * Signed with PARTICIPANT_TOKEN_SECRET, never JWT_SECRET: an accessibility
 * preference belongs to one participant in one session, which is exactly what
 * the token names. Reading the ids from the token rather than the request body
 * also means a caller cannot change someone else's settings.
 */
@Injectable()
export class ParticipantTokenService {
  constructor(private readonly jwt: JwtService) {}

  verify(token: string): Promise<ParticipantTokenClaims> {
    return this.jwt.verifyAsync<ParticipantTokenClaims>(token, {
      audience: PARTICIPANT_TOKEN_AUDIENCE,
    });
  }
}
