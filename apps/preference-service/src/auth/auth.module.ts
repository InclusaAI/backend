import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule } from "@nestjs/config";
import { JwtStrategy } from "@inclusaai/shared-auth";

/**
 * Registers the shared 'jwt' Passport strategy.
 *
 * This service only verifies tokens; identity-service is the only issuer, so
 * there is no JwtModule here.
 */
@Module({
  imports: [PassportModule, ConfigModule],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
