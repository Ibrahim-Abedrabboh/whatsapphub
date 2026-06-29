import { describe, it, expect } from "vitest";
import { slaState, formatRemaining, FIRST_RESPONSE_TARGET_MS } from "./sla";

const now = new Date("2026-06-29T12:00:00Z");
const minsAgo = (m: number) => new Date(now.getTime() - m * 60000);

describe("slaState — first response", () => {
  // POSITIVE — within target, not breached
  it("is active and not breached while inside the target", () => {
    const s = slaState({ status: "OPEN", lastInboundAt: minsAgo(30), firstResponseAt: null, now });
    expect(s.firstResponse.active).toBe(true);
    expect(s.firstResponse.breached).toBe(false);
    expect(s.firstResponse.remainingMs).toBe(FIRST_RESPONSE_TARGET_MS - 30 * 60000);
  });

  // NEGATIVE — past target → breached, remaining negative
  it("is breached past the target", () => {
    const s = slaState({ status: "OPEN", lastInboundAt: minsAgo(90), firstResponseAt: null, now });
    expect(s.firstResponse.breached).toBe(true);
    expect(s.firstResponse.remainingMs! < 0).toBe(true);
  });

  // NEGATIVE — already answered → inactive
  it("is inactive once a first response was sent", () => {
    const s = slaState({ status: "OPEN", lastInboundAt: minsAgo(90), firstResponseAt: minsAgo(80), now });
    expect(s.firstResponse.active).toBe(false);
    expect(s.firstResponse.breached).toBe(false);
  });

  // NEGATIVE — no inbound to respond to → inactive
  it("is inactive with no inbound", () => {
    expect(slaState({ status: "OPEN", lastInboundAt: null, firstResponseAt: null, now }).firstResponse.active).toBe(false);
  });
});

describe("slaState — resolution + closed", () => {
  it("resolution is active while open and breaches after 24h", () => {
    expect(slaState({ status: "OPEN", lastInboundAt: minsAgo(60), firstResponseAt: minsAgo(50), now }).resolution.breached).toBe(false);
    expect(slaState({ status: "PENDING", lastInboundAt: minsAgo(25 * 60), firstResponseAt: minsAgo(50), now }).resolution.breached).toBe(true);
  });

  it("a CLOSED conversation has no active SLA", () => {
    const s = slaState({ status: "CLOSED", lastInboundAt: minsAgo(90), firstResponseAt: null, now });
    expect(s.firstResponse.active).toBe(false);
    expect(s.resolution.active).toBe(false);
  });
});

describe("formatRemaining", () => {
  it("formats minutes and hours", () => {
    expect(formatRemaining(12 * 60000)).toBe("12m");
    expect(formatRemaining(65 * 60000)).toBe("1h 5m");
    expect(formatRemaining(120 * 60000)).toBe("2h");
    expect(formatRemaining(-5000)).toBe("0m");
  });
});
