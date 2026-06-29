// Compute-on-read SLA clocks for a conversation (V2 §2.3). Pure — `now` is
// injected so it's deterministic and unit-testable; the UI passes new Date()
// and re-evaluates on each poll. No background worker.
//
// Targets are fixed defaults for now (per-client configurability is a later
// round). Both clocks are measured from the customer's last inbound message:
//   - first response: the agent should reply within FIRST_RESPONSE_TARGET_MS;
//     satisfied once firstResponseAt is set.
//   - resolution: an open thread should be closed within RESOLUTION_TARGET_MS.
// A CLOSED conversation has no active SLA.

export const FIRST_RESPONSE_TARGET_MS = 60 * 60 * 1000; // 1 hour
export const RESOLUTION_TARGET_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SlaClock {
  active: boolean;
  dueAt: Date | null;
  breached: boolean;
  remainingMs: number | null; // negative once breached
}
export interface SlaState {
  firstResponse: SlaClock;
  resolution: SlaClock;
}

const INACTIVE: SlaClock = { active: false, dueAt: null, breached: false, remainingMs: null };

function clock(active: boolean, base: Date | null, targetMs: number, now: Date): SlaClock {
  if (!active || !base) return INACTIVE;
  const dueAt = new Date(base.getTime() + targetMs);
  const remainingMs = dueAt.getTime() - now.getTime();
  return { active: true, dueAt, breached: remainingMs < 0, remainingMs };
}

export function slaState(args: {
  status: string;
  lastInboundAt: Date | string | null;
  firstResponseAt: Date | string | null;
  now: Date;
}): SlaState {
  const open = args.status !== "CLOSED";
  const lastIn = args.lastInboundAt ? new Date(args.lastInboundAt) : null;
  const responded = !!args.firstResponseAt;
  return {
    firstResponse: clock(open && !responded, lastIn, FIRST_RESPONSE_TARGET_MS, args.now),
    resolution: clock(open, lastIn, RESOLUTION_TARGET_MS, args.now),
  };
}

/** Compact human label for a remaining duration, e.g. "12m", "1h 5m", "2h". */
export function formatRemaining(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
