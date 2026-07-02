// A/B testing (V2 M4 §2.7). Pure logic — no DB — so the split is unit-testable.

/** FNV-1a 32-bit hash — tiny, fast, and stable across runs/processes. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically assign a contact to variant "A" or "B".
 * splitPercent = the percentage that goes to A (1–99). The same contact id
 * always lands on the same side, so retries and re-sends never flip a
 * contact between variants.
 */
export function assignVariant(contactId: string, splitPercent: number): "A" | "B" {
  const bucket = fnv1a(contactId) % 100;
  return bucket < splitPercent ? "A" : "B";
}
