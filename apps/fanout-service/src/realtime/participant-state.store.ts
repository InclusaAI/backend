import { Inject, Injectable } from "@nestjs/common";
import { SessionParticipantUpdatedPayload } from "@inclusaai/kafka-contracts";
import { REDIS_CLIENT, RedisClient } from "../redis/redis.module";

export interface ParticipantState {
  captionsEnabled: boolean;
  avatarEnabled: boolean;
}

/** Long enough to outlive any session; this state is disposable. */
const TTL_SECONDS = 24 * 60 * 60;

const participantKey = (participantId: string): string =>
  `fanout:participant:${participantId}`;

const endedKey = (sessionId: string): string =>
  `fanout:session:${sessionId}:ended`;

/**
 * Participant settings materialized in Redis from session.participant.updated.
 *
 * Kept in Redis rather than memory so every instance answers the same way, and
 * so a restarted instance doesn't lose what it knows about live sessions.
 */
@Injectable()
export class ParticipantStateStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  /**
   * Stores the participant's settings, ignoring an event older than the one
   * already held. Returns whether it was applied.
   *
   * ISO-8601 UTC timestamps are fixed width, so comparing them as strings
   * orders them correctly.
   */
  async apply(event: SessionParticipantUpdatedPayload): Promise<boolean> {
    const key = participantKey(event.participantId);
    const current = await this.hash(key);

    if (current.updatedAt && current.updatedAt >= event.updatedAt) {
      return false;
    }

    await this.redis.hSet(key, {
      sessionId: event.sessionId,
      captionsEnabled: event.captionsEnabled ? "1" : "0",
      avatarEnabled: event.avatarEnabled ? "1" : "0",
      updatedAt: event.updatedAt,
    });
    await this.redis.expire(key, TTL_SECONDS);

    return true;
  }

  /**
   * node-redis types hGetAll as a union, because the reply shape depends on
   * the protocol version and type mapping. With the defaults used here it is a
   * plain object, so narrow it in one place.
   */
  private async hash(key: string): Promise<Record<string, string>> {
    return (await this.redis.hGetAll(key)) as unknown as Record<string, string>;
  }

  /** Null when nothing is known yet, e.g. the join event hasn't arrived. */
  async get(participantId: string): Promise<ParticipantState | null> {
    const stored = await this.hash(participantKey(participantId));

    if (!stored.updatedAt) {
      return null;
    }

    return {
      captionsEnabled: stored.captionsEnabled === "1",
      avatarEnabled: stored.avatarEnabled === "1",
    };
  }

  async markSessionEnded(sessionId: string): Promise<void> {
    await this.redis.set(endedKey(sessionId), new Date().toISOString(), {
      EX: TTL_SECONDS,
    });
  }

  /** Blocks new connections to a session that has already ended. */
  async isSessionEnded(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(endedKey(sessionId))) === 1;
  }
}
