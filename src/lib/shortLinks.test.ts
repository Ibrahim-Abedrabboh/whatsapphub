import { describe, it, expect } from "vitest";
import { genCode, clickStats, sanitizeContactRef } from "./shortLinks";

describe("genCode", () => {
  it("produces URL-safe codes of the requested length", () => {
    const code = genCode();
    expect(code).toMatch(/^[a-zA-Z0-9]{8}$/);
    expect(genCode(12)).toMatch(/^[a-zA-Z0-9]{12}$/);
  });
  it("does not repeat across many draws", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => genCode()));
    expect(seen.size).toBe(1000);
  });
});

describe("clickStats", () => {
  it("counts totals and unique known clickers", () => {
    const s = clickStats([
      { contactId: "c1" },
      { contactId: "c1" },
      { contactId: "c2" },
      { contactId: null },
    ]);
    expect(s).toEqual({ total: 4, unique: 2 });
  });
  it("handles no clicks and all-anonymous clicks", () => {
    expect(clickStats([])).toEqual({ total: 0, unique: 0 });
    expect(clickStats([{ contactId: null }, { contactId: null }])).toEqual({ total: 2, unique: 0 });
  });
});

describe("sanitizeContactRef", () => {
  it("passes cuid-shaped ids through", () => {
    expect(sanitizeContactRef("clx9pz0aa0001abcd1234efgh")).toBe("clx9pz0aa0001abcd1234efgh");
  });
  it("rejects garbage, injections, and empty values", () => {
    expect(sanitizeContactRef(null)).toBeNull();
    expect(sanitizeContactRef("")).toBeNull();
    expect(sanitizeContactRef("short")).toBeNull();
    expect(sanitizeContactRef("has spaces here now")).toBeNull();
    expect(sanitizeContactRef("<script>alert(1)</script>")).toBeNull();
  });
});
