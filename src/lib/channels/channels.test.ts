import { describe, it, expect } from "vitest";
import { getChannel } from "./index";
import { windowOpen, DAY_MS } from "./types";

describe("getChannel registry", () => {
  // POSITIVE
  it("resolves the WhatsApp adapter", () => {
    const a = getChannel("WHATSAPP");
    expect(a.channel).toBe("WHATSAPP");
    expect(a.windowMs).toBe(DAY_MS);
  });

  // NEGATIVE — IG/Messenger are not yet registered (dark until Phases 2/3 + a connection)
  it("throws for an unconfigured channel", () => {
    expect(() => getChannel("INSTAGRAM")).toThrow(/not configured/);
    expect(() => getChannel("MESSENGER")).toThrow(/not configured/);
    expect(() => getChannel("NONSENSE")).toThrow(/not configured/);
  });
});

describe("windowOpen", () => {
  // POSITIVE
  it("is open within the window", () => {
    expect(windowOpen(new Date(Date.now() - 60 * 60 * 1000), DAY_MS)).toBe(true);
  });
  // NEGATIVE
  it("is closed past the window", () => {
    expect(windowOpen(new Date(Date.now() - 25 * 60 * 60 * 1000), DAY_MS)).toBe(false);
  });
  it("is closed when there was never an inbound", () => {
    expect(windowOpen(null, DAY_MS)).toBe(false);
  });
});

describe("whatsappAdapter.isWindowOpen", () => {
  it("mirrors windowOpen", () => {
    const a = getChannel("WHATSAPP");
    expect(a.isWindowOpen(new Date(Date.now() - 1000))).toBe(true);
    expect(a.isWindowOpen(null)).toBe(false);
  });
});
