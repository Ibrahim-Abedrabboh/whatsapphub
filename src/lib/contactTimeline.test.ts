import { describe, it, expect } from "vitest";
import { buildTimeline } from "./contactTimeline";
import { UpdateContactSchema } from "./validation";

describe("buildTimeline", () => {
  // POSITIVE — merges all three sources, newest first
  it("merges messages, broadcasts, and notes sorted newest-first", () => {
    const out = buildTimeline({
      messages: [{ id: "m1", channel: "WHATSAPP", direction: "IN", text: "hi", type: "text", createdAt: "2026-06-29T10:00:00Z" }],
      broadcasts: [{ id: "b1", templateName: "promo", status: "COMPLETED", createdAt: "2026-06-29T12:00:00Z" }],
      notes: [{ id: "n1", body: "VIP", authorName: "Sara", createdAt: "2026-06-29T11:00:00Z" }],
    });
    expect(out.map((i) => i.kind)).toEqual(["broadcast", "note", "message"]);
    expect(out[0]?.id).toBe("b1");
  });
  it("maps a message item with channel + direction", () => {
    const [item] = buildTimeline({ messages: [{ id: "m1", channel: "INSTAGRAM", direction: "OUT", text: "hello", type: "text", createdAt: "2026-06-29T10:00:00Z" }], broadcasts: [], notes: [] });
    expect(item).toMatchObject({ kind: "message", channel: "INSTAGRAM", direction: "OUT", text: "hello" });
  });
  // NEGATIVE — nothing in → empty
  it("returns an empty timeline with no input", () => {
    expect(buildTimeline({ messages: [], broadcasts: [], notes: [] })).toEqual([]);
  });
});

describe("UpdateContactSchema", () => {
  it("accepts tags and attributes", () => {
    expect(UpdateContactSchema.safeParse({ tags: ["vip", "lead"] }).success).toBe(true);
    expect(UpdateContactSchema.safeParse({ attributes: { city: "Riyadh" } }).success).toBe(true);
  });
  it("rejects an empty patch", () => {
    expect(UpdateContactSchema.safeParse({}).success).toBe(false);
  });
  it("rejects a blank tag", () => {
    expect(UpdateContactSchema.safeParse({ tags: [""] }).success).toBe(false);
  });
});
