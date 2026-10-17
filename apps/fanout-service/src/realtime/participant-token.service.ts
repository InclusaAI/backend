import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  PARTICIPANT_TOKEN_AUDIENCE,
  ParticipantTokenClaims,
} from "@inclusaai/shared-types";

/**
 * Verifies the participant tokens session-service issues on join.
 *
 * This service never verifies account tokens: its JwtModule is configured with
 * PARTICIPANT_TOKEN_SECRET, and the audience check rejects anything else.
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
