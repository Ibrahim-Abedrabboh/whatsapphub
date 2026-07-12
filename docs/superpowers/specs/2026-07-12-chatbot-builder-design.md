# No-code Chatbot Builder — Design

**Date:** 2026-07-12
**Status:** Draft for review
**Milestone:** V2 M3 (AI assist / Automation family)
**Author:** brainstormed with the user

## 1. Summary

A **no-code chatbot builder**: a drag-and-drop page (`/chatbot`) where a user composes a
multi-step conversational flow, saves it, and assigns it to an automation trigger. When the
trigger fires on an inbound message, the saved bot **runs** — driving the conversation step by
step across **any inbox channel** (WhatsApp, Instagram DM, Messenger).

This is the functional builder, not a marketing page. A small auto-playing "How it works"
slider sits at the top of the page as an onboarding/marketing intro.

### Scope decisions (locked in during brainstorming)
- **Full feature, all 4 phases**, including the runtime that actually converses.
- **Structured step blocks** (drag-to-reorder + nested branches), native HTML5 drag-and-drop —
  no heavy canvas/graph dependency.
- **Two AI node types:** `ai` (one-shot, knowledge-grounded answer, then continue) and
  `aiAgent` (autonomous, multi-turn agent that owns the conversation until it decides it's done).
- **Channel-agnostic:** replies go out through the conversation's own channel adapter; sessions
  key off `conversationId`, not a WhatsApp number.
- **An ACTIVE session intercepts** inbound messages ahead of normal automation-rule matching.
- **AI nodes reuse** the existing AI-FAQ + `KnowledgeDoc` plumbing.
- Marketing "How it works" **slider kept** as an intro at the top of `/chatbot`.

## 2. Flow representation

A chatbot flow is a **state machine** stored as JSON on the `Chatbot` row. The builder edits it
as ordered step blocks and compiles to this node map on save; the runtime walks the map.

```ts
type ChatbotFlow = { startId: string; nodes: Record<string, Node> };

type Node =
  | { id: string; type: "message";  text: string; nextId?: string }
  | { id: string; type: "question"; text: string; saveAs: string; nextId?: string }
  | { id: string; type: "branch";   cases: { keywords: string[]; nextId: string }[]; defaultNextId?: string }
  | { id: string; type: "ai";       nextId?: string }                     // one-shot KB-grounded answer
  | { id: string; type: "aiAgent";  goal?: string; maxTurns?: number; nextId?: string } // autonomous multi-turn
  | { id: string; type: "end" };
```

- `message` / `question` text supports `{{name}}` / `{{phone}}` substitution (same helper as
  `CannedReply`).
- **Wait-nodes** (pause for the next inbound message): `question`, `branch`, and `aiAgent`.
  `message`, `ai`, and `end` do not wait — the engine runs straight through them.
- **`ai`** node: sends one knowledge-grounded answer to the customer's last message, then follows
  `nextId`.
- **`aiAgent`** node: stays "current" across multiple inbound turns. On each inbound message it
  responds using Claude + `KnowledgeDoc`. It ends (and follows `nextId`) when the agent signals
  completion or `maxTurns` is reached.

### Validation (`ChatbotFlowSchema` in `lib/validation.ts`)
- `startId` resolves to a node.
- Every `nextId` / `cases[].nextId` / `defaultNextId` resolves to an existing node.
- `question.saveAs` is a valid variable name; branch `cases` non-empty.
- No orphan nodes unreachable from `startId` (warning, not error) and no dangling references
  (error). Positive **and** negative tests.

## 3. Data model (Prisma) + migration `0032_chatbot`

```prisma
model Chatbot {
  id        String   @id @default(cuid())
  clientId  String
  name      String
  flow      Json                          // ChatbotFlow
  status    String   @default("DRAFT")    // DRAFT | PUBLISHED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([clientId, name])
  @@index([clientId])
}

model ChatbotSession {
  id             String   @id @default(cuid())
  clientId       String
  conversationId String
  chatbotId      String
  currentNodeId  String
  variables      Json     @default("{}")  // captured question answers
  status         String   @default("ACTIVE") // ACTIVE | DONE | ABANDONED
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([conversationId])
  @@index([clientId])
}
```

At most one ACTIVE session per conversation is enforced in application logic (starting a bot
marks any prior ACTIVE session ABANDONED). Migration continues from `0031_orders`; renumber to
`0033` if the unmerged `feat/v2-m5-payments-cart` `0032` lands first.

## 4. Runtime engine (Phase 4)

**Pure core — `lib/chatbot.ts`** (no DB/IO, fully unit-tested):

```ts
advance(flow: ChatbotFlow, session: SessionState, inboundText: string)
  : { session: SessionState; outbound: string[]; waiting: boolean; done: boolean }
```

- Feeds `inboundText` to the current wait-node (records `question` answers, evaluates `branch`
  keywords, runs an `aiAgent` turn), then walks non-wait nodes, collecting `outbound` messages,
  until it reaches the next wait-node or `end`.
- `ai` / `aiAgent` turns call an injected async responder (so the core stays pure/testable; the
  webhook supplies the real Claude+KB responder).

**Orchestration — inbound webhook (`lib/inboundMessage.ts` / `lib/automationRun.ts`):**
1. On an inbound message, look up an ACTIVE `ChatbotSession` for the conversation.
2. **If one exists:** run `advance()`, send `outbound` via the conversation's channel adapter
   (`lib/channels/*`), persist the updated session. Skip normal rule matching. If `done`, mark
   session DONE.
3. **If none exists:** evaluate automation rules as today. A matched `startChatbot` action creates
   an ACTIVE session and runs the opening nodes.
4. **Agent takeover:** if a human/agent sends into the conversation, mark the ACTIVE session
   ABANDONED so the bot yields.

**Channel-agnostic sending:** the orchestrator resolves the conversation's `channel` and dispatches
through the matching adapter; the engine core only emits text strings.

## 5. Automation integration (Phase 3)

Extend the automation `Action` union:

```ts
type Action =
  | { type: "sendText"; body: string }
  | { type: "startChatbot"; chatbotId: string };   // NEW
```

- `evaluateRules` returns `startChatbot` actions unchanged; `automationRun.ts` handles the new type
  by creating a session.
- The existing automation-rules UI gains a "Start a chatbot" action option with a dropdown of the
  tenant's PUBLISHED bots.
- `AutomationRuleSchema` in `lib/validation.ts` extended to accept the new action.

## 6. Builder page `/chatbot` (Phases 1–2)

In-app, behind auth, standard `<Nav /> + <main className="app">` shell, `force-dynamic`.
Added to `Nav.tsx`.

- **`ChatbotHowItWorks`** (client): auto-playing slider intro. 4 steps — *Pick a trigger → Drag
  your steps → Add AI knowledge → Publish & go live*. Prev/next arrows, clickable dots,
  pause-on-hover, `prefers-reduced-motion` respected. Bilingual EN/AR via the existing `data-lang`
  pattern. Styled with existing card/badge tokens from `globals.css` (no new inline hex).
- **Saved-bots list** + "New chatbot" (GET `/api/chatbots`).
- **`ChatbotBuilder`** (client): a vertical list of typed step blocks —
  *Send message · Ask & wait · Branch on reply · AI answer · AI Agent · End*. Native HTML5
  `draggable` reorder; an "add step" menu; per-block config inputs; `branch` blocks hold nested
  case rows (keywords → target). **Save** compiles blocks → `ChatbotFlow` and POSTs/PUTs. Client
  validates before save; server re-validates with `ChatbotFlowSchema`.

## 7. API + validation

- `GET /api/chatbots` — list tenant bots. `POST /api/chatbots` — create.
- `GET|PUT|DELETE /api/chatbots/[id]` — read/update/delete, tenant-scoped via `getClientId`.
- All bodies validated by `ChatbotFlowSchema` / a `CreateChatbotSchema` wrapper in
  `lib/validation.ts`. Node runtime is `nodejs` where AI calls are made.

## 8. Testing (Definition of Done gate)

- **Unit (Vitest):**
  - `ChatbotFlowSchema` — valid graphs pass; dangling `nextId`, missing `startId`, empty branch
    cases fail.
  - `advance()` — linear run; `question` captures into `variables`; `branch` match + fallback;
    `ai` one-shot then continue; `aiAgent` multi-turn then completion; `end` sets `done`.
  - Automation: a `startChatbot` action is produced by a matching rule; agent-takeover abandons a
    session.
- **e2e (Playwright):** `/chatbot` loads; build + save a bot; assign it as a trigger action in the
  automation UI.
- Gate for every phase: `npm run typecheck` · `npm test` · `npm run build`.

## 9. Phasing / delivery

One design doc (this file); implementation in four gate-green slices, each its own plan/PR:

| Phase | Deliverable |
|------|-------------|
| **1. Data + API** | `Chatbot` model, migration `0032_chatbot`, `ChatbotFlowSchema`, `/api/chatbots` CRUD |
| **2. Builder + slider** | `/chatbot` page, `ChatbotHowItWorks`, `ChatbotBuilder`, Nav entry |
| **3. Automation hook-up** | `startChatbot` action, automation UI dropdown, schema extension |
| **4. Runtime** | `ChatbotSession` model, `lib/chatbot.ts` engine, channel-agnostic webhook orchestration |

## 10. Out of scope (this feature)
- Analytics/reporting on bot performance.
- Visual node-graph canvas (using structured blocks instead).
- Non-text node outputs (media/template nodes) — future extension.
- A/B testing of bot variants.
