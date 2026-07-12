import { describe, it, expect } from "vitest";
import { rankDocs, parseTags, chunkText, fileDocTitles, normalizeExtractedText, KB_DOC_MAX, type KbDoc } from "./ai";
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

describe("chunkText", () => {
  // POSITIVE — short text stays a single chunk
  it("keeps text within the limit as one chunk", () => {
    expect(chunkText("hello world", 100)).toEqual(["hello world"]);
  });
  it("splits oversized text and preserves every character (no data loss)", () => {
    const para = "word ".repeat(50).trim(); // 249 chars of whitespace-separated words
    const out = chunkText(para, 40);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((c) => c.length <= 40)).toBe(true);
    // Rejoining the trimmed chunks recovers the original token sequence.
    expect(out.join(" ").split(/\s+/)).toEqual(para.split(/\s+/));
  });
  it("prefers a paragraph boundary when one is available", () => {
    const text = "a".repeat(30) + "\n\n" + "b".repeat(30);
    expect(chunkText(text, 40)).toEqual(["a".repeat(30), "b".repeat(30)]);
  });
  it("hard-cuts a single token longer than max", () => {
    const out = chunkText("x".repeat(90), 40);
    expect(out).toEqual(["x".repeat(40), "x".repeat(40), "x".repeat(10)]);
  });
  // NEGATIVE — nothing to chunk
  it("returns an empty array for blank input", () => {
    expect(chunkText("   \n\n  ", KB_DOC_MAX)).toEqual([]);
  });
});

describe("fileDocTitles", () => {
  // POSITIVE
  it("uses the bare base name for a single chunk", () => {
    expect(fileDocTitles("Employee Handbook", 1)).toEqual(["Employee Handbook"]);
  });
  it("numbers multi-chunk titles as base (i/n)", () => {
    expect(fileDocTitles("FAQ", 3)).toEqual(["FAQ (1/3)", "FAQ (2/3)", "FAQ (3/3)"]);
  });
  it("clamps long titles to the max length including the suffix", () => {
    const out = fileDocTitles("x".repeat(200), 2, 120);
    expect(out.every((t) => t.length <= 120)).toBe(true);
    expect(out[0]?.endsWith(" (1/2)")).toBe(true);
  });
  // NEGATIVE / edge
  it("falls back to Untitled for a blank base", () => {
    expect(fileDocTitles("   ", 1)).toEqual(["Untitled"]);
  });
});

describe("normalizeExtractedText", () => {
  it("collapses carriage returns and excess blank lines", () => {
    expect(normalizeExtractedText("a  \r\n\r\n\r\n\r\nb")).toBe("a\n\nb");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeExtractedText("\n\n  hi  \n\n")).toBe("hi");
  });
});
