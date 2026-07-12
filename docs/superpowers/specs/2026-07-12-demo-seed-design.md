# Demo Data Seed — Design

**Date:** 2026-07-12
**Status:** Draft for review
**Author:** brainstormed with the user

## 1. Summary

A **demo dataset seeder** so a superadmin logging into a deployed instance has realistic,
bilingual content to demonstrate every shipped feature. Data is seeded into the **admin's own
client** (the resolved SUPERADMIN `clientId`), written directly in final states, and kept strictly
separable from real data via a deterministic id marker so it can be removed cleanly.

Invocation:
```
npm run seed:demo             # upsert the full demo dataset
npm run seed:demo -- --clear  # remove every demo row (FK-safe)
```

### Locked-in decisions (from brainstorming)
- **Target:** the current/admin client (resolve the SUPERADMIN's `clientId`; fall back to `"default"`).
- **Marking:** deterministic primary keys prefixed **`demoseed-`** on every row (source of truth for
  idempotency + teardown) **plus** a human-visible **`Demo — `** prefix on names/titles.
- **Coverage:** all shipped features.
- **Re-run:** idempotent `upsert` by the deterministic id.
- **Safety:** pure Prisma writes only — no BullMQ, no WhatsApp/Meta API, no real sends.
- **Testing:** unit-test the pure helpers; verify the full seed by running against a dev DB.

## 2. Why deterministic `demoseed-` ids

Every seeded row's primary key is `demoseed-<entity>-<key>` (e.g. `demoseed-contact-01`,
`demoseed-broadcast-eid`). This one decision delivers:
- **Idempotency** — re-running `upsert`s the same ids; never duplicates.
- **Safe teardown** — `--clear` deletes exactly the rows whose id starts with `demoseed-`, so it can
  never delete a real row even if a name or phone happens to collide.
- **Easy wiring** — child rows reference parents by known ids, no lookups.

Demo contacts use a reserved fake phone range (`966500000001`+) to avoid colliding with the
`[clientId, phone]` unique constraint on any real contact.

## 3. Run mechanism: TypeScript + tsx

The existing `seed-admin.mjs` runs under plain node, but this seeder needs to share pure helpers
with the test suite. Since vitest only collects `src/**/*.test.ts` and tsc skips `.mjs`, the pure,
DB-free logic lives in **`src/lib/demoSeed.ts`** (typechecked + unit-tested), and the seed runs
under **`tsx`** (already used by the worker) so it can import that module. Following the worker
convention, tsx-run files use **relative imports** (`../src/lib/demoSeed`), not the `@/` alias.

## 4. File structure

```
src/lib/demoSeed.ts          # PURE helpers: id/prefix builders, demo phone, CLEAR_ORDER, isDemoId
src/lib/demoSeed.test.ts     # unit tests for the pure helpers
scripts/seed-demo.ts         # entrypoint (tsx): resolve admin client, arg-parse, run seeders / --clear
scripts/demo/contacts.ts     # contacts, lists + memberships, one segment
scripts/demo/broadcasts.ts   # templates, broadcasts + recipients + click events
scripts/demo/inbox.ts        # conversations (3 channels) + messages + one internal note
scripts/demo/engagement.ts   # canned replies, knowledge docs, automation rules, flows
scripts/demo/commerce.ts     # commerce catalog + products + orders
```

Each seeder exports `seed(prisma, clientId)` and relies on the shared helpers for ids/prefixes.
The entrypoint imports all five, runs them in dependency order, and `--clear` deletes in the
reverse (FK-safe) order.

## 5. Pure helpers (`src/lib/demoSeed.ts`)

- `DEMO_ID_PREFIX = "demoseed-"` and `DEMO_NAME_PREFIX = "Demo — "`.
- `demoId(entity: string, key: string | number): string` → `` `demoseed-${entity}-${key}` ``.
- `isDemoId(id: string): boolean` → starts with the prefix.
- `demoName(s: string): string` → prefixes the display name once (idempotent).
- `demoPhone(n: number): string` → `` `9665${String(n).padStart(8, "0")}` `` (reserved fake range).
- `CLEAR_ORDER: readonly string[]` → Prisma model delegate names in FK-safe delete order:
  `messageEvent, linkClick, broadcastRecipient, shortLink, broadcast, internalNote, message,
   order, conversation, contactListMembership, contactListSnapshot, segment, product,
   commerceCatalog, template, contactList, contact, cannedReply, knowledgeDoc, automationRule,
   flow`. `--clear` iterates this list calling `prisma[model].deleteMany({ where: { id: { startsWith: DEMO_ID_PREFIX } } })`.

Only functions with **no DB access** live here; `resolveAdminClientId(prisma)` is impure and lives
in the entrypoint.

## 6. Coverage — what gets seeded (final states)

Scoped to the resolved admin `clientId`, bilingual EN/AR where user-visible:

| Feature | Rows |
|---------|------|
| Contacts | ~8 demo contacts (fake phones), mixed tags, one opted-out |
| Lists / segments | 1–2 `ContactList` + memberships; 1 `Segment` with rules |
| Templates | 2 approved `Template`s (EN + AR) |
| Broadcasts | 1–2 `Broadcast` COMPLETED + `BroadcastRecipient`s across SENT/DELIVERED/READ/FAILED + a few `MessageEvent` click events |
| Inbox | 3 `Conversation`s (WhatsApp, Instagram, Messenger) + `Message` history each; 1 `InternalNote` |
| Canned replies | 2–3 `CannedReply` |
| Knowledge | 2–3 `KnowledgeDoc` (source `"demo"`) |
| Automation | 1 keyword rule + 1 away-hours rule (`AutomationRule`) |
| Flows | 1 `Flow` (DRAFT) |
| Commerce | 1 `CommerceCatalog` + ~3 `Product` + 2 `Order` (mixed status) |

`InternalNote.authorId` points at the resolved admin user (or null). Timestamps are backdated so
lists/analytics look lived-in. **Chatbot** demo data is added once its model ships (Phase 1 of the
chatbot feature); out of scope here.

## 7. Safety guarantees

- No `queue`/BullMQ imports, no `lib/whatsapp` or channel-adapter calls — pure `prisma` reads/writes.
- Broadcasts/messages written directly in terminal states; no send path is touched.
- Everything scoped to one `clientId`; `--clear` is bounded to `demoseed-` ids.
- Idempotent: safe to run repeatedly; safe to run after a partial failure.

## 8. Testing / verification

- **Unit (vitest, no DB):** `src/lib/demoSeed.test.ts` covers `demoId`, `isDemoId`, `demoName`
  (idempotent — double-application doesn't double-prefix), `demoPhone` formatting, and that
  `CLEAR_ORDER` lists children before parents for the known FK pairs
  (`messageEvent` before `broadcastRecipient` before `broadcast` before `template`/`contactList`
  before `contact`; `message`/`internalNote` before `conversation`).
- **Manual e2e:** run `npm run seed:demo` against a dev database (the user's local/Railway),
  confirm the app pages populate (contacts, campaigns, inbox, orders, settings→knowledge), then
  `npm run seed:demo -- --clear` and confirm they empty. A seed script is mostly I/O, so automated
  coverage stops at the pure helpers by design.
- Gate for code changes: `npm run typecheck` · `npm test` · `SKIP_ENV_VALIDATION=1 npm run build`.

## 9. Out of scope
- A UI button to seed/clear (script only, for now).
- Auto-seed on boot.
- Chatbot demo data (until the `Chatbot` model ships).
- Seeding users/roles beyond the existing admin.
