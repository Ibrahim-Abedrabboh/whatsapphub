import { describe, it, expect } from "vitest";
import { threadToTranscript, parseSuggestions, buildTranslateSystem, isAiConfigured, type ThreadMsg } from "./ai";

describe("threadToTranscript", () => {
  it("labels inbound as Customer and outbound as Agent", () => {
    const msgs: ThreadMsg[] = [
      { direction: "IN", text: "Hi, is this in stock?", type: "text" },
      { direction: "OUT", text: "Yes! How many?", type: "text" },
    ];
    expect(threadToTranscript(msgs)).toBe("Customer: Hi, is this in stock?\nAgent: Yes! How many?");
  });
  it("falls back to a [type] placeholder when text is empty", () => {
    expect(threadToTranscript([{ direction: "IN", text: null, type: "image" }])).toBe("Customer: [image]");
  });
});

describe("parseSuggestions", () => {
  // POSITIVE — a JSON array
  it("parses a JSON array of strings", () => {
    expect(parseSuggestions('["Sure!", "On its way", "Anything else?"]')).toEqual(["Sure!", "On its way", "Anything else?"]);
  });
  it("extracts the array even with surrounding prose", () => {
    expect(parseSuggestions('Here you go: ["A", "B"] hope that helps')).toEqual(["A", "B"]);
  });
  // Fallbacks
  it("parses a numbered list", () => {
    expect(parseSuggestions("1. First\n2) Second\n3. Third")).toEqual(["First", "Second", "Third"]);
  });
  it("parses bullets and strips wrapping quotes", () => {
    expect(parseSuggestions('- "Hello"\n* Bye')).toEqual(["Hello", "Bye"]);
  });
  it("caps at 3 suggestions", () => {
    expect(parseSuggestions("a\nb\nc\nd\ne")).toHaveLength(3);
  });
  // NEGATIVE
  it("returns empty for blank input", () => {
    expect(parseSuggestions("   ")).toEqual([]);
  });
});

describe("buildTranslateSystem", () => {
  it("targets Arabic and English", () => {
    expect(buildTranslateSystem("AR")).toContain("Arabic");
    expect(buildTranslateSystem("EN")).toContain("English");
  });
});

describe("isAiConfigured", () => {
  // NEGATIVE — no ANTHROPIC_API_KEY in the test env → features stay dark
  it("is false without a key", () => {
    expect(isAiConfigured()).toBe(false);
  });
});
