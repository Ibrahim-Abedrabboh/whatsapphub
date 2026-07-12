// Pure helpers for the demo-data seeder (scripts/seed-demo.ts). No DB access —
// kept here so vitest + tsc cover them. Every seeded row's primary key is
// `demoseed-<entity>-<key>`, which makes re-runs idempotent (upsert by id) and
// teardown bounded (delete where id startsWith the prefix).

export const DEMO_ID_PREFIX = "demoseed-";
export const DEMO_NAME_PREFIX = "Demo — ";

export function demoId(entity: string, key: string | number): string {
  return `${DEMO_ID_PREFIX}${entity}-${key}`;
}

export function isDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX);
}

/** Prefix a display name once; safe to apply to an already-prefixed name. */
export function demoName(s: string): string {
  return s.startsWith(DEMO_NAME_PREFIX) ? s : `${DEMO_NAME_PREFIX}${s}`;
}

/** Reserved fake phone range so demo contacts never clash with real ones. */
export function demoPhone(n: number): string {
  return `9665${String(n).padStart(8, "0")}`;
}

// Prisma model delegate names in FK-safe delete order (children first). The
// entrypoint iterates this for `--clear`. `contactListMembership` has a
// composite PK (no id) — the entrypoint clears it by demo listId.
export const CLEAR_ORDER: readonly string[] = [
  "messageEvent",
  "broadcastRecipient",
  "broadcast",
  "internalNote",
  "message",
  "order",
  "conversation",
  "contactListMembership",
  "segment",
  "product",
  "commerceCatalog",
  "template",
  "contactList",
  "contact",
  "cannedReply",
  "knowledgeDoc",
  "automationRule",
  "flow",
] as const;
