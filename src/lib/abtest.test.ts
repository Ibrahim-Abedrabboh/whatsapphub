import { describe, it, expect } from "vitest";
import { assignVariant } from "./abtest";

describe("assignVariant", () => {
  it("is deterministic — same contact, same split, same side", () => {
    for (const id of ["c1", "clx9pz0aa0001", "abc-def"]) {
      expect(assignVariant(id, 50)).toBe(assignVariant(id, 50));
    }
  });

  it("splits a population roughly by splitPercent", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `contact-${i}-${i * 7}`);
    const a = ids.filter((id) => assignVariant(id, 50) === "A").length;
    // 50% split over 2000 ids — allow a generous band, determinism is what matters.
    expect(a).toBeGreaterThan(800);
    expect(a).toBeLessThan(1200);
  });

  it("respects an uneven split direction", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `c${i}`);
    const a90 = ids.filter((id) => assignVariant(id, 90) === "A").length;
    const a10 = ids.filter((id) => assignVariant(id, 10) === "A").length;
    expect(a90).toBeGreaterThan(a10);
    expect(a90 / ids.length).toBeGreaterThan(0.8);
    expect(a10 / ids.length).toBeLessThan(0.2);
  });

  it("a contact never flips sides as long as the split is unchanged", () => {
    const id = "stable-contact";
    const first = assignVariant(id, 30);
    for (let i = 0; i < 5; i++) expect(assignVariant(id, 30)).toBe(first);
  });
});
