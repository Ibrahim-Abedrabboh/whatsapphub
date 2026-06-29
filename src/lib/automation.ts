// Pure inbound-automation rules engine (V2 M3 §2.5). No DB/IO — the webhook
// orchestrates side effects (see automationRun.ts). A rule is a trigger
// (keyword | away) plus an action (sendText).

export type Trigger =
  | { type: "keyword"; keywords: string[] }
  // Outside the configured business hours → "away". days: 0=Sun..6=Sat;
  // start/end are "HH:MM" wall-clock at tzOffset minutes from UTC.
  | { type: "away"; days: number[]; start: string; end: string; tzOffset?: number };

export type Action = { type: "sendText"; body: string };

export interface AutomationRuleDef { enabled: boolean; trigger: Trigger; action: Action }
export interface RuleContext { text: string; now: Date }

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

/** True if `now` falls within [start,end) on one of `days`, at the given tz offset. */
export function isWithinBusinessHours(now: Date, days: number[], start: string, end: string, tzOffset = 0): boolean {
  const local = new Date(now.getTime() + tzOffset * 60000); // shift, then read UTC fields = wall-clock
  if (!days.includes(local.getUTCDay())) return false;
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  return mins >= hhmmToMinutes(start) && mins < hhmmToMinutes(end);
}

export function ruleMatches(rule: AutomationRuleDef, ctx: RuleContext): boolean {
  if (!rule.enabled) return false;
  const t = rule.trigger;
  if (t.type === "keyword") {
    const text = ctx.text.toLowerCase();
    return t.keywords.some((k) => k.trim() !== "" && text.includes(k.toLowerCase().trim()));
  }
  if (t.type === "away") {
    return !isWithinBusinessHours(ctx.now, t.days, t.start, t.end, t.tzOffset ?? 0);
  }
  return false;
}

/** Actions for every rule that matches the inbound context. */
export function evaluateRules(rules: AutomationRuleDef[], ctx: RuleContext): Action[] {
  return rules.filter((r) => ruleMatches(r, ctx)).map((r) => r.action);
}
