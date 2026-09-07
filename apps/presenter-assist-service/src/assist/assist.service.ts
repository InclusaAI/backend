import { Injectable, Logger } from '@nestjs/common';

/**
 * Types of coaching hints the service can generate.
 */
export type HintType =
  | 'lighting'
  | 'framing'
  | 'pace'
  | 'volume'
  | 'engagement'
  | 'general';

/**
 * Severity levels for coaching hints.
 */
export type HintSeverity = 'info' | 'warning' | 'critical';

/**
 * A coaching hint sent to the presenter.
 */
export interface CoachingHint {
  sessionId: string;
  presenterId: string;
  type: HintType;
  severity: HintSeverity;
  message: string;
  suggestion: string;
  timestamp_ms: number;
}

/**
 * Rolling window stats for a presenter in a session.
 */
interface PresenterStats {
  sessionId: string;
  presenterId: string;
  /** Recent vision quality signals */
  recentQuality: Array<{
    framing_ok: boolean | null;
    lighting_ok: boolean | null;
    hand_visibility_ok: boolean | null;
    signing_pace: string | null;
    timestamp_ms: number;
  }>;
  /** Recent engagement signals */
  recentEngagement: Array<{
    attention_score: number | null;
    timestamp_ms: number;
  }>;
  /** Last hint sent per type (to avoid spam) */
  lastHintAt: Map<HintType, number>;
}

/** Minimum interval between hints of the same type (ms) */
const HINT_COOLDOWN_MS = 15_000;

/** Window size for rolling stats */
const STATS_WINDOW_MS = 60_000;

@Injectable()
export class AssistService {
  private readonly logger = new Logger(AssistService.name);
  private readonly stats: Map<string, PresenterStats> = new Map();

  /**
   * Process a vision quality signal and generate coaching hints if needed.
   */
  processVisionQuality(data: {
    session_id: string;
    presenter_id: string;
    framing_ok: boolean | null;
    lighting_ok: boolean | null;
    hand_visibility_ok: boolean | null;
    signing_pace: string | null;
    recommendation: string | null;
    timestamp_ms: number;
  }): CoachingHint[] {
    const key = `${data.session_id}::${data.presenter_id}`;
    const stats = this.getOrCreateStats(data.session_id, data.presenter_id);

    // Add to rolling window
    stats.recentQuality.push({
      framing_ok: data.framing_ok,
      lighting_ok: data.lighting_ok,
      hand_visibility_ok: data.hand_visibility_ok,
      signing_pace: data.signing_pace,
      timestamp_ms: data.timestamp_ms,
    });
    this.pruneWindow(stats.recentQuality);

    // Analyze and generate hints
    return this.analyzeVisionQuality(stats, data);
  }

  /**
   * Process an engagement signal aggregate.
   */
  processEngagement(data: {
    session_id: string;
    attention_score: number | null;
    window_start_ms: number;
    window_end_ms: number;
  }): CoachingHint[] {
    const hints: CoachingHint[] = [];
    const key = data.session_id;

    // Find presenters in this session
    for (const [statKey, stats] of this.stats) {
      if (!statKey.startsWith(`${data.session_id}::`)) continue;

      stats.recentEngagement.push({
        attention_score: data.attention_score,
        timestamp_ms: data.window_end_ms,
      });
      this.pruneWindow(stats.recentEngagement);

      // Check if engagement is dropping
      const avgEngagement = this.avgField(
        stats.recentEngagement,
        (e) => e.attention_score,
      );

      if (avgEngagement !== null && avgEngagement < 0.4) {
        const hint = this.maybeCreateHint(stats, 'engagement', 'warning', {
          message: 'Audience engagement is low',
          suggestion:
            'Consider changing your delivery pace, asking a question, or switching topics to re-engage the audience.',
        });
        if (hint) hints.push(hint);
      }
    }

    return hints;
  }

  // -------------------------------------------------------------------------
  // Private analysis methods
  // -------------------------------------------------------------------------

  private analyzeVisionQuality(
    stats: PresenterStats,
    data: {
      session_id: string;
      presenter_id: string;
      framing_ok: boolean | null;
      lighting_ok: boolean | null;
      hand_visibility_ok: boolean | null;
      signing_pace: string | null;
      timestamp_ms: number;
    },
  ): CoachingHint[] {
    const hints: CoachingHint[] = [];

    // Lighting check — if last 3 signals all say lighting is bad
    const recentLighting = stats.recentQuality
      .slice(-3)
      .map((q) => q.lighting_ok)
      .filter((v) => v !== null);
    if (recentLighting.length >= 3 && recentLighting.every((v) => v === false)) {
      const hint = this.maybeCreateHint(stats, 'lighting', 'warning', {
        message: 'Lighting conditions are poor',
        suggestion:
          'Try moving closer to a window or turning on additional lights. Good lighting helps AI caption accuracy.',
      });
      if (hint) hints.push(hint);
    }

    // Framing check
    const recentFraming = stats.recentQuality
      .slice(-3)
      .map((q) => q.framing_ok)
      .filter((v) => v !== null);
    if (recentFraming.length >= 3 && recentFraming.every((v) => v === false)) {
      const hint = this.maybeCreateHint(stats, 'framing', 'warning', {
        message: 'Camera framing needs adjustment',
        suggestion:
          'Center yourself in the frame. Ensure your upper body and hands are visible for sign language recognition.',
      });
      if (hint) hints.push(hint);
    }

    // Hand visibility for sign language presenters
    const recentHands = stats.recentQuality
      .slice(-3)
      .map((q) => q.hand_visibility_ok)
      .filter((v) => v !== null);
    if (recentHands.length >= 3 && recentHands.every((v) => v === false)) {
      const hint = this.maybeCreateHint(stats, 'framing', 'critical', {
        message: 'Hands are not visible in the frame',
        suggestion:
          'Lower the camera or step back so your hands are fully visible. This is essential for sign language recognition.',
      });
      if (hint) hints.push(hint);
    }

    // Signing pace
    const recentPace = stats.recentQuality
      .slice(-5)
      .map((q) => q.signing_pace)
      .filter((v) => v !== null);
    if (recentPace.length >= 3) {
      const fastCount = recentPace.filter((p) => p === 'fast').length;
      const slowCount = recentPace.filter((p) => p === 'slow').length;

      if (fastCount >= 3) {
        const hint = this.maybeCreateHint(stats, 'pace', 'info', {
          message: 'Signing pace is fast',
          suggestion:
            'Consider slowing down slightly for better recognition accuracy, especially for complex phrases.',
        });
        if (hint) hints.push(hint);
      }

      if (slowCount >= 3) {
        const hint = this.maybeCreateHint(stats, 'pace', 'info', {
          message: 'Signing pace is slow',
          suggestion:
            'You can speed up slightly to maintain audience engagement. The AI can handle faster signing.',
        });
        if (hint) hints.push(hint);
      }
    }

    return hints;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getOrCreateStats(sessionId: string, presenterId: string): PresenterStats {
    const key = `${sessionId}::${presenterId}`;
    let stats = this.stats.get(key);
    if (!stats) {
      stats = {
        sessionId,
        presenterId,
        recentQuality: [],
        recentEngagement: [],
        lastHintAt: new Map(),
      };
      this.stats.set(key, stats);
    }
    return stats;
  }

  private maybeCreateHint(
    stats: PresenterStats,
    type: HintType,
    severity: HintSeverity,
    details: { message: string; suggestion: string },
  ): CoachingHint | null {
    const now = Date.now();
    const lastHint = stats.lastHintAt.get(type) ?? 0;

    if (now - lastHint < HINT_COOLDOWN_MS) {
      return null; // Cooldown — don't spam
    }

    stats.lastHintAt.set(type, now);

    return {
      sessionId: stats.sessionId,
      presenterId: stats.presenterId,
      type,
      severity,
      message: details.message,
      suggestion: details.suggestion,
      timestamp_ms: now,
    };
  }

  private pruneWindow<T extends { timestamp_ms: number }>(window: T[]): void {
    const cutoff = Date.now() - STATS_WINDOW_MS;
    while (window.length > 0 && window[0].timestamp_ms < cutoff) {
      window.shift();
    }
  }

  private avgField<T>(items: T[], getter: (item: T) => number | null): number | null {
    const values = items.map(getter).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
