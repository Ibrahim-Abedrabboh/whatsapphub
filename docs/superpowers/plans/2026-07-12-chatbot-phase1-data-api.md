# Chatbot Builder — Phase 1 (Data + API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist no-code chatbots — a `Chatbot` Prisma model, a validated `ChatbotFlow` state-machine schema, and a tenant-scoped `/api/chatbots` CRUD API.

**Architecture:** A chatbot flow is a JSON state machine (`{ startId, nodes: Record<id, Node> }`) stored on a `Chatbot` row. `ChatbotFlowSchema` (Zod) validates node shapes and that every reference resolves. REST routes follow the repo's existing pattern (`canned-replies`): `getAuthContext` gate → `getClientId` tenant scope → Zod `safeParse` → Prisma. This phase has **no UI and no runtime** — those are Phases 2 and 4.

**Tech Stack:** Next.js 15 App Router route handlers, Prisma + Postgres, Zod, Vitest, TypeScript strict.

## Global Constraints

- TypeScript `strict` **and** `noUncheckedIndexedAccess` — indexing `flow.nodes[id]` yields `Node | undefined`; guard it.
- Imports use `@/...` (this phase touches no worker files).
- Every API body goes through a Zod schema in `src/lib/validation.ts`. No inline validation.
- Prisma only — no raw string SQL in app code (the migration file is the one hand-written SQL exception, per repo convention).
- Multi-tenant: every row carries `clientId`; scope every query with `getClientId(req)`.
- Migration numbering continues from `0031_orders` → **`0032_chatbot`**. If `feat/v2-m5-payments-cart` (also `0032`) merges to `main` first, renumber this to `0033_chatbot`.
- Migrations are **additive + idempotent** (`CREATE TABLE IF NOT EXISTS`, `clientId … DEFAULT 'default'`), matching `0031_orders/migration.sql`.
- Definition of Done for every task: `npm run typecheck` · `npm test` · `SKIP_ENV_VALIDATION=1 npm run build` all green.
- Update route verb is **PATCH** (full replace), matching `canned-replies` — not PUT.

---

## File Structure

- `src/lib/validation.ts` — **modify**: add `ChatbotNodeSchema`, `ChatbotFlowSchema`, `CreateChatbotSchema`. Also export the `ChatbotFlow` TS type.
- `src/lib/validation.test.ts` — **modify**: add the schema test suites.
- `prisma/schema.prisma` — **modify**: add `model Chatbot`.
- `prisma/migrations/0032_chatbot/migration.sql` — **create**: the `Chatbot` table.
- `src/app/api/chatbots/route.ts` — **create**: `GET` (list) + `POST` (create).
- `src/app/api/chatbots/[id]/route.ts` — **create**: `GET` (one) + `PATCH` (update) + `DELETE`.

---

## Task 1: Chatbot flow validation schema

**Files:**
- Modify: `src/lib/validation.ts` (append after `KnowledgeSchema`, before `CannedReplySchema`)
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Produces:
  - `ChatbotFlowSchema` — Zod schema for `{ startId: string; nodes: Record<string, Node> }`; a `ZodEffects` (uses `.superRefine`).
  - `CreateChatbotSchema` — `{ name: string; status: "DRAFT"|"PUBLISHED" (default "DRAFT"); flow: ChatbotFlow }`.
  - `type ChatbotFlow = z.infer<typeof ChatbotFlowSchema>` — consumed by Tasks 3 and 4 (route typing) and later phases.
  - Node `type` values: `"message" | "question" | "branch" | "ai" | "aiAgent" | "end"`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/validation.test.ts` — extend the top import line to include the new symbols, and append the suites:

```ts
// add to the existing import from "./validation":
//   ChatbotFlowSchema, CreateChatbotSchema

const linearFlow = {
  startId: "n1",
  nodes: {
    n1: { id: "n1", type: "message", text: "Hi {{name}}!", nextId: "n2" },
    n2: { id: "n2", type: "question", text: "What size?", saveAs: "size", nextId: "n3" },
    n3: { id: "n3", type: "end" },
  },
};

const branchFlow = {
  startId: "b1",
  nodes: {
    b1: { id: "b1", type: "branch", cases: [{ keywords: ["yes", "y"], nextId: "b2" }], defaultNextId: "b3" },
    b2: { id: "b2", type: "ai", nextId: "b3" },
    b3: { id: "b3", type: "aiAgent", goal: "Close the sale", maxTurns: 6, nextId: "b4" },
    b4: { id: "b4", type: "end" },
  },
};

describe("ChatbotFlowSchema", () => {
  it("accepts a valid linear flow", () => {
    expect(ChatbotFlowSchema.safeParse(linearFlow).success).toBe(true);
  });
  it("accepts a valid branch + ai + aiAgent flow", () => {
    expect(ChatbotFlowSchema.safeParse(branchFlow).success).toBe(true);
  });
  it("rejects a startId that is not a node", () => {
    expect(ChatbotFlowSchema.safeParse({ ...linearFlow, startId: "ghost" }).success).toBe(false);
  });
  it("rejects a dangling nextId", () => {
    const bad = { startId: "n1", nodes: { n1: { id: "n1", type: "message", text: "hi", nextId: "gone" } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a dangling branch case nextId", () => {
    const bad = {
      startId: "b1",
      nodes: { b1: { id: "b1", type: "branch", cases: [{ keywords: ["x"], nextId: "missing" }] } },
    };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a node whose key does not match its id", () => {
    const bad = { startId: "n1", nodes: { n1: { id: "OTHER", type: "end" } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a branch with no cases", () => {
    const bad = { startId: "b1", nodes: { b1: { id: "b1", type: "branch", cases: [] } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a question with an invalid saveAs name", () => {
    const bad = { startId: "n1", nodes: { n1: { id: "n1", type: "question", text: "?", saveAs: "1bad" } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
});

describe("CreateChatbotSchema", () => {
  it("defaults status to DRAFT", () => {
    const r = CreateChatbotSchema.parse({ name: "Order bot", flow: linearFlow });
    expect(r.status).toBe("DRAFT");
  });
  it("rejects an empty name", () => {
    expect(CreateChatbotSchema.safeParse({ name: "  ", flow: linearFlow }).success).toBe(false);
  });
  it("rejects a flow that fails ChatbotFlowSchema", () => {
    const badFlow = { startId: "ghost", nodes: {} };
    expect(CreateChatbotSchema.safeParse({ name: "Bot", flow: badFlow }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL — `ChatbotFlowSchema`/`CreateChatbotSchema` are not exported (import error / undefined).

- [ ] **Step 3: Implement the schemas**

In `src/lib/validation.ts`, add after the `KnowledgeSchema` block:

```ts
// No-code chatbot flow (V2 M3). A state machine: startId + nodes keyed by id.
// Wait-nodes (question | branch | aiAgent) pause for the next inbound message.
const ChatbotNodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("message"),
    text: z.string().trim().min(1, "Message text is required").max(1000),
    nextId: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("question"),
    text: z.string().trim().min(1, "Question text is required").max(1000),
    saveAs: z.string().trim().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "saveAs must be a valid variable name"),
    nextId: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("branch"),
    cases: z
      .array(z.object({ keywords: z.array(z.string().trim().min(1)).min(1, "Add a keyword"), nextId: z.string().min(1) }))
      .min(1, "Add at least one branch case"),
    defaultNextId: z.string().optional(),
  }),
  z.object({ id: z.string().min(1), type: z.literal("ai"), nextId: z.string().optional() }),
  z.object({
    id: z.string().min(1),
    type: z.literal("aiAgent"),
    goal: z.string().trim().max(500).optional(),
    maxTurns: z.number().int().min(1).max(20).optional(),
    nextId: z.string().optional(),
  }),
  z.object({ id: z.string().min(1), type: z.literal("end") }),
]);

export const ChatbotFlowSchema = z
  .object({ startId: z.string().min(1), nodes: z.record(z.string(), ChatbotNodeSchema) })
  .superRefine((flow, ctx) => {
    // Every node's map key must equal its own id.
    for (const [key, node] of Object.entries(flow.nodes)) {
      if (node.id !== key) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Node key "${key}" does not match its id "${node.id}"`, path: ["nodes", key] });
      }
    }
    // startId must resolve to a node.
    if (!flow.nodes[flow.startId]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `startId "${flow.startId}" is not a node`, path: ["startId"] });
    }
    // Every outgoing reference must resolve.
    const refs: { id: string; path: (string | number)[] }[] = [];
    for (const [key, node] of Object.entries(flow.nodes)) {
      if ("nextId" in node && node.nextId) refs.push({ id: node.nextId, path: ["nodes", key, "nextId"] });
      if (node.type === "branch") {
        node.cases.forEach((c, i) => refs.push({ id: c.nextId, path: ["nodes", key, "cases", i, "nextId"] }));
        if (node.defaultNextId) refs.push({ id: node.defaultNextId, path: ["nodes", key, "defaultNextId"] });
      }
    }
    for (const r of refs) {
      if (!flow.nodes[r.id]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Reference to unknown node "${r.id}"`, path: r.path });
      }
    }
  });

export type ChatbotFlow = z.infer<typeof ChatbotFlowSchema>;

// Create / full-update payload for a chatbot.
export const CreateChatbotSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  flow: ChatbotFlowSchema,
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: PASS (all new suites green, existing suites still green).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "Add ChatbotFlow + Chatbot create Zod schemas"
```

---

## Task 2: Chatbot Prisma model + migration `0032_chatbot`

**Files:**
- Modify: `prisma/schema.prisma` (add `model Chatbot` — place it near `model KnowledgeDoc`)
- Create: `prisma/migrations/0032_chatbot/migration.sql`

**Interfaces:**
- Produces: `prisma.chatbot` Prisma client model with fields `id, clientId, name, flow (Json), status, createdAt, updatedAt`; unique `[clientId, name]`. Consumed by Tasks 3 and 4.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

```prisma
// No-code chatbot definition (V2 M3). `flow` is a ChatbotFlow state machine
// (see ChatbotFlowSchema). Assigned to an automation trigger and run at
// inbound time (later phases).
model Chatbot {
  id        String   @id @default(cuid())
  clientId  String   @default("default")
  name      String
  flow      Json
  status    String   @default("DRAFT") // DRAFT | PUBLISHED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([clientId, name])
  @@index([clientId])
}
```

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/0032_chatbot/migration.sql`:

```sql
-- No-code chatbot definitions (V2 M3). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Chatbot" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT NOT NULL DEFAULT 'default',
  "name"      TEXT NOT NULL,
  "flow"      JSONB NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Chatbot_clientId_name_key" ON "Chatbot"("clientId", "name");
CREATE INDEX IF NOT EXISTS "Chatbot_clientId_idx" ON "Chatbot"("clientId");
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npm run prisma:generate`
Expected: "Generated Prisma Client" — `prisma.chatbot` now exists in the client types.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the generated client types resolve).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/0032_chatbot/migration.sql
git commit -m "Add Chatbot model + migration 0032_chatbot"
```

---

## Task 3: `/api/chatbots` — list + create

**Files:**
- Create: `src/app/api/chatbots/route.ts`

**Interfaces:**
- Consumes: `CreateChatbotSchema` (Task 1), `prisma.chatbot` (Task 2), `getAuthContext`/`getClientId` from `@/lib/users`.
- Produces: `GET /api/chatbots` → `{ chatbots: {id,name,status,updatedAt}[] }`; `POST /api/chatbots` → `{ chatbot: {id,name,status} }` (201) or `409` on duplicate name.

- [ ] **Step 1: Implement the route**

Create `src/app/api/chatbots/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CreateChatbotSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/chatbots — this client's bots, most-recently-updated first. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const chatbots = await prisma.chatbot.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, updatedAt: true },
  });
  return NextResponse.json({ chatbots });
}

/** POST /api/chatbots — create a bot (unique name per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CreateChatbotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  try {
    const chatbot = await prisma.chatbot.create({
      data: { clientId, name: parsed.data.name, status: parsed.data.status, flow: parsed.data.flow },
      select: { id: true, name: true, status: true },
    });
    return NextResponse.json({ chatbot }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A chatbot named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
```

Note: `parsed.data.flow` is a validated `ChatbotFlow`; Prisma's `Json` column accepts it. If the compiler objects to the object type on the `Json` field, cast at the boundary: `flow: parsed.data.flow as Prisma.InputJsonValue`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `SKIP_ENV_VALIDATION=1 npm run build`
Expected: build succeeds; `/api/chatbots` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chatbots/route.ts
git commit -m "Add GET/POST /api/chatbots"
```

---

## Task 4: `/api/chatbots/[id]` — read one + update + delete

**Files:**
- Create: `src/app/api/chatbots/[id]/route.ts`

**Interfaces:**
- Consumes: `CreateChatbotSchema` (Task 1), `prisma.chatbot` (Task 2), `getAuthContext`/`getClientId`.
- Produces: `GET /api/chatbots/:id` → `{ chatbot: {id,name,status,flow,updatedAt} }` or `404`; `PATCH` → `{ chatbot: {id,name,status} }` (full replace) or `404`/`409`; `DELETE` → `{ ok: true }` or `404`.

- [ ] **Step 1: Implement the route**

Create `src/app/api/chatbots/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CreateChatbotSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/chatbots/:id — full bot incl. flow, for the builder to load. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, clientId },
    select: { id: true, name: true, status: true, flow: true, updatedAt: true },
  });
  if (!chatbot) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ chatbot });
}

/** PATCH /api/chatbots/:id — full replace (name, status, flow). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = CreateChatbotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const existing = await prisma.chatbot.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const chatbot = await prisma.chatbot.update({
      where: { id },
      data: { name: parsed.data.name, status: parsed.data.status, flow: parsed.data.flow as Prisma.InputJsonValue },
      select: { id: true, name: true, status: true },
    });
    return NextResponse.json({ chatbot });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A chatbot named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

/** DELETE /api/chatbots/:id — remove a bot. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const existing = await prisma.chatbot.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.chatbot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `SKIP_ENV_VALIDATION=1 npm run build`
Expected: build succeeds; `/api/chatbots/[id]` appears in the route list.

- [ ] **Step 4: Full gate**

Run: `npm run typecheck && npm test && SKIP_ENV_VALIDATION=1 npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/chatbots/[id]/route.ts"
git commit -m "Add GET/PATCH/DELETE /api/chatbots/[id]"
```

---

## Self-Review

**Spec coverage (Phase 1 rows of spec §9):**
- `Chatbot` model → Task 2 ✓
- migration `0032_chatbot` → Task 2 ✓
- `ChatbotFlowSchema` → Task 1 ✓
- `/api/chatbots` CRUD → Tasks 3 (list/create) + 4 (read/update/delete) ✓
- Six node types incl. `ai` + `aiAgent` (spec §2) → Task 1 `ChatbotNodeSchema` ✓
- Reference-integrity validation (spec §2) → Task 1 `.superRefine` ✓
- Tenant scoping (spec §7) → Tasks 3/4 `getClientId` ✓

**Placeholder scan:** none — every step has full code and exact commands.

**Type consistency:** `ChatbotFlow`, `CreateChatbotSchema`, `ChatbotFlowSchema` names, node `type` literals (`message|question|branch|ai|aiAgent|end`), and route response shapes are consistent across Tasks 1→4. `prisma.chatbot` field names match the model in Task 2. Update verb is PATCH everywhere.

**Deferred to later phases (intentionally not in this plan):** `ChatbotSession` model, `lib/chatbot.ts` runtime, `startChatbot` automation action, the `/chatbot` builder page + slider. These are Phases 2–4.
