import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

export interface ResolvedPreferences {
  captionsEnabled: boolean;
  avatarEnabled: boolean;
}

/**
 * Reads a joining participant's durable accessibility preferences from
 * preference-service, which owns them (ADR-0003: no cross-service DB reads).
 *
 * The joiner's own bearer token is forwarded, so this uses the existing
 * `GET /preferences` endpoint and its existing authorization rather than
 * introducing a service-to-service trust path.
 */
@Injectable()
export class PreferenceClientService {
  private readonly logger = new Logger(PreferenceClientService.name);

  /** Applied when the participant is anonymous or the lookup fails. */
  static readonly DEFAULTS: ResolvedPreferences = {
    captionsEnabled: false,
    avatarEnabled: true,
  };

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * `PREFERENCE_SERVICE_URL` is the local setting. Platforms that give each
   * service a deploy-time private-network hostname cannot know it in advance,
   * so they inject `PREFERENCE_SERVICE_HOST` instead (Render: something like
   * `preference-service-abc1:10000`). Either form works with or without a
   * scheme; localhost is the last resort so development keeps working.
   */
  private preferenceBaseUrl(): string {
    const url = this.config.get<string>("PREFERENCE_SERVICE_URL");
    if (url) return url;

    const host = this.config.get<string>("PREFERENCE_SERVICE_HOST");
    if (host) {
      return host.startsWith("http://") || host.startsWith("https://")
        ? host
        : `http://${host}`;
    }

    return "http://localhost:3003";
  }

  async resolveFor(bearerToken?: string): Promise<ResolvedPreferences> {
    if (!bearerToken) {
      return PreferenceClientService.DEFAULTS;
    }

    const baseUrl = this.preferenceBaseUrl();

    try {
      const response = await firstValueFrom(
        this.http.get<ResolvedPreferences>(`${baseUrl}/preferences`, {
          headers: { Authorization: `Bearer ${bearerToken}` },
          timeout: 3000,
        }),
      );

      return {
        captionsEnabled: response.data.captionsEnabled,
        avatarEnabled: response.data.avatarEnabled,
      };
    } catch (error) {
      // Never block someone from joining a live session because a preference
      // lookup failed; they join with defaults and the next
      // accessibility.preference.updated event corrects them.
      this.logger.warn(
        `Could not resolve preferences for joining participant, using defaults: ${
          (error as Error).message
        }`,
      );
      return PreferenceClientService.DEFAULTS;
    }
  }
}
