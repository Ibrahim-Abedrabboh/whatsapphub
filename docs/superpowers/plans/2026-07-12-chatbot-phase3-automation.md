# Chatbot Builder — Phase 3 (Automation hook-up) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an automation rule *start a chatbot* — add a `startChatbot` action alongside `sendText`, across the Zod schema, the pure rules engine, the inbound runner, and the automation-rules UI (a "Start a chatbot" option with a dropdown of the tenant's PUBLISHED bots).

**Architecture:** The automation `action` becomes a discriminated union (`sendText | startChatbot`). `evaluateRules` already returns every matched rule's action unchanged, so the engine needs only the wider type. The inbound runner (`automationRun.ts`) still executes only `sendText` this phase — **actually starting a session is Phase 4** (needs `ChatbotSession` + runtime); the runner narrows to `sendText` and ignores `startChatbot`. The UI gains an action-type selector and a PUBLISHED-bot dropdown.

**Tech Stack:** Zod discriminated unions, TypeScript strict, Vitest, Next.js 15 client component.

## Global Constraints

- TypeScript `strict` **and** `noUncheckedIndexedAccess`.
- Imports use `@/...` (no worker files touched).
- All rule bodies validated by `AutomationRuleSchema` in `src/lib/validation.ts` (single source of truth). The API routes already store `parsed.data.action` as opaque JSON — **no route changes**.
- Reuse the Phase-1 `/api/chatbots` list endpoint for the bot dropdown (returns `{id,name,status}`); filter to `status === "PUBLISHED"` client-side.
- Styling: existing tokens only — `.card .btn .btn--ghost .field .label .input .table .badge .note`. No new inline hex.
- Definition of Done for every task: `npm run typecheck` · `npm test` · `SKIP_ENV_VALIDATION=1 npm run build` all green.
- **Out of scope (Phase 4):** creating/running a `ChatbotSession` when a `startChatbot` action fires. This phase only *defines, persists, and authors* the action.

---

## File Structure

- `src/lib/automation.ts` — **modify**: widen `Action` to a union.
- `src/lib/automation.test.ts` — **modify**: `evaluateRules` returns a `startChatbot` action.
- `src/lib/validation.ts` — **modify**: `AutomationRuleSchema.action` → discriminated union.
- `src/lib/validation.test.ts` — **modify**: accept/reject the new action.
- `src/lib/automationRun.ts` — **modify**: narrow to `sendText` (type-guarded `.find`); ignore `startChatbot`.
- `src/components/AutomationRulesManager.tsx` — **modify**: action-type selector + PUBLISHED-bot dropdown + build/edit for both action types.

---

## Task 1: Schema + engine + runner accept a `startChatbot` action

**Files:**
- Modify: `src/lib/automation.ts`, `src/lib/validation.ts`, `src/lib/automationRun.ts`
- Test: `src/lib/automation.test.ts`, `src/lib/validation.test.ts`

**Interfaces:**
- Produces (consumed by Task 2 + Phase 4):
  - `automation.ts`: `export type Action = { type: "sendText"; body: string } | { type: "startChatbot"; chatbotId: string }`
  - `validation.ts`: `AutomationRuleSchema.action` accepts either variant; `startChatbot` requires a non-empty `chatbotId`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/validation.test.ts`, extend the import from `./validation` to add `AutomationRuleSchema`, and append:

```ts
describe("AutomationRuleSchema action", () => {
  const base = { name: "Bot on hi", enabled: true, trigger: { type: "keyword", keywords: ["hi"] } };
  it("accepts a sendText action", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "sendText", body: "Hello" } }).success).toBe(true);
  });
  it("accepts a startChatbot action with a chatbotId", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "startChatbot", chatbotId: "cb_123" } }).success).toBe(true);
  });
  it("rejects a startChatbot action with no chatbotId", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "startChatbot", chatbotId: "" } }).success).toBe(false);
  });
  it("rejects an unknown action type", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "explode" } }).success).toBe(false);
  });
});
```

In `src/lib/automation.test.ts`, append:

```ts
describe("evaluateRules with startChatbot", () => {
  const botRule: AutomationRuleDef = { enabled: true, trigger: { type: "keyword", keywords: ["order"] }, action: { type: "startChatbot", chatbotId: "cb_9" } };
  it("returns a startChatbot action for a matching rule", () => {
    const actions = evaluateRules([botRule], { text: "I want to order", now: new Date("2026-01-05T09:00:00Z") });
    expect(actions).toEqual([{ type: "startChatbot", chatbotId: "cb_9" }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation.test.ts src/lib/automation.test.ts`
Expected: FAIL — `AutomationRuleSchema` not exported into the test / `startChatbot` rejected by the current single-object action schema.

- [ ] **Step 3: Widen the engine `Action` type**

In `src/lib/automation.ts`, replace the `Action` line (currently `export type Action = { type: "sendText"; body: string };`):

```ts
export type Action =
  | { type: "sendText"; body: string }
  | { type: "startChatbot"; chatbotId: string }; // Phase 3: authored + persisted; executed in Phase 4
```

- [ ] **Step 4: Widen the Zod schema**

In `src/lib/validation.ts`, replace the `action:` line inside `AutomationRuleSchema` (currently `action: z.object({ type: z.literal("sendText"), body: ... }),`):

```ts
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("sendText"), body: z.string().trim().min(1, "Reply body is required").max(1000) }),
    z.object({ type: z.literal("startChatbot"), chatbotId: z.string().trim().min(1, "Pick a chatbot") }),
  ]),
```

- [ ] **Step 5: Narrow the inbound runner to `sendText`**

In `src/lib/automationRun.ts`, update the import and the `.find` so the widened union still type-checks and `startChatbot` is skipped this phase. Replace the import line:

```ts
import { evaluateRules, type AutomationRuleDef, type Action } from "./automation";
```

Replace the `const send = …find(…)` line (line ~25):

```ts
  // Phase 3: only sendText is executed here. startChatbot is authored/persisted
  // now; creating a ChatbotSession from it is Phase 4.
  const send = evaluateRules(rules, { text, now: new Date() })
    .find((a): a is Extract<Action, { type: "sendText" }> => a.type === "sendText");
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation.test.ts src/lib/automation.test.ts`
Expected: PASS (new suites green; existing suites still green).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the `Extract<…>` guard keeps `send.body` valid).

- [ ] **Step 8: Commit**

```bash
git add src/lib/automation.ts src/lib/automation.test.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/automationRun.ts
git commit -m "Add startChatbot automation action (schema + engine + runner)"
```

---

## Task 2: Automation-rules UI — "Start a chatbot" action

**Files:**
- Modify: `src/components/AutomationRulesManager.tsx`

**Interfaces:**
- Consumes: `GET /api/chatbots` (Phase 1); the widened `AutomationRuleSchema` (Task 1).
- Produces: users can pick an action type (Auto-reply text / Start a chatbot) and, for the latter, a PUBLISHED bot from a dropdown; rules render + edit for both action types.

- [ ] **Step 1: Widen the local `Action` type + add chatbot state**

In `src/components/AutomationRulesManager.tsx`, replace the local `Action` type (line 9):

```tsx
type Action = { type: "sendText"; body: string } | { type: "startChatbot"; chatbotId: string };
interface BotOption { id: string; name: string; status: string }
```

Add these state hooks next to the others (after the `body` state, ~line 29):

```tsx
  const [actionType, setActionType] = useState<"sendText" | "startChatbot">("sendText");
  const [chatbotId, setChatbotId] = useState("");
  const [bots, setBots] = useState<BotOption[]>([]);
```

- [ ] **Step 2: Load PUBLISHED bots + build/reset/edit for both action types**

Extend `load` (fetch bots too) — replace the `load` callback:

```tsx
  const load = useCallback(async () => {
    const [rr, br] = await Promise.all([apiFetch("/api/automation-rules"), apiFetch("/api/chatbots")]);
    if (rr.ok) setRules((await rr.json()).rules);
    if (br.ok) setBots(((await br.json()).chatbots as BotOption[]).filter((b) => b.status === "PUBLISHED"));
  }, []);
```

In `resetForm`, append `setActionType("sendText"); setChatbotId("");` before the closing brace.

Add a `buildAction` helper (next to `buildTrigger`):

```tsx
  function buildAction(): Action {
    return actionType === "startChatbot" ? { type: "startChatbot", chatbotId } : { type: "sendText", body };
  }
```

In `save`, replace the `action: { type: "sendText", body }` in the payload with `action: buildAction()`.

Replace `edit` so it restores whichever action a rule uses:

```tsx
  function edit(rule: Rule) {
    setEditingId(rule.id); setName(rule.name); setKind(rule.trigger.type); setMsg(null);
    setActionType(rule.action.type);
    if (rule.action.type === "sendText") { setBody(rule.action.body); setChatbotId(""); }
    else { setChatbotId(rule.action.chatbotId); setBody(""); }
    if (rule.trigger.type === "keyword") setKeywords(rule.trigger.keywords.join(", "));
    else { setDays(rule.trigger.days); setStart(rule.trigger.start); setEnd(rule.trigger.end); setTzOffset(rule.trigger.tzOffset ?? 0); }
  }
```

- [ ] **Step 3: Replace the single "Auto-reply text" field with an action picker**

Replace the action `<div className="field">` block that holds the `rules-body` textarea (lines ~123-126) with:

```tsx
        <div className="field">
          <label className="label" htmlFor="rules-action">Action</label>
          <select id="rules-action" className="input" value={actionType} onChange={(e) => setActionType(e.target.value as "sendText" | "startChatbot")}>
            <option value="sendText">Send auto-reply text</option>
            <option value="startChatbot">Start a chatbot</option>
          </select>
        </div>
        {actionType === "sendText" ? (
          <div className="field">
            <label className="label" htmlFor="rules-body">Auto-reply text</label>
            <textarea id="rules-body" className="input" value={body} onChange={(e) => setBody(e.target.value)} required rows={3} />
          </div>
        ) : (
          <div className="field">
            <label className="label" htmlFor="rules-chatbot">Chatbot to start</label>
            <select id="rules-chatbot" className="input" value={chatbotId} onChange={(e) => setChatbotId(e.target.value)} required>
              <option value="">Select a published chatbot…</option>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {bots.length === 0 && <p className="note" style={{ marginTop: 6 }}>No published chatbots yet — build one on the Chatbot page and set it to Published.</p>}
          </div>
        )}
```

- [ ] **Step 4: Show the action in the rules table**

Add an `actionSummary` helper next to `triggerSummary`:

```tsx
function actionSummary(a: Action, bots: { id: string; name: string }[]): string {
  if (a.type === "sendText") return "auto-reply";
  const bot = bots.find((b) => b.id === a.chatbotId);
  return `start bot: ${bot?.name ?? a.chatbotId}`;
}
```

Add a header cell and body cell to the rules table. Change the `<thead>` row to:

```tsx
          <thead><tr><th>Name</th><th>Trigger</th><th>Action</th><th></th></tr></thead>
```

Add this `<td>` immediately after the trigger `<td>` in each row:

```tsx
                <td className="muted" style={{ fontSize: 12 }}>{actionSummary(rule.action, bots)}</td>
```

Update the empty-state `colSpan` from `3` to `4`.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && SKIP_ENV_VALIDATION=1 npm run build`
Expected: both green.

- [ ] **Step 6: Full unit gate**

Run: `npm run typecheck && npm test && SKIP_ENV_VALIDATION=1 npm run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/AutomationRulesManager.tsx
git commit -m "Add 'Start a chatbot' action to the automation-rules UI"
```

---

## Self-Review

**Spec coverage (spec §5 "Automation integration"):**
- `Action` union gains `startChatbot` → Task 1 (`automation.ts`) ✓
- `AutomationRuleSchema` extended → Task 1 (`validation.ts`) ✓
- `evaluateRules` returns `startChatbot` unchanged → already true; asserted by Task 1 test ✓
- Automation UI gains a "Start a chatbot" option with a dropdown of PUBLISHED bots → Task 2 ✓
- `automationRun.ts` handling of the new type → **deferred to Phase 4** (spec §4/§9); Task 1 Step 5 narrows to `sendText` so the runner ignores `startChatbot` safely and keeps compiling. Documented in Global Constraints.

**Placeholder scan:** none — every step shows the exact code and command.

**Type consistency:** `Action` (`sendText`/`startChatbot`, field `chatbotId`) is identical in `automation.ts` (Task 1), `validation.ts` schema (Task 1), and the component's local type (Task 2). The `Extract<Action, { type: "sendText" }>` guard in `automationRun.ts` matches the union member exactly. `BotOption`/`bots` filter on `status === "PUBLISHED"` consistently.

**Deferred to Phase 4:** `ChatbotSession` model, `lib/chatbot.ts` engine, and executing a `startChatbot` action (creating a session + running opening nodes) inside `automationRun.ts` / the inbound webhook.
