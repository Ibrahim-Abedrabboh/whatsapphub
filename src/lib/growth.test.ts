import { describe, it, expect } from "vitest";
import { normalizeWaNumber, waMeLink, widgetSnippet } from "./growth";

describe("normalizeWaNumber", () => {
  it("strips +, spaces, dashes and parens to digits only", () => {
    expect(normalizeWaNumber("+966 50 000 0000")).toBe("966500000000");
    expect(normalizeWaNumber("(962)-79-123-4567")).toBe("962791234567");
  });
});

describe("waMeLink", () => {
  it("builds a bare link when there's no message", () => {
    expect(waMeLink("+966 50 000 0000")).toBe("https://wa.me/966500000000");
  });
  it("appends a URL-encoded prefilled message", () => {
    expect(waMeLink("966500000000", "Hi there!")).toBe("https://wa.me/966500000000?text=Hi%20there!");
  });
  it("ignores a blank/whitespace message", () => {
    expect(waMeLink("966500000000", "   ")).toBe("https://wa.me/966500000000");
  });
});

describe("widgetSnippet", () => {
  it("embeds the wa.me link and the label", () => {
    const html = widgetSnippet("966500000000", "Hello", "Chat with us");
    expect(html).toContain("https://wa.me/966500000000?text=Hello");
    expect(html).toContain("Chat with us");
    expect(html).toContain("<a ");
    expect(html).toContain("position:fixed");
  });
});
