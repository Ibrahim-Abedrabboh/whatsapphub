# Chatbot Builder — Phase 4 (Runtime) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actually run a saved chatbot: when a `startChatbot` automation action fires, create a `ChatbotSession` and drive the conversation step-by-step across any channel; an ACTIVE session intercepts subsequent inbound messages ahead of rule-matching; a human agent replying takes over (abandons the session).

**Architecture:** A **pure, fully-unit-tested** engine (`lib/chatbot.ts`) walks the `ChatbotFlow`: it emits outbound text and parks on the next *wait-node* (`question` / `branch` / `aiAgent`). `ai`/`aiAgent` output comes from an **injected async responder**, so the core has no DB/AI/IO. A thin orchestrator (`lib/chatbotRun.ts`) persists sessions, wires the real Claude+KnowledgeDoc responder, and sends through the conversation's channel adapter. It hooks the existing inbound path (`automationRun.ts`, called by all three webhooks) and the agent-send path.

**Tech Stack:** Prisma + Postgres, TypeScript strict, Vitest, Anthropic SDK (via existing `lib/ai.ts`), the existing channel adapters.

## Global Constraints

- TypeScript `strict` **and** `noUncheckedIndexedAccess`.
- Imports use `@/...` (no worker files touched).
- Reuse Phase-1 `ChatbotFlow` / node types from `@/lib/validation`. Reuse `faqAnswer`/`rankDocs`/`KbDoc`/`isAiConfigured` from `@/lib/ai`, `getChannel` from `@/lib/channels`.
- Prisma only; the migration SQL is the one hand-written exception. Additive + idempotent (`CREATE TABLE IF NOT EXISTS`, `DEFAULT`), matching `0033_chatbot`.
- Migration number continues from `0033_chatbot` → **`0034_chatbot_session`**.
- Multi-tenant: every row carries `clientId`; scope every query.
- All chatbot execution is **best-effort**: callers already wrap `runAutomation` in `.catch(() => {})`; never block webhook ack.
- **AI-dark safe:** `ai`/`aiAgent` nodes must degrade gracefully when `isAiConfigured()` is false (emit a short fallback line, never throw).
- Reserved session-variable keys are prefixed `__` (engine bookkeeping, e.g. per-node agent turn counts); user `saveAs` names can't start with `_` (already enforced by `ChatbotFlowSchema`'s `/^[a-zA-Z_]/`… note: `_`-prefixed saveAs is technically allowed by the regex but the builder seeds `answer`; engine keys use `__` double-underscore to avoid collision).
- Definition of Done for every task: `npm run typecheck` · `npm test` · `SKIP_ENV_VALIDATION=1 npm run build` all green.

---

## File Structure

- `prisma/schema.prisma` — **modify**: add `model ChatbotSession`.
- `prisma/migrations/0034_chatbot_session/migration.sql` — **create**.
- `src/lib/chatbot.ts` — **create**: pure engine (`SessionState`, `NodeResponder`, `startRun`, `advance`, `substitute`).
- `src/lib/chatbot.test.ts` — **create**: engine unit tests.
- `src/lib/ai.ts` — **modify**: add exported `agentReply(...)`.
- `src/lib/chatbotResponder.ts` — **create**: `buildResponder(clientId)` (real Claude+KB responder) + `substitutionVars`.
- `src/lib/chatbotRun.ts` — **create**: `interceptActiveSession`, `startChatbotSession`, `sendAndRecord`.
- `src/lib/automationRun.ts` — **modify**: intercept an ACTIVE session first; handle a matched `startChatbot` action.
- `src/app/api/conversations/[id]/messages/route.ts` — **modify**: mark an ACTIVE session ABANDONED on agent send.

---

## Task 1: `ChatbotSession` model + migration `0034_chatbot_session`

**Files:**
- Modify: `prisma/schema.prisma` (place after `model Chatbot`)
- Create: `prisma/migrations/0034_chatbot_session/migration.sql`

**Interfaces:**
- Produces: `prisma.chatbotSession` with `id, clientId, conversationId, chatbotId, currentNodeId, variables (Json), status, createdAt, updatedAt`; `@@index([conversationId])`, `@@index([clientId])`.

- [ ] **Step 1: Add the model** to `prisma/schema.prisma` after `model Chatbot { … }`:

```prisma
// A running instance of a Chatbot on one conversation (V2 M3 Phase 4). At most
// one ACTIVE per conversation (enforced in app logic). variables holds captured
// question answers + engine bookkeeping (keys prefixed __).
model ChatbotSession {
  id             String   @id @default(cuid())
  clientId       String   @default("default")
  conversationId String
  chatbotId      String
  currentNodeId  String
  variables      Json     @default("{}")
  status         String   @default("ACTIVE") // ACTIVE | DONE | ABANDONED
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([conversationId])
  @@index([clientId])
}
```

- [ ] **Step 2: Create** `prisma/migrations/0034_chatbot_session/migration.sql`:

```sql
-- Running chatbot sessions (V2 M3 Phase 4). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "ChatbotSession" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT NOT NULL DEFAULT 'default',
  "conversationId" TEXT NOT NULL,
  "chatbotId"      TEXT NOT NULL,
  "currentNodeId"  TEXT NOT NULL,
  "variables"      JSONB NOT NULL DEFAULT '{}',
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatbotSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatbotSession_conversationId_idx" ON "ChatbotSession"("conversationId");
CREATE INDEX IF NOT EXISTS "ChatbotSession_clientId_idx" ON "ChatbotSession"("clientId");
```

- [ ] **Step 3: Regenerate + typecheck**

Run: `npm run prisma:generate && npm run typecheck`
Expected: `prisma.chatbotSession` exists; no type errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/0034_chatbot_session/migration.sql
git commit -m "Add ChatbotSession model + migration 0034_chatbot_session"
```

---

## Task 2: Pure engine `lib/chatbot.ts` (TDD — the core)

**Files:**
- Create: `src/lib/chatbot.ts`
- Test: `src/lib/chatbot.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3–4):
  - `interface SessionState { currentNodeId: string; variables: Record<string, string>; status: "ACTIVE" | "DONE" | "ABANDONED" }`
  - `interface RespondArgs { node: ChatbotNode; variables: Record<string, string>; inboundText: string; turn: number }`
  - `type NodeResponder = (args: RespondArgs) => Promise<{ text: string; agentDone?: boolean }>`
  - `interface AdvanceResult { session: SessionState; outbound: string[]; waiting: boolean; done: boolean }`
  - `function substitute(text: string, vars: Record<string, string>): string`
  - `async function startRun(flow: ChatbotFlow, respond: NodeResponder, vars?: Record<string,string>): Promise<AdvanceResult>`
  - `async function advance(flow: ChatbotFlow, session: SessionState, inboundText: string, respond: NodeResponder): Promise<AdvanceResult>`
  - `ChatbotNode` = the union member type (`ChatbotFlow["nodes"][string]`), re-exported for Tasks 3–4.

- [ ] **Step 1: Write the failing tests** — create `src/lib/chatbot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { startRun, advance, substitute, type NodeResponder, type SessionState } from "./chatbot";
import type { ChatbotFlow } from "./validation";

// respond stub: ai → echoes a canned answer; aiAgent → "done" once inbound says "bye"
const respond: NodeResponder = async ({ node, inboundText }) => {
  if (node.type === "aiAgent") return { text: `agent:${inboundText}`, agentDone: inboundText.includes("bye") };
  return { text: "ai-answer" };
};

const flow = (startId: string, nodes: ChatbotFlow["nodes"]): ChatbotFlow => ({ startId, nodes });

describe("substitute", () => {
  it("fills {{name}} and saved vars, leaves unknowns", () => {
    expect(substitute("Hi {{name}}, size {{size}}? {{x}}", { name: "Sara", size: "L" })).toBe("Hi Sara, size L? {{x}}");
  });
});

describe("startRun", () => {
  it("emits leading messages and parks on the first question", async () => {
    const f = flow("m", {
      m: { id: "m", type: "message", text: "Hi {{name}}", nextId: "q" },
      q: { id: "q", type: "question", text: "Size?", saveAs: "size", nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const r = await startRun(f, respond, { name: "Sara" });
    expect(r.outbound).toEqual(["Hi Sara", "Size?"]);
    expect(r.waiting).toBe(true);
    expect(r.session.currentNodeId).toBe("q");
    expect(r.done).toBe(false);
  });
  it("runs straight to end when there is no wait-node", async () => {
    const f = flow("m", { m: { id: "m", type: "message", text: "Bye", nextId: "e" }, e: { id: "e", type: "end" } });
    const r = await startRun(f, respond);
    expect(r.outbound).toEqual(["Bye"]);
    expect(r.done).toBe(true);
    expect(r.session.status).toBe("DONE");
  });
});

describe("advance — question", () => {
  it("captures the answer into variables and walks on", async () => {
    const f = flow("q", {
      q: { id: "q", type: "question", text: "Size?", saveAs: "size", nextId: "m" },
      m: { id: "m", type: "message", text: "Got {{size}}", nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "Large", respond);
    expect(r.session.variables.size).toBe("Large");
    expect(r.outbound).toEqual(["Got Large"]);
    expect(r.done).toBe(true);
  });
});

describe("advance — branch", () => {
  const f = flow("b", {
    b: { id: "b", type: "branch", cases: [{ keywords: ["yes"], nextId: "y" }], defaultNextId: "n" },
    y: { id: "y", type: "message", text: "yes!", nextId: "e" },
    n: { id: "n", type: "message", text: "no.", nextId: "e" },
    e: { id: "e", type: "end" },
  });
  it("routes on a keyword match", async () => {
    const start = await startRun(f, respond); // parks on branch (no emit)
    expect(start.session.currentNodeId).toBe("b");
    const r = await advance(f, start.session, "YES please", respond);
    expect(r.outbound).toEqual(["yes!"]);
  });
  it("falls back to defaultNextId with no match", async () => {
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "maybe", respond);
    expect(r.outbound).toEqual(["no."]);
  });
});

describe("advance — ai / aiAgent", () => {
  it("ai emits a one-shot answer then continues", async () => {
    const f = flow("q", {
      q: { id: "q", type: "question", text: "Ask?", saveAs: "x", nextId: "a" },
      a: { id: "a", type: "ai", nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "how much?", respond);
    expect(r.outbound).toEqual(["ai-answer"]);
    expect(r.done).toBe(true);
  });
  it("aiAgent stays on turns until it signals done", async () => {
    const f = flow("g", {
      g: { id: "g", type: "aiAgent", maxTurns: 5, nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const start = await startRun(f, respond); // parks on agent
    const t1 = await advance(f, start.session, "hello", respond);
    expect(t1.outbound).toEqual(["agent:hello"]);
    expect(t1.waiting).toBe(true);
    expect(t1.done).toBe(false);
    const t2 = await advance(f, t1.session, "ok bye", respond);
    expect(t2.outbound).toEqual(["agent:ok bye"]);
    expect(t2.done).toBe(true);
  });
  it("aiAgent ends when maxTurns is reached", async () => {
    const f = flow("g", { g: { id: "g", type: "aiAgent", maxTurns: 1, nextId: "e" }, e: { id: "e", type: "end" } });
    const start = await startRun(f, respond);
    const t1 = await advance(f, start.session, "hi", respond);
    expect(t1.done).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/chatbot.test.ts`
Expected: FAIL — module `./chatbot` not found.

- [ ] **Step 3: Implement** `src/lib/chatbot.ts`:

```ts
import type { ChatbotFlow } from "@/lib/validation";

export type ChatbotNode = ChatbotFlow["nodes"][string];

export interface SessionState {
  currentNodeId: string;
  variables: Record<string, string>;
  status: "ACTIVE" | "DONE" | "ABANDONED";
}

export interface RespondArgs {
  node: ChatbotNode;
  variables: Record<string, string>;
  inboundText: string;
  turn: number;
}
export type NodeResponder = (args: RespondArgs) => Promise<{ text: string; agentDone?: boolean }>;

export interface AdvanceResult {
  session: SessionState;
  outbound: string[];
  waiting: boolean;
  done: boolean;
}

const WAIT_TYPES = new Set(["question", "branch", "aiAgent"]);

/** Replace {{name}}/{{phone}}/{{savedVar}} with values; unknown tokens stay. */
export function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => (key in vars ? vars[key]! : m));
}

const turnKey = (nodeId: string) => `__turn:${nodeId}`;

/** Walk non-wait nodes from `nodeId`, emitting outbound, until a wait-node
 *  (park) or end (done). On arrival at a `question` we emit its prompt then park.
 *  Mutates a copy of session; returns the result. */
async function walk(flow: ChatbotFlow, nodeId: string | undefined, session: SessionState, respond: NodeResponder): Promise<AdvanceResult> {
  const outbound: string[] = [];
  let cursor = nodeId;
  const vars = { ...session.variables };

  while (cursor) {
    const node = flow.nodes[cursor];
    if (!node) break; // dangling ref — stop safely
    if (node.type === "message") {
      outbound.push(substitute(node.text, vars));
      cursor = node.nextId;
      continue;
    }
    if (node.type === "ai") {
      const { text } = await respond({ node, variables: vars, inboundText: vars.__lastInbound ?? "", turn: 0 });
      outbound.push(text);
      cursor = node.nextId;
      continue;
    }
    if (node.type === "end") {
      return { session: { currentNodeId: cursor, variables: vars, status: "DONE" }, outbound, waiting: false, done: true };
    }
    // wait-node: question emits its prompt on arrival, then parks; branch/aiAgent just park.
    if (node.type === "question") outbound.push(substitute(node.text, vars));
    return { session: { currentNodeId: cursor, variables: vars, status: "ACTIVE" }, outbound, waiting: true, done: false };
  }
  // ran off the end with no explicit end node
  return { session: { currentNodeId: session.currentNodeId, variables: vars, status: "DONE" }, outbound, waiting: false, done: true };
}

/** Begin a new session: walk from the flow's startId. */
export function startRun(flow: ChatbotFlow, respond: NodeResponder, vars: Record<string, string> = {}): Promise<AdvanceResult> {
  const session: SessionState = { currentNodeId: flow.startId, variables: { ...vars }, status: "ACTIVE" };
  return walk(flow, flow.startId, session, respond);
}

/** Feed an inbound message to the parked wait-node, then walk onward. */
export async function advance(flow: ChatbotFlow, session: SessionState, inboundText: string, respond: NodeResponder): Promise<AdvanceResult> {
  const node = flow.nodes[session.currentNodeId];
  const vars = { ...session.variables, __lastInbound: inboundText };
  if (!node) return { session: { ...session, variables: vars }, outbound: [], waiting: false, done: true };

  if (node.type === "question") {
    vars[node.saveAs] = inboundText;
    return walk(flow, node.nextId, { ...session, variables: vars }, respond);
  }
  if (node.type === "branch") {
    const text = inboundText.toLowerCase();
    const hit = node.cases.find((c) => c.keywords.some((k) => text.includes(k.toLowerCase())));
    const nextId = hit ? hit.nextId : node.defaultNextId;
    if (!nextId) return { session: { ...session, variables: vars }, outbound: [], waiting: true, done: false }; // no route — keep waiting
    return walk(flow, nextId, { ...session, variables: vars }, respond);
  }
  if (node.type === "aiAgent") {
    const turn = Number(vars[turnKey(node.id)] ?? "0") + 1;
    vars[turnKey(node.id)] = String(turn);
    const { text, agentDone } = await respond({ node, variables: vars, inboundText, turn });
    const finished = agentDone === true || (typeof node.maxTurns === "number" && turn >= node.maxTurns);
    if (!finished) return { session: { ...session, variables: vars }, outbound: [text], waiting: true, done: false };
    const walked = await walk(flow, node.nextId, { ...session, variables: vars }, respond);
    return { ...walked, outbound: [text, ...walked.outbound] };
  }
  // parked on a non-wait node somehow — just walk from its nextId if any
  const nextId = "nextId" in node ? node.nextId : undefined;
  return walk(flow, nextId, { ...session, variables: vars }, respond);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/chatbot.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chatbot.ts src/lib/chatbot.test.ts
git commit -m "Add pure chatbot runtime engine (startRun/advance)"
```

---

## Task 3: Real Claude+KB responder

**Files:**
- Modify: `src/lib/ai.ts` (add `agentReply`)
- Create: `src/lib/chatbotResponder.ts`

**Interfaces:**
- Consumes: `faqAnswer`, `rankDocs`, `KbDoc`, `isAiConfigured` (`@/lib/ai`); `NodeResponder`, `ChatbotNode` (`@/lib/chatbot`); `prisma`.
- Produces:
  - `ai.ts`: `export async function agentReply(goal: string, transcript: string, docs: KbDoc[]): Promise<{ text: string; done: boolean }>`
  - `chatbotResponder.ts`: `export function substitutionVars(name: string | null, phone: string): Record<string,string>` and `export async function buildResponder(clientId: string, loadTranscript: () => Promise<string>): Promise<NodeResponder>`

- [ ] **Step 1: Add `agentReply` to `src/lib/ai.ts`** (after `faqAnswer`):

```ts
/** One autonomous agent turn. Answers from the KB toward `goal`, and signals
 *  completion by ending its reply with the token [[DONE]] (stripped from text). */
export async function agentReply(goal: string, transcript: string, docs: KbDoc[]): Promise<{ text: string; done: boolean }> {
  const kb = docs.map((d, i) => `[Doc ${i + 1}: ${d.title}]\n${d.content}`).join("\n\n") || "(empty)";
  const system =
    `You are an autonomous WhatsApp sales/support agent. Your goal: ${goal || "help the customer"}. ` +
    "Reply with a single concise customer-facing message. Use ONLY the knowledge base for facts. " +
    "When the goal is met or the customer is done, end your message with the token [[DONE]].\n\n" +
    "=== Knowledge base ===\n" + kb;
  const raw = await complete({ system, user: transcript, maxTokens: 600 });
  const done = raw.includes("[[DONE]]");
  return { text: raw.replace(/\[\[DONE\]\]/g, "").trim(), done };
}
```

- [ ] **Step 2: Create `src/lib/chatbotResponder.ts`:**

```ts
import { prisma } from "@/lib/db";
import { isAiConfigured, faqAnswer, agentReply, rankDocs, type KbDoc } from "@/lib/ai";
import type { NodeResponder } from "@/lib/chatbot";

/** Contact-derived template vars for {{name}}/{{phone}}. */
export function substitutionVars(name: string | null, phone: string): Record<string, string> {
  return { name: name ?? "there", phone };
}

/** Wire a real responder for ai/aiAgent nodes: retrieves this client's KB docs
 *  and calls Claude. Degrades to a safe line when AI is not configured. */
export async function buildResponder(clientId: string, loadTranscript: () => Promise<string>): Promise<NodeResponder> {
  const rows = await prisma.knowledgeDoc.findMany({ where: { clientId }, select: { id: true, title: true, content: true } });
  const docs: KbDoc[] = rows;

  return async ({ node, inboundText }) => {
    if (!isAiConfigured()) return { text: "Thanks — a team member will follow up shortly.", agentDone: true };
    try {
      if (node.type === "aiAgent") {
        const transcript = await loadTranscript();
        const { text, done } = await agentReply(node.goal ?? "", `${transcript}\nCustomer: ${inboundText}`, rankDocs(inboundText, docs, 3));
        return { text: text || "…", agentDone: done };
      }
      // one-shot ai node
      const text = await faqAnswer(inboundText, rankDocs(inboundText, docs, 3));
      return { text };
    } catch {
      return { text: "Sorry — I couldn't process that right now.", agentDone: true };
    }
  };
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && SKIP_ENV_VALIDATION=1 npm run build`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai.ts src/lib/chatbotResponder.ts
git commit -m "Add Claude+KB chatbot responder (ai + aiAgent turns)"
```

---

## Task 4: Orchestration — intercept + start a session

**Files:**
- Create: `src/lib/chatbotRun.ts`
- Modify: `src/lib/automationRun.ts`

**Interfaces:**
- Consumes: `startRun`, `advance`, `type SessionState` (`@/lib/chatbot`); `buildResponder`, `substitutionVars` (`@/lib/chatbotResponder`); `getChannel` (`@/lib/channels`); `ChatbotFlow` (`@/lib/validation`); `prisma`.
- Produces:
  - `export async function interceptActiveSession(clientId, channel, peer, text): Promise<boolean>` — true if a session handled the message.
  - `export async function startChatbotSession(clientId, channel, peer, chatbotId): Promise<void>`

- [ ] **Step 1: Create `src/lib/chatbotRun.ts`:**

```ts
import { prisma } from "@/lib/db";
import { getChannel } from "@/lib/channels";
import type { ChatbotFlow } from "@/lib/validation";
import { startRun, advance, type SessionState } from "@/lib/chatbot";
import { buildResponder, substitutionVars } from "@/lib/chatbotResponder";
import { loadThread } from "@/lib/aiThread";
import { threadToTranscript } from "@/lib/ai";

async function resolveConversation(clientId: string, channel: string, peer: string) {
  return prisma.conversation.findUnique({
    where: { clientId_channel_phone: { clientId, channel, phone: peer } },
    select: { id: true, contactName: true },
  }).catch(() => null);
}

async function send(clientId: string, channel: string, peer: string, conversationId: string | null, outbound: string[]) {
  for (const body of outbound) {
    if (!body.trim()) continue;
    const wamid = await getChannel(channel).sendText({ to: peer, body, clientId }).catch(() => null);
    if (conversationId) {
      await prisma.message.create({ data: { clientId, conversationId, channel, direction: "OUT", type: "text", text: body, wamid: wamid ?? null, status: "SENT" } });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), lastPreview: body } });
    }
  }
}

/** If an ACTIVE session owns this conversation, advance it and return true. */
export async function interceptActiveSession(clientId: string, channel: string, peer: string, text: string): Promise<boolean> {
  const convo = await resolveConversation(clientId, channel, peer);
  if (!convo) return false;
  const row = await prisma.chatbotSession.findFirst({ where: { clientId, conversationId: convo.id, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
  if (!row) return false;

  const bot = await prisma.chatbot.findFirst({ where: { id: row.chatbotId, clientId }, select: { flow: true } });
  if (!bot) { await prisma.chatbotSession.update({ where: { id: row.id }, data: { status: "ABANDONED" } }); return true; }

  const responder = await buildResponder(clientId, async () => threadToTranscript(await loadThread(convo.id)));
  const session: SessionState = { currentNodeId: row.currentNodeId, variables: (row.variables as Record<string, string>) ?? {}, status: "ACTIVE" };
  const result = await advance(bot.flow as unknown as ChatbotFlow, session, text, responder);

  await send(clientId, channel, peer, convo.id, result.outbound);
  await prisma.chatbotSession.update({ where: { id: row.id }, data: { currentNodeId: result.session.currentNodeId, variables: result.session.variables, status: result.done ? "DONE" : "ACTIVE" } });
  return true;
}

/** Create a session for `chatbotId` on this conversation and run its opening nodes. */
export async function startChatbotSession(clientId: string, channel: string, peer: string, chatbotId: string): Promise<void> {
  const convo = await resolveConversation(clientId, channel, peer);
  if (!convo) return;
  const bot = await prisma.chatbot.findFirst({ where: { id: chatbotId, clientId }, select: { flow: true } });
  if (!bot) return;

  // One ACTIVE session per conversation: retire any prior.
  await prisma.chatbotSession.updateMany({ where: { clientId, conversationId: convo.id, status: "ACTIVE" }, data: { status: "ABANDONED" } });

  const responder = await buildResponder(clientId, async () => threadToTranscript(await loadThread(convo.id)));
  const vars = substitutionVars(convo.contactName ?? null, peer);
  const result = await startRun(bot.flow as unknown as ChatbotFlow, responder, vars);

  await send(clientId, channel, peer, convo.id, result.outbound);
  await prisma.chatbotSession.create({
    data: { clientId, conversationId: convo.id, chatbotId, currentNodeId: result.session.currentNodeId, variables: result.session.variables, status: result.done ? "DONE" : "ACTIVE" },
  });
}
```

> **Note on `contactName`:** confirm the `Conversation` model exposes a display name field (the inbox uses one). If it is named differently (e.g. `title`), adjust the `select` and `substitutionVars` call. If there is no such field, pass `null`.

- [ ] **Step 2: Wire into `src/lib/automationRun.ts`** — intercept first, and handle a matched `startChatbot`. Add imports at the top:

```ts
import { interceptActiveSession, startChatbotSession } from "./chatbotRun";
```

At the **very start** of `runAutomation`, before loading rules:

```ts
  // An ACTIVE chatbot session owns the conversation — it intercepts ahead of rules.
  if (await interceptActiveSession(clientId, channel, peer, text)) return;
```

After computing matched actions, before the `sendText` handling, pick the first matched action and branch. Replace the `const send = evaluateRules(...).find(...)` block with:

```ts
  const actions = evaluateRules(rules, { text, now: new Date() });
  const first = actions[0];
  if (!first) return;

  // Never auto-act on an opted-out contact.
  const opted = await prisma.optOut.findUnique({ where: { clientId_phone: { clientId, phone: peer } }, select: { id: true } }).catch(() => null);
  if (opted) return;

  if (first.type === "startChatbot") {
    const claimed = await connection.set(`auto:${channel}:${clientId}:${peer}`, "1", "EX", COOLDOWN_SECONDS, "NX");
    if (claimed !== "OK") return;
    await startChatbotSession(clientId, channel, peer, first.chatbotId);
    return;
  }

  const send = first; // type: sendText
```

Then delete the now-duplicated opt-out check further down (the block that re-queries `prisma.optOut`), keeping the cooldown-claim + send logic for the `sendText` path. Ensure the remaining code references `send.body` (now the narrowed `sendText` action).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (`first` is the `Action` union; the `first.type === "startChatbot"` guard narrows each branch. If TS still sees `send` as the union, add `if (send.type !== "sendText") return;` before using `send.body`.)

- [ ] **Step 4: Build + full unit gate**

Run: `npm run typecheck && npm test && SKIP_ENV_VALIDATION=1 npm run build`
Expected: all green (engine tests included; existing automationRun behavior for `sendText` unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chatbotRun.ts src/lib/automationRun.ts
git commit -m "Orchestrate chatbot sessions in the inbound path"
```

---

## Task 5: Agent takeover abandons the session

**Files:**
- Modify: `src/app/api/conversations/[id]/messages/route.ts`

**Interfaces:**
- Consumes: `prisma`. Produces: when a human agent sends into a conversation, any ACTIVE `ChatbotSession` there is marked `ABANDONED` so the bot yields.

- [ ] **Step 1: Inspect the route** to find where an outbound agent message is created (the `POST` handler, after the message is persisted / send succeeds).

Run: `sed -n '1,120p' src/app/api/conversations/[id]/messages/route.ts`

- [ ] **Step 2: Abandon ACTIVE sessions on agent send.** In the `POST` handler, after the outbound message is recorded, add (using the route's existing `clientId` + conversation `id` variables — adjust names to match the file):

```ts
  // A human agent took over — yield any running chatbot on this conversation.
  await prisma.chatbotSession.updateMany({ where: { clientId, conversationId: id, status: "ACTIVE" }, data: { status: "ABANDONED" } }).catch(() => {});
```

- [ ] **Step 3: Typecheck + build + full gate**

Run: `npm run typecheck && npm test && SKIP_ENV_VALIDATION=1 npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/conversations/[id]/messages/route.ts"
git commit -m "Abandon ACTIVE chatbot session when an agent replies"
```

---

## Self-Review

**Spec coverage (spec §4 Runtime + §9 Phase 4 row):**
- `ChatbotSession` model + migration → Task 1 ✓
- Pure `advance()` core with injected responder → Task 2 ✓ (plus `startRun` for opening nodes; wait vs non-wait semantics; question capture; branch match/fallback; ai one-shot; aiAgent multi-turn + maxTurns; end → done)
- ai/aiAgent reuse AI-FAQ + KnowledgeDoc → Task 3 ✓ (degrades when AI dark)
- ACTIVE session intercepts ahead of rule matching → Task 4 (`interceptActiveSession` at top of `runAutomation`) ✓
- Matched `startChatbot` action creates a session + runs opening nodes → Task 4 (`startChatbotSession`) ✓
- Channel-agnostic sending → Task 4 (`getChannel(channel).sendText`) ✓
- One ACTIVE session per conversation → Task 4 (`updateMany … ABANDONED` before create) ✓
- Agent takeover abandons the session → Task 5 ✓

**Placeholder scan:** none, except two explicitly-flagged verify-in-file points (Conversation display-name field in Task 4 Step 1 note; exact variable names in Task 5 Step 2) — both instruct the implementer to read the file and adjust, with a safe fallback.

**Type consistency:** `SessionState`, `NodeResponder`, `AdvanceResult`, `ChatbotNode` defined in Task 2 and consumed unchanged in Tasks 3–4. `Action`'s `startChatbot`/`chatbotId` (Phase 3) drives Task 4's branch. `ChatbotFlow` cast at the DB boundary (`bot.flow as unknown as ChatbotFlow`) mirrors Phase-1 route casts.

**Deferred / out of scope:** analytics on bot runs; media/template node outputs; embeddings retrieval (keyword `rankDocs` reused); a UI to view/kill live sessions.
```
