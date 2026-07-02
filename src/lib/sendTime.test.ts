import { describe, it, expect } from "vitest";
import { parseTzOffsetMin, localSendDelayMs } from "./sendTime";

describe("parseTzOffsetMin", () => {
  it("parses whole hours with/without sign", () => {
    expect(parseTzOffsetMin("+3")).toBe(180);
    expect(parseTzOffsetMin("3")).toBe(180);
    expect(parseTzOffsetMin("-5")).toBe(-300);
  });
  it("parses HH:MM forms", () => {
    expect(parseTzOffsetMin("+03:00")).toBe(180);
    expect(parseTzOffsetMin("-4:30")).toBe(-270);
  });
  it("parses UTC/GMT prefixes", () => {
    expect(parseTzOffsetMin("UTC+3")).toBe(180);
    expect(parseTzOffsetMin("gmt-5")).toBe(-300);
  });
  it("rejects garbage, out-of-range, and non-strings", () => {
    expect(parseTzOffsetMin("Riyadh")).toBeNull();
    expect(parseTzOffsetMin("+15")).toBeNull(); // beyond UTC+14
    expect(parseTzOffsetMin("-13")).toBeNull(); // beyond UTC-12
    expect(parseTzOffsetMin("3:75")).toBeNull();
    expect(parseTzOffsetMin(3 as never)).toBeNull();
    expect(parseTzOffsetMin(undefined)).toBeNull();
  });
});

describe("localSendDelayMs", () => {
  // 2026-07-02 09:00:00 UTC
  const now = new Date(Date.UTC(2026, 6, 2, 9, 0, 0));
  const HOUR = 60 * 60 * 1000;

  it("delays until the target later today in the contact's timezone", () => {
    // UTC+3 → local 12:00; target 14:00 local → 2h away.
    expect(localSendDelayMs(now, 180, "14:00")).toBe(2 * HOUR);
  });

  it("rolls to tomorrow when the target has passed locally", () => {
    // UTC+3 → local 12:00; target 10:00 local → 22h away.
    expect(localSendDelayMs(now, 180, "10:00")).toBe(22 * HOUR);
  });

  it("returns 0 when the target is exactly now", () => {
    expect(localSendDelayMs(now, 180, "12:00")).toBe(0);
  });

  it("negative offsets shift the local clock the other way", () => {
    // UTC-5 → local 04:00; target 09:00 local → 5h away.
    expect(localSendDelayMs(now, -300, "09:00")).toBe(5 * HOUR);
    // UTC-10 → local 23:00 (previous day); target 01:00 → 2h away.
    expect(localSendDelayMs(now, -600, "01:00")).toBe(2 * HOUR);
  });

  it("half-hour offsets land on the right minute", () => {
    // UTC+4:30 → local 13:30; target 13:45 → 15 min.
    expect(localSendDelayMs(now, 270, "13:45")).toBe(15 * 60 * 1000);
  });

  it("invalid targets send immediately rather than holding the broadcast", () => {
    expect(localSendDelayMs(now, 180, "25:00")).toBe(0);
    expect(localSendDelayMs(now, 180, "9:00")).toBe(0); // must be HH:MM
    expect(localSendDelayMs(now, 180, "nope")).toBe(0);
  });
});
