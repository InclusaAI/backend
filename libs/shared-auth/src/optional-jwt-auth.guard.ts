import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Populates `req.user` when a valid bearer token is present, and lets the
 * request through when there is not.
 *
 * Used for endpoints open to both signed-in and anonymous callers — joining a
 * session by code, where an audience member scanning a QR code on a projected
 * slide must get in without an account, while a signed-in participant is still
 * recognised so their saved preferences and identity carry over.
 *
 * This lives beside JwtStrategy on purpose. It must extend the `AuthGuard` from
 * the same `@nestjs/passport` (and therefore the same `passport`) instance that
 * the strategy registered itself into, or it will not find the 'jwt' strategy.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No token, or an invalid one: continue as an anonymous caller.
    }
    return true;
  }

  /**
   * The base implementation throws when there is no user. Here an absent user
   * is a valid outcome, so return undefined and leave `req.user` unset.
   */
  handleRequest<TUser>(_err: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
