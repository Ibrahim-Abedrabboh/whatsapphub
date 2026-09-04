# WhatsApp Hub Project Guide

WhatsApp Hub is the V2 multi-tenant messaging platform built on Meta Cloud API. It was seeded from **wa-broadcast**, but it is now an independent repository with its own migrations and roadmap. Never assume a fix or schema change can be copied between V1 and V2 without comparison.

The stack is Next.js, strict TypeScript, Prisma/PostgreSQL, BullMQ/Redis, Zod, Vitest, Playwright, and Docker Compose. Web and worker processes share the codebase.

## Sources of truth

Use registered code and tests first. **whatsapphub-V2.md** defines product scope and sequencing; **ARCHITECTURE.md**, **README.md**, **package.json**, Prisma migrations, and **HANDOFF.md** define implementation and operations. Roadmap entries are not implemented features until wired and tested.

## Commands

~~~bash
npm ci
npm run prisma:generate
npm run typecheck
npm test
npm run build
npm run dev
npm run worker:dev
npm run test:e2e
~~~

For the full stack, copy **.env.example** and use **docker compose up --build**. Append Prisma migrations with **npm run prisma:migrate -- --name description**.

## Invariants

- Every tenant-owned entity is scoped through the established tenant resolver and authenticated client context.
- Meta Embedded Signup, webhook, and messaging credentials stay server-side and encrypted where the project provides encryption.
- Validate API, CSV, webhook, and AI payloads. Verify webhook signatures and make handlers idempotent.
- Honor consent, opt-outs, approved templates, delivery states, and retry limits.
- Keep middleware edge-safe. Worker imports using the **@/** alias require **tsconfig.json** in the runtime image; verify the worker inside its container.
- Preserve refresh-token rotation, revocation, role checks, and audit attribution.
- Count aggregate worker throughput against the Meta messaging tier.
- Keep migration history forward-only and local to this repository.
- Preserve bilingual EN/AR, RTL, accessibility, and existing NazzilVideo design tokens.

Do not add a future roadmap billing provider or channel merely through documentation. Implemented behavior, migrations, configuration, and tests must move together.
