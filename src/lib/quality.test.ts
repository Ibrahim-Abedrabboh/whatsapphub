import { describe, it, expect } from "vitest";
import { parseQuality, shouldPause } from "./quality";

describe("parseQuality", () => {
  it("extracts rating + tier from a full response", () => {
    expect(parseQuality({ quality_rating: "GREEN", messaging_limit_tier: "TIER_1K", id: "123" })).toEqual({
      qualityRating: "GREEN",
      messagingTier: "TIER_1K",
    });
  });
  it("uppercases reported values", () => {
    expect(parseQuality({ quality_rating: "red", messaging_limit_tier: "tier_10k" })).toEqual({
      qualityRating: "RED",
      messagingTier: "TIER_10K",
    });
  });
  it("tolerates missing fields", () => {
    expect(parseQuality({ id: "123" })).toEqual({ qualityRating: null, messagingTier: null });
    expect(parseQuality({ quality_rating: "YELLOW" })).toEqual({ qualityRating: "YELLOW", messagingTier: null });
  });
  it("never throws on garbage", () => {
    expect(parseQuality(null)).toEqual({ qualityRating: null, messagingTier: null });
    expect(parseQuality("nope")).toEqual({ qualityRating: null, messagingTier: null });
    expect(parseQuality({ quality_rating: 42, messaging_limit_tier: {} })).toEqual({ qualityRating: null, messagingTier: null });
    expect(parseQuality({ quality_rating: "  " })).toEqual({ qualityRating: null, messagingTier: null });
  });
});

describe("shouldPause", () => {
  it("pauses on RED (any casing)", () => {
    expect(shouldPause("RED")).toBe(true);
    expect(shouldPause("red")).toBe(true);
    expect(shouldPause(" Red ")).toBe(true);
  });
  it("never pauses on YELLOW, GREEN, UNKNOWN, or missing", () => {
    expect(shouldPause("YELLOW")).toBe(false);
    expect(shouldPause("GREEN")).toBe(false);
    expect(shouldPause("UNKNOWN")).toBe(false);
    expect(shouldPause(null)).toBe(false);
    expect(shouldPause("")).toBe(false);
  });
});
