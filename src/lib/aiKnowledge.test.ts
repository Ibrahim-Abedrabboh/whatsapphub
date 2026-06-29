import { describe, it, expect } from "vitest";
import { rankDocs, parseTags, type KbDoc } from "./ai";
import { KnowledgeSchema } from "./validation";

const docs: KbDoc[] = [
  { id: "1", title: "Shipping", content: "Orders ship within 2 days and delivery takes a week." },
  { id: "2", title: "Returns", content: "You can return any item within 30 days for a refund." },
  { id: "3", title: "Payment", content: "We accept Visa, Mastercard, and Apple Pay." },
];

describe("rankDocs", () => {
  // POSITIVE — relevant docs ranked by term overlap
  it("ranks the most relevant doc first", () => {
    const out = rankDocs("how long does delivery take", docs);
    expect(out[0]?.id).toBe("1"); // "delivery"/"take" overlap Shipping
  });
  it("matches the returns doc for a refund question", () => {
    expect(rankDocs("can I get a refund for my return", docs)[0]?.id).toBe("2");
  });
  // NEGATIVE — no overlap → empty
  it("returns no docs when nothing overlaps", () => {
    expect(rankDocs("zzzqqq nonsense", docs)).toEqual([]);
  });
  it("respects the top-k cap", () => {
    expect(rankDocs("return refund shipping delivery payment visa", docs, 2)).toHaveLength(2);
  });
});

describe("parseTags", () => {
  // POSITIVE
  it("parses a JSON tag object", () => {
    expect(parseTags('{"intent":"complaint","sentiment":"negative"}')).toEqual({ intent: "complaint", sentiment: "negative" });
  });
  it("extracts the object from surrounding prose", () => {
    expect(parseTags('Sure: {"intent":"question","sentiment":"neutral"} done')).toEqual({ intent: "question", sentiment: "neutral" });
  });
  // NEGATIVE — malformed → safe defaults
  it("defaults to other/neutral on garbage", () => {
    expect(parseTags("not json at all")).toEqual({ intent: "other", sentiment: "neutral" });
  });
  it("fills missing fields with defaults", () => {
    expect(parseTags('{"intent":"greeting"}')).toEqual({ intent: "greeting", sentiment: "neutral" });
  });
});

describe("KnowledgeSchema", () => {
  it("accepts a title + content", () => {
    expect(KnowledgeSchema.safeParse({ title: "Shipping", content: "We ship fast." }).success).toBe(true);
  });
  it("rejects empty title or content", () => {
    expect(KnowledgeSchema.safeParse({ title: "", content: "x" }).success).toBe(false);
    expect(KnowledgeSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});
