// Dynamic segments (V2 M4 §2.7). A segment is a saved rule set evaluated
// against contacts at preview/send time, so membership is always live.
// Pure logic — no DB access — so the matcher is fully unit-testable.

export type SegmentOp = "eq" | "neq" | "contains" | "exists" | "isTrue";

export interface SegmentCondition {
  /** "name" | "optedOut" | "tag" | "attr:<key>" */
  field: string;
  op: SegmentOp;
  value?: string;
}

export interface SegmentRules {
  match: "all" | "any";
  conditions: SegmentCondition[];
}

/** The Contact fields the matcher reads (tags/attributes are Json columns). */
export interface MatchableContact {
  name: string | null;
  optedOut: boolean;
  tags: unknown; // string[] when well-formed
  attributes: unknown; // Record<string, string> when well-formed
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function containsText(haystack: string, needle: string): boolean {
  return haystack.trim().toLowerCase().includes(needle.trim().toLowerCase());
}

/** Json column → string[] (drops non-string entries; non-arrays → []). */
export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
}

/**
 * Evaluate one condition. Unknown fields and malformed values never match —
 * a bad rule silently excludes rather than blasting the whole contact base.
 *
 * Field semantics:
 * - "name"       → the contact's display name (missing name matches nothing but neq).
 * - "optedOut"   → boolean; use op "isTrue" (or eq/neq with value "true"/"false").
 * - "tag"        → the tags array: eq = has the exact tag, contains = some tag
 *                  contains the value, exists = has any tag, neq = lacks the tag.
 * - "attr:<key>" → the attributes object's <key> value as text.
 */
export function evalCondition(contact: MatchableContact, cond: SegmentCondition): boolean {
  const value = cond.value ?? "";

  // Tags: ops apply across the array.
  if (cond.field === "tag") {
    const tags = asStringArray(contact.tags);
    switch (cond.op) {
      case "exists":
        return tags.length > 0;
      case "eq":
        return tags.some((t) => sameText(t, value));
      case "neq":
        return !tags.some((t) => sameText(t, value));
      case "contains":
        return tags.some((t) => containsText(t, value));
      case "isTrue":
        return false;
    }
  }

  // Booleans: optedOut.
  if (cond.field === "optedOut") {
    switch (cond.op) {
      case "isTrue":
        return contact.optedOut;
      case "eq":
        return String(contact.optedOut) === value.trim().toLowerCase();
      case "neq":
        return String(contact.optedOut) !== value.trim().toLowerCase();
      case "exists":
        return true;
      case "contains":
        return false;
    }
  }

  // Text fields: name / attr:<key>.
  let text: string | undefined;
  if (cond.field === "name") {
    text = contact.name ?? undefined;
  } else if (cond.field.startsWith("attr:")) {
    const attrs = (contact.attributes ?? {}) as Record<string, unknown>;
    const raw = attrs[cond.field.slice(5)];
    text = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : undefined;
  } else {
    return false; // unknown field
  }

  switch (cond.op) {
    case "exists":
      return text !== undefined && text.trim() !== "";
    case "eq":
      return text !== undefined && sameText(text, value);
    case "neq":
      return text === undefined || !sameText(text, value);
    case "contains":
      return text !== undefined && containsText(text, value);
    case "isTrue":
      return false;
  }
}

/**
 * Does a contact belong to the segment? "all" = every condition, "any" = at
 * least one. An empty/malformed rule set matches nobody (defensive: a broken
 * segment must never become a send-to-everyone).
 */
export function matchContact(contact: MatchableContact, rules: SegmentRules): boolean {
  const conditions = Array.isArray(rules?.conditions) ? rules.conditions : [];
  if (conditions.length === 0) return false;
  return rules.match === "any"
    ? conditions.some((c) => evalCondition(contact, c))
    : conditions.every((c) => evalCondition(contact, c));
}
