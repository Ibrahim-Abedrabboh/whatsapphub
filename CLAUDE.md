# CLAUDE.md — WhatsApp Hub (V2)

Context for Claude Code working in this repo. Read this first.

## What this is
**WhatsApp Hub** is a self-hosted, **multi-tenant** messaging platform on Meta's **Cloud API** — the **Phase 2** product. It is a **clean-slate fork seeded from the V1 `wa-broadcast` codebase** (broadcasting + two-way inbox + rich templates, all working and green), now evolving from a *broadcast tool* into a *conversational engagement hub*.

> **The full V1 feature catalog and the V2 roadmap live in [`whatsapphub-V2.md`](./whatsapphub-V2.md)** (and a styled HTML mirror at `public/whatsapphub-v2.html` / Arabic `…-ar.html`). Treat that document as the **source of truth** for scope and sequencing.

Brand: **NazzilVideo** (dark, teal→green, Inter/Cairo, bilingual EN/AR).

## Status
Seeded from a **green** V1 tree (typecheck · unit tests · build all passed there). Before building V2 features, run the gate below to confirm the seed still builds in this environment, then implement features per `whatsapphub-V2.md`. New migrations continue from **0016**.

## Stack
Next.js 15 (App Router) · TypeScript strict (`noUncheckedIndexedAccess`) · Prisma + Postgres · BullMQ + Redis · jose + bcryptjs (auth) · Zod (validation) · Vitest (unit) · Playwright (e2e) · Docker Compose. Two processes from one image: **web** (Next) and **worker** (BullMQ consumer + recurring scheduler).

## Definition of done (the gate)
A change isn't done until **all three** pass:
1. `npm run typecheck`
2. `npm test`
3. `npm run build` (or `docker compose up --build` boots clean)
Do not mark work complete with failing types or tests. Add positive **and** negative tests for new logic; e2e for new routes/pages.

## Commands
```
npm install && npm run prisma:generate   # generate Prisma client (required after schema changes)
npm run typecheck                         # tsc --noEmit  ← run this FIRST
npm test                                  # vitest unit (no DB/Redis needed)
npm run dev / npm run worker:dev          # local: web :3000 / worker (separate terminals)
npm run prisma:migrate -- --name <name>   # create+apply a migration (continue numbering from 0016)
npm run seed:admin                        # seed first ADMIN from env
docker compose up --build                 # full stack (postgres+redis+app+worker), app runs migrate deploy
npm run test:e2e                          # Playwright (needs the app running)
./verify.sh                               # install → generate → typecheck → unit tests
```

## V2 roadmap (build order — see whatsapphub-V2.md for full detail)
1. **Meta Embedded Signup** — one-click WhatsApp onboarding (removes the manual WABA/token friction).
2. **Omnichannel inbox** — add `channel` to `Conversation`/`Message`; WhatsApp + Instagram DM + Messenger in one view.
3. **Team collaboration** — conversation status, assignment, internal notes, canned replies, SLA.
4. **AI assist (Claude)** + **Automation/Flows** — suggested replies, summaries, AR↔EN translate, rules engine, WhatsApp Flows.
5. **Monetization:** Governance (RBAC/audit/consent) + Billing (Stripe, usage-metered) **or** Commerce (catalog/orders).
Supporting: Contact-360, dynamic segments/A-B, growth (wa.me/QR/widget/CTWA), analytics+deliverability, integrations/API.

## Project structure (inherited from V1)
```
src/
├─ middleware.ts           # EDGE: verifies access token only (no Redis/DB here)
├─ worker/index.ts         # send worker (rate-limited) + recurring scheduler + boot sync
├─ lib/                    # env, db, queue, recurring, whatsapp, broadcast, validation,
│                          #   auth (edge-safe), tokenStore, users, ratelimit, waConfig, tenancy
├─ app/                    # App Router pages + /api/* route handlers
└─ components/             # Nav, forms, LiveProgress, ContactsTable, CampaignsManager, etc.
prisma/                    # schema.prisma + hand-written SQL migrations (0001 → 0015 from V1; V2 starts 0016)
```

## Conventions
- **Imports:** use `@/...` everywhere EXCEPT `src/worker/index.ts`, which runs under `tsx` and uses relative `../lib/...` (tsx doesn't resolve tsconfig `paths`).
- **Validation:** every API body / CSV row / webhook payload goes through a Zod schema in `lib/validation.ts`.
- **DB:** Prisma only, no raw string SQL.
- **Multi-tenancy:** every entity carries `clientId`; always scope queries via the tenant resolver (`lib/tenancy.ts`); a SUPERADMIN's acting-client cookie (`acid`) overrides their own `cid`.
- **Auth split:** access token = short, stateless, edge-verified. Refresh = stateful (jti+version in Redis), rotated + revocation-checked only in `/api/auth/refresh` (Node). Roles + client id ride in the access token.
- **Styling:** classes from `globals.css` (`.card .btn .badge--<STATUS>` etc.). Avoid new inline hex — use CSS vars.

## Gotchas
- **Middleware must stay edge-safe** — never import `tokenStore`, `users`, or Prisma into `middleware.ts`.
- **`strict` + `noUncheckedIndexedAccess`** will flag array indexing — expect small guards.
- **Per-worker rate limiting:** running N workers can exceed your Meta tier (keep `WA_MPS × workers ≤ tier`).
- **WhatsApp IDs:** the **Phone number ID** and **WhatsApp Business Account ID (WABA)** come from *WhatsApp → API Setup* — the WABA is **not** the Business Portfolio / Business Manager id. Template endpoints (`/{WABA}/message_templates`) fail on the wrong id; messaging uses the Phone number ID.
- **Builds without secrets:** `SKIP_ENV_VALIDATION=1 npm run build`.

## Known limitations carried from V1 (each targeted by a V2 feature)
- Authorization mostly authentication-only; only `/api/users` is role-gated → V2 RBAC.
- No actor attribution / audit log on broadcasts or deletions → V2 audit.
- Opt-in consent trusted from the CSV, not structurally enforced → V2 consent/double opt-in.
- Contact delete is a no-op if the contact has broadcast history (FK `RESTRICT`).
- Access-token revocation lags ≤15 min by design; login rate-limit fails open.
