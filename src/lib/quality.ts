// Number-quality monitoring (V2 M4 §2.9). Pure logic — no DB/network — so the
// parsing + pause decision are unit-testable. The worker polls Meta's
// GET /{phoneNumberId}?fields=quality_rating,messaging_limit_tier and feeds
// the raw JSON through parseQuality.

export interface QualityInfo {
  qualityRating: string | null; // GREEN | YELLOW | RED | UNKNOWN (as reported)
  messagingTier: string | null; // e.g. TIER_1K / TIER_10K / TIER_100K / TIER_UNLIMITED
}

/** Extract the quality fields from Meta's phone-number response, tolerating
 *  missing fields and unexpected shapes (a bad payload → nulls, never a throw). */
export function parseQuality(metaResponse: unknown): QualityInfo {
  const r = (metaResponse ?? {}) as Record<string, unknown>;
  const rating = r.quality_rating;
  const tier = r.messaging_limit_tier;
  return {
    qualityRating: typeof rating === "string" && rating.trim() ? rating.trim().toUpperCase() : null,
    messagingTier: typeof tier === "string" && tier.trim() ? tier.trim().toUpperCase() : null,
  };
}

/** Auto-pause decision: only a RED rating pauses sending. YELLOW/GREEN/unknown
 *  never pause (a flaky poll must not stop a healthy number). */
export function shouldPause(qualityRating: string | null): boolean {
  return qualityRating?.trim().toUpperCase() === "RED";
}
