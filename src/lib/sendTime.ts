// Send-time controls (V2 M4 §2.7): delay each recipient until a target local
// wall-clock time, derived from a timezone attribute on the contact.
// Pure logic — no DB — so the boundaries are unit-testable.

/**
 * Parse a contact's timezone attribute into minutes east of UTC.
 * Accepts "+3", "3", "-4:30", "+03:00", "UTC+3", "GMT-5". Returns null for
 * anything unparseable or out of range (UTC-12 … UTC+14) — callers treat
 * null as "no timezone known".
 */
export function parseTzOffsetMin(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.trim().toUpperCase().replace(/^(UTC|GMT)/, "").match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = m[3] ? Number(m[3]) : 0;
  if (minutes > 59) return null;
  const total = sign * (hours * 60 + minutes);
  return total < -720 || total > 840 ? null : total;
}

/**
 * Milliseconds from `now` until the contact's local wall clock next reads
 * `targetLocal` ("HH:MM"). Local time = UTC + tzOffsetMin. If the target
 * time is right now, returns 0; if it already passed today (locally), the
 * delay rolls to tomorrow. Invalid targets return 0 (send immediately) so a
 * bad input can never silently hold a broadcast.
 */
export function localSendDelayMs(now: Date, tzOffsetMin: number, targetLocal: string): number {
  const m = targetLocal.match(/^(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return 0;

  const DAY = 24 * 60 * 60 * 1000;
  // Minutes-of-day on the contact's local clock, with seconds/ms as a fraction.
  const localMs = (now.getTime() + tzOffsetMin * 60_000) % DAY;
  const local = ((localMs % DAY) + DAY) % DAY; // JS % keeps sign — normalize
  const target = (hh * 60 + mm) * 60_000;

  const diff = target - local;
  return diff >= 0 ? diff : diff + DAY;
}
