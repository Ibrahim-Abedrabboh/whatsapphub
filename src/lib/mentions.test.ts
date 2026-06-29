import { describe, it, expect } from "vitest";
import { parseMentions } from "./mentions";
import { CreateNoteSchema } from "./validation";

describe("parseMentions", () => {
  // NEGATIVE — plain text, no mentions → single text segment
  it("returns one text segment when there are no mentions", () => {
    expect(parseMentions("just a plain note")).toEqual([{ type: "text", value: "just a plain note" }]);
  });

  // POSITIVE — a single mention mid-sentence
  it("splits a single @mention out of surrounding text", () => {
    expect(parseMentions("ping @ahmed please")).toEqual([
      { type: "text", value: "ping " },
      { type: "mention", value: "@ahmed" },
      { type: "text", value: " please" },
    ]);
  });

  // POSITIVE — multiple mentions + dotted handle
  it("handles multiple mentions and dotted handles", () => {
    expect(parseMentions("@sara.k and @omar")).toEqual([
      { type: "mention", value: "@sara.k" },
      { type: "text", value: " and " },
      { type: "mention", value: "@omar" },
    ]);
  });

  // boundary — trailing punctuation ends the mention
  it("stops the mention at punctuation", () => {
    expect(parseMentions("done, @lead!")).toEqual([
      { type: "text", value: "done, " },
      { type: "mention", value: "@lead" },
      { type: "text", value: "!" },
    ]);
  });

  it("treats a bare @ with no handle as text", () => {
    expect(parseMentions("email me @ work")).toEqual([{ type: "text", value: "email me @ work" }]);
  });
});

describe("CreateNoteSchema", () => {
  it("accepts a non-empty note", () => {
    expect(CreateNoteSchema.safeParse({ body: "follow up tomorrow" }).success).toBe(true);
  });
  it("rejects an empty / whitespace-only note", () => {
    expect(CreateNoteSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(CreateNoteSchema.safeParse({}).success).toBe(false);
  });
});
