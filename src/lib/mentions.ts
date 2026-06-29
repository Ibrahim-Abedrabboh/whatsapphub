// Parse @mentions in internal-note text into ordered segments, so the UI can
// highlight them safely (React renders each segment — no HTML injection).
// Highlight-only for now: no notifications. A mention is "@" followed by
// letters/digits/._- (handles like @ahmed, @sara.k); trailing punctuation/space
// ends it.

export type MentionSegment = { type: "text" | "mention"; value: string };

const MENTION_RE = /@([A-Za-z0-9._-]+)/g;

export function parseMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (let m = MENTION_RE.exec(body); m !== null; m = MENTION_RE.exec(body)) {
    const name = m[1];
    if (name === undefined) continue;
    if (m.index > last) segments.push({ type: "text", value: body.slice(last, m.index) });
    segments.push({ type: "mention", value: "@" + name });
    last = m.index + name.length + 1; // +1 for the "@"
  }
  if (last < body.length) segments.push({ type: "text", value: body.slice(last) });
  return segments;
}
