import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  PARTICIPANT_TOKEN_AUDIENCE,
  ParticipantTokenClaims,
} from "@inclusaai/shared-types";

/**
 * Issues and verifies participant tokens (see ParticipantTokenClaims).
 *
 * The JwtModule behind this is configured with PARTICIPANT_TOKEN_SECRET in
 * SessionsModule, so these tokens are never signed with JWT_SECRET.
 */
@Injectable()
export class ParticipantTokenService {
  constructor(private readonly jwt: JwtService) {}

  issue(claims: ParticipantTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, { audience: PARTICIPANT_TOKEN_AUDIENCE });
  }

  /** Rejects an expired token, a wrong audience, or a wrong signature. */
  verify(token: string): Promise<ParticipantTokenClaims> {
    return this.jwt.verifyAsync<ParticipantTokenClaims>(token, {
      audience: PARTICIPANT_TOKEN_AUDIENCE,
    });
  }
}
