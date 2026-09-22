import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule } from "@nestjs/config";
import { JwtStrategy } from "@inclusaai/shared-auth";

/**
 * Registers the 'jwt' Passport strategy for this service.
 *
 * Both SessionsController and PresentationsController guard their routes with
 * JwtAuthGuard (AuthGuard('jwt')). Without this module in AppModule, Passport
 * has no strategy under that name and every guarded route fails with
 * "Unknown authentication strategy 'jwt'".
 */
@Module({
  imports: [PassportModule, ConfigModule],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
