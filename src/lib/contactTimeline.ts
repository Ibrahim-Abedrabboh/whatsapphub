// Build a contact's unified, time-ordered activity timeline (V2 M4 §2.6).
// Pure — the API supplies already-loaded rows. Merges three sources:
//   - inbox messages (cross-channel, IN/OUT)
//   - broadcast deliveries (sent/delivered/read/clicked) the contact received
//   - internal notes on the contact's conversations

export interface TimelineMessage { id: string; channel: string; direction: "IN" | "OUT"; text: string | null; type: string; createdAt: string | Date }
export interface TimelineBroadcast { id: string; templateName: string; status: string; createdAt: string | Date }
export interface TimelineNote { id: string; body: string; authorName: string | null; createdAt: string | Date }

export type TimelineItem =
  | { kind: "message"; at: string; channel: string; direction: "IN" | "OUT"; text: string | null; type: string; id: string }
  | { kind: "broadcast"; at: string; templateName: string; status: string; id: string }
  | { kind: "note"; at: string; body: string; authorName: string | null; id: string };

const iso = (d: string | Date): string => (typeof d === "string" ? d : d.toISOString());

export function buildTimeline(input: {
  messages: TimelineMessage[];
  broadcasts: TimelineBroadcast[];
  notes: TimelineNote[];
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...input.messages.map((m): TimelineItem => ({ kind: "message", at: iso(m.createdAt), channel: m.channel, direction: m.direction, text: m.text, type: m.type, id: m.id })),
    ...input.broadcasts.map((b): TimelineItem => ({ kind: "broadcast", at: iso(b.createdAt), templateName: b.templateName, status: b.status, id: b.id })),
    ...input.notes.map((n): TimelineItem => ({ kind: "note", at: iso(n.createdAt), body: n.body, authorName: n.authorName, id: n.id })),
  ];
  // Most recent first.
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
