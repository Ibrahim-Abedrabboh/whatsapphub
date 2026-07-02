// Link-click tracking (V2 M4 §2.9). Pure logic — no DB — so it's unit-testable.
import { randomBytes } from "crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Short URL-safe code for /r/<code>. 8 base-62 chars ≈ 218 trillion values. */
export function genCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i]! % ALPHABET.length];
  return code;
}

/**
 * Aggregate a link's clicks: total taps + unique known clickers (distinct
 * contactIds; anonymous clicks count toward total only).
 */
export function clickStats(clicks: { contactId: string | null }[]): { total: number; unique: number } {
  const contacts = new Set<string>();
  for (const c of clicks) if (c.contactId) contacts.add(c.contactId);
  return { total: clicks.length, unique: contacts.size };
}

/**
 * Sanitize the `c` attribution param from the public redirect — it's
 * untrusted URL input. Accepts a cuid-shaped id, else null (click still
 * counts, just anonymous).
 */
export function sanitizeContactRef(value: string | null): string | null {
  if (!value) return null;
  return /^[a-z0-9]{10,40}$/i.test(value) ? value : null;
}
