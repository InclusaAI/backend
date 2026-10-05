import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ParticipantTokenClaims } from "@inclusaai/shared-types";
import { ParticipantTokenService } from "./participant-token.service";

/** A request that has passed ParticipantTokenGuard, so `participant` is set. */
export type ParticipantRequest = Request & {
  participant: ParticipantTokenClaims;
};

/**
 * Admits requests carrying a valid participant token and sets
 * `req.participant`.
 *
 * A plain guard rather than a Passport strategy: the token is verified with its
 * own secret and audience, so it cannot be confused with the account tokens
 * that the shared 'jwt' strategy accepts.
 */
@Injectable()
export class ParticipantTokenGuard implements CanActivate {
  constructor(private readonly tokens: ParticipantTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<ParticipantRequest>>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      throw new UnauthorizedException("A participant token is required.");
    }

    try {
      request.participant = await this.tokens.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired participant token.");
    }

    return true;
  }
}
