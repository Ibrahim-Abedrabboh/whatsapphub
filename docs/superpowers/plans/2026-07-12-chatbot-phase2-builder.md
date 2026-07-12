# Chatbot Builder — Phase 2 (Builder UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A no-code visual builder on `/chatbot` where a user composes an ordered list of typed step blocks (drag-to-reorder + nested branch cases), which compiles to a `ChatbotFlow` and saves via the Phase-1 `/api/chatbots` API.

**Architecture:** The builder edits an ordered array of `Block`s. A **pure, unit-tested** module (`lib/chatbotBuilder.ts`) compiles blocks → `ChatbotFlow` (linear `nextId` chaining for non-branch blocks; explicit per-case targets for `branch`) and decompiles a saved flow → blocks for editing. The `ChatbotBuilder` client component is the editor UI (native HTML5 drag-and-drop, no new deps); `ChatbotsManager` toggles between the saved-bots list and the builder.

**Tech Stack:** Next.js 15 App Router (client components), React state, Zod (`ChatbotFlowSchema` reused for client-side pre-save validation), Vitest, TypeScript strict.

## Global Constraints

- TypeScript `strict` **and** `noUncheckedIndexedAccess` — array indexing yields `T | undefined`; guard it.
- Imports use `@/...` (no worker files touched this phase).
- Reuse the Phase-1 `ChatbotFlowSchema` / `CreateChatbotSchema` from `@/lib/validation` — do NOT duplicate node shapes.
- Reuse the existing API: `GET /api/chatbots`, `POST /api/chatbots`, `GET|PATCH|DELETE /api/chatbots/[id]`. No API changes this phase.
- Styling: existing tokens only — `.card .btn .btn--ghost .field .label .input .table .badge .note .muted`. No new inline hex.
- Node/block ids: `crypto.randomUUID()` (available in browser + Node/Vitest).
- Definition of Done for every task: `npm run typecheck` · `npm test` · `SKIP_ENV_VALIDATION=1 npm run build` all green.
- **Scoped deviation from spec §6 (documented):** the `ChatbotHowItWorks` marketing slider is NOT embedded on `/chatbot`. It uses `dk-steps` dark-theme classes + `data-lang` bilingual spans built for the public landing; in the authenticated app shell it would render both languages and clash with the app theme. The builder is the Phase-2 deliverable; the slider stays on the public `/chatbots` page.

---

## File Structure

- `src/lib/chatbotBuilder.ts` — **create**: `Block` type, `BLOCK_META`, `newBlock`, `blocksToFlow`, `flowToBlocks`. Pure, no React/DOM.
- `src/lib/chatbotBuilder.test.ts` — **create**: unit tests for the pure module.
- `src/components/ChatbotBuilder.tsx` — **create**: the editor client component.
- `src/components/ChatbotsManager.tsx` — **modify**: add list↔builder toggle (New / Edit → builder).
- `src/app/chatbot/page.tsx` — **modify**: copy tweak only (mentions building a bot).
- `e2e/pages/chatbot.spec.ts` — **create**: Playwright smoke (runs against a live app; NOT part of the unit gate).

---

## Task 1: Pure builder module (`lib/chatbotBuilder.ts`)

**Files:**
- Create: `src/lib/chatbotBuilder.ts`
- Test: `src/lib/chatbotBuilder.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2–3):
  - `type BlockType = "message" | "question" | "branch" | "ai" | "aiAgent" | "end"`
  - `interface BranchCase { keywords: string; nextId: string }` — `keywords` is a comma-separated string in the editor.
  - `interface Block { id: string; type: BlockType; text?: string; saveAs?: string; goal?: string; maxTurns?: number; cases?: BranchCase[]; defaultNextId?: string }`
  - `const BLOCK_META: Record<BlockType, { label: string; wait: boolean }>`
  - `function newBlock(type: BlockType): Block`
  - `function blocksToFlow(blocks: Block[]): ChatbotFlow` — throws `Error("A chatbot needs at least one step")` on empty.
  - `function flowToBlocks(flow: ChatbotFlow): Block[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chatbotBuilder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { newBlock, blocksToFlow, flowToBlocks, BLOCK_META, type Block } from "./chatbotBuilder";
import { ChatbotFlowSchema } from "./validation";

// helper: a fixed-id block so assertions are deterministic
const b = (over: Partial<Block> & { id: string; type: Block["type"] }): Block => ({ ...over });

describe("newBlock", () => {
  it("makes a message block with a unique id and empty text", () => {
    const a = newBlock("message");
    const c = newBlock("message");
    expect(a.type).toBe("message");
    expect(a.text).toBe("");
    expect(a.id).not.toBe(c.id);
  });
  it("seeds a question with a default saveAs and a branch with one case", () => {
    expect(newBlock("question").saveAs).toBe("answer");
    expect(newBlock("branch").cases).toHaveLength(1);
  });
});

describe("BLOCK_META", () => {
  it("marks question/branch/aiAgent as wait-nodes and message/ai/end as non-wait", () => {
    expect(BLOCK_META.question.wait).toBe(true);
    expect(BLOCK_META.branch.wait).toBe(true);
    expect(BLOCK_META.aiAgent.wait).toBe(true);
    expect(BLOCK_META.message.wait).toBe(false);
    expect(BLOCK_META.ai.wait).toBe(false);
    expect(BLOCK_META.end.wait).toBe(false);
  });
});

describe("blocksToFlow", () => {
  it("throws on an empty block list", () => {
    expect(() => blocksToFlow([])).toThrow();
  });
  it("chains a linear flow and sets startId to the first block", () => {
    const blocks: Block[] = [
      b({ id: "m", type: "message", text: "Hi {{name}}" }),
      b({ id: "q", type: "question", text: "Size?", saveAs: "size" }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(flow.startId).toBe("m");
    expect(flow.nodes.m).toEqual({ id: "m", type: "message", text: "Hi {{name}}", nextId: "q" });
    expect(flow.nodes.q).toEqual({ id: "q", type: "question", text: "Size?", saveAs: "size", nextId: "e" });
    expect(flow.nodes.e).toEqual({ id: "e", type: "end" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
  it("compiles a branch: splits keywords, keeps explicit targets, no linear nextId on the branch", () => {
    const blocks: Block[] = [
      b({ id: "br", type: "branch", cases: [{ keywords: "yes, y", nextId: "e" }], defaultNextId: "e" }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(flow.nodes.br).toEqual({ id: "br", type: "branch", cases: [{ keywords: ["yes", "y"], nextId: "e" }], defaultNextId: "e" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
  it("omits maxTurns/goal when blank on an aiAgent and passes schema", () => {
    const flow = blocksToFlow([b({ id: "ag", type: "aiAgent" }), b({ id: "e", type: "end" })]);
    expect(flow.nodes.ag).toEqual({ id: "ag", type: "aiAgent", nextId: "e" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
});

describe("flowToBlocks round-trip", () => {
  it("round-trips a linear flow exactly", () => {
    const blocks: Block[] = [
      b({ id: "m", type: "message", text: "Hi" }),
      b({ id: "q", type: "question", text: "Size?", saveAs: "size" }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(blocksToFlow(flowToBlocks(flow))).toEqual(flow);
  });
  it("recovers every node id from a branch flow", () => {
    const flow = blocksToFlow([
      b({ id: "br", type: "branch", cases: [{ keywords: "hi", nextId: "e" }], defaultNextId: "e" }),
      b({ id: "e", type: "end" }),
    ]);
    const ids = flowToBlocks(flow).map((x) => x.id).sort();
    expect(ids).toEqual(["br", "e"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/chatbotBuilder.test.ts`
Expected: FAIL — module `./chatbotBuilder` not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/chatbotBuilder.ts`:

```ts
import type { ChatbotFlow } from "@/lib/validation";

// The builder edits an ordered list of these; blocksToFlow compiles them to a
// ChatbotFlow state machine. Non-branch blocks chain linearly to the next block;
// a branch routes only via its explicit per-case targets + default target.
export type BlockType = "message" | "question" | "branch" | "ai" | "aiAgent" | "end";

export interface BranchCase {
  keywords: string; // comma-separated in the editor; split on compile
  nextId: string; // id of a target block
}

export interface Block {
  id: string;
  type: BlockType;
  text?: string; // message | question
  saveAs?: string; // question
  goal?: string; // aiAgent
  maxTurns?: number; // aiAgent
  cases?: BranchCase[]; // branch
  defaultNextId?: string; // branch
}

export const BLOCK_META: Record<BlockType, { label: string; wait: boolean }> = {
  message: { label: "Send message", wait: false },
  question: { label: "Ask & wait", wait: true },
  branch: { label: "Branch on reply", wait: true },
  ai: { label: "AI answer", wait: false },
  aiAgent: { label: "AI Agent", wait: true },
  end: { label: "End", wait: false },
};

/** A fresh block of the given type with sensible defaults. */
export function newBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case "message": return { id, type, text: "" };
    case "question": return { id, type, text: "", saveAs: "answer" };
    case "branch": return { id, type, cases: [{ keywords: "", nextId: "" }], defaultNextId: "" };
    case "aiAgent": return { id, type };
    default: return { id, type }; // ai | end
  }
}

const splitKeywords = (s: string): string[] => s.split(",").map((k) => k.trim()).filter(Boolean);

/** Compile ordered editor blocks into a validated-shape ChatbotFlow. Non-branch
 *  blocks point at the next block in order; branch blocks route via explicit
 *  targets. Throws on an empty list. The caller still runs ChatbotFlowSchema. */
export function blocksToFlow(blocks: Block[]): ChatbotFlow {
  const first = blocks[0];
  if (!first) throw new Error("A chatbot needs at least one step");

  const nodes: ChatbotFlow["nodes"] = {};
  blocks.forEach((blk, i) => {
    const linearNext = blocks[i + 1]?.id; // undefined on the last block
    switch (blk.type) {
      case "message":
        nodes[blk.id] = { id: blk.id, type: "message", text: blk.text ?? "", ...(linearNext ? { nextId: linearNext } : {}) };
        break;
      case "question":
        nodes[blk.id] = { id: blk.id, type: "question", text: blk.text ?? "", saveAs: blk.saveAs ?? "", ...(linearNext ? { nextId: linearNext } : {}) };
        break;
      case "ai":
        nodes[blk.id] = { id: blk.id, type: "ai", ...(linearNext ? { nextId: linearNext } : {}) };
        break;
      case "aiAgent":
        nodes[blk.id] = {
          id: blk.id, type: "aiAgent",
          ...(blk.goal?.trim() ? { goal: blk.goal.trim() } : {}),
          ...(typeof blk.maxTurns === "number" ? { maxTurns: blk.maxTurns } : {}),
          ...(linearNext ? { nextId: linearNext } : {}),
        };
        break;
      case "branch":
        nodes[blk.id] = {
          id: blk.id, type: "branch",
          cases: (blk.cases ?? []).map((c) => ({ keywords: splitKeywords(c.keywords), nextId: c.nextId })),
          ...(blk.defaultNextId ? { defaultNextId: blk.defaultNextId } : {}),
        };
        break;
      case "end":
        nodes[blk.id] = { id: blk.id, type: "end" };
        break;
    }
  });

  return { startId: first.id, nodes };
}

/** Decompile a saved flow into an ordered block list for editing. Walks from
 *  startId following linear/branch targets, then appends any unreferenced nodes
 *  so nothing is lost. */
export function flowToBlocks(flow: ChatbotFlow): Block[] {
  const order: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = flow.startId;
  while (cursor && flow.nodes[cursor] && !seen.has(cursor)) {
    seen.add(cursor); order.push(cursor);
    const node = flow.nodes[cursor];
    cursor = node.type === "branch" ? (node.defaultNextId ?? node.cases[0]?.nextId) : ("nextId" in node ? node.nextId : undefined);
  }
  for (const id of Object.keys(flow.nodes)) if (!seen.has(id)) order.push(id);

  return order.map((id) => {
    const node = flow.nodes[id]!;
    switch (node.type) {
      case "message": return { id, type: "message", text: node.text };
      case "question": return { id, type: "question", text: node.text, saveAs: node.saveAs };
      case "ai": return { id, type: "ai" };
      case "aiAgent": return { id, type: "aiAgent", goal: node.goal, maxTurns: node.maxTurns };
      case "branch": return { id, type: "branch", cases: node.cases.map((c) => ({ keywords: c.keywords.join(", "), nextId: c.nextId })), defaultNextId: node.defaultNextId ?? "" };
      case "end": return { id, type: "end" };
    }
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/chatbotBuilder.test.ts`
Expected: PASS (all suites green).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chatbotBuilder.ts src/lib/chatbotBuilder.test.ts
git commit -m "Add pure chatbot builder compile/decompile helpers"
```

---

## Task 2: `ChatbotBuilder` editor component

**Files:**
- Create: `src/components/ChatbotBuilder.tsx`

**Interfaces:**
- Consumes: `Block`, `BlockType`, `BLOCK_META`, `newBlock`, `blocksToFlow`, `flowToBlocks` (Task 1); `ChatbotFlowSchema` (`@/lib/validation`); `apiFetch` (`@/lib/apiFetch`).
- Produces (consumed by Task 3):
  - `interface ChatbotBuilderProps { initial: { id: string; name: string; flow: ChatbotFlow } | null; onDone: () => void; onCancel: () => void }`
  - `export default function ChatbotBuilder(props: ChatbotBuilderProps)`

- [ ] **Step 1: Implement the component**

Create `src/components/ChatbotBuilder.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ChatbotFlow } from "@/lib/validation";
import { ChatbotFlowSchema } from "@/lib/validation";
import { apiFetch } from "@/lib/apiFetch";
import { type Block, type BlockType, BLOCK_META, newBlock, blocksToFlow, flowToBlocks } from "@/lib/chatbotBuilder";

export interface ChatbotBuilderProps {
  initial: { id: string; name: string; flow: ChatbotFlow } | null;
  onDone: () => void;
  onCancel: () => void;
}

const ADDABLE: BlockType[] = ["message", "question", "branch", "ai", "aiAgent", "end"];

export default function ChatbotBuilder({ initial, onDone, onCancel }: ChatbotBuilderProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [blocks, setBlocks] = useState<Block[]>(initial ? flowToBlocks(initial.flow) : [newBlock("message")]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const patch = (id: string, over: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...over } : b)));
  const add = (type: BlockType) => setBlocks((bs) => [...bs, newBlock(type)]);
  const remove = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));

  function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === dragId);
      const to = bs.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return bs;
      const copy = [...bs];
      const [moved] = copy.splice(from, 1);
      if (moved) copy.splice(to, 0, moved);
      return copy;
    });
  }

  // Label used in branch-target dropdowns, e.g. "3 · Ask & wait".
  const optionLabel = (b: Block, i: number) => `${i + 1} · ${BLOCK_META[b.type].label}`;

  async function save() {
    setMsg(null);
    if (!name.trim()) { setMsg("Give your chatbot a name."); return; }
    let flow: ChatbotFlow;
    try { flow = blocksToFlow(blocks); } catch (e) { setMsg((e as Error).message); return; }
    const parsed = ChatbotFlowSchema.safeParse(flow);
    if (!parsed.success) { setMsg(`Fix the flow: ${parsed.error.issues[0]?.message ?? "invalid"}`); return; }

    setBusy(true);
    const payload = { name: name.trim(), status, flow };
    const r = initial
      ? await apiFetch(`/api/chatbots/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await apiFetch("/api/chatbots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) onDone();
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  return (
    <div className="card" data-test-id="chatbot-builder">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div className="field" style={{ flex: "1 1 220px", margin: 0 }}>
          <label className="label" htmlFor="bot-name">Chatbot name</label>
          <input id="bot-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} data-test-id="bot-name" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="bot-status">Status</label>
          <select id="bot-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {blocks.map((b, i) => (
          <li
            key={b.id}
            draggable
            onDragStart={() => setDragId(b.id)}
            onDragOver={(e) => { e.preventDefault(); reorder(b.id); }}
            onDragEnd={() => setDragId(null)}
            className="card"
            style={{ margin: 0, opacity: dragId === b.id ? 0.5 : 1, cursor: "grab" }}
            data-test-id="chatbot-block"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="badge badge--DRAFT" aria-hidden>⠿ {i + 1}</span>
              <strong>{BLOCK_META[b.type].label}</strong>
              <button type="button" className="btn btn--ghost" style={{ minHeight: 28, padding: "2px 8px", fontSize: 12 }} onClick={() => remove(b.id)} aria-label={`Remove step ${i + 1}`}>Remove</button>
            </div>

            {(b.type === "message" || b.type === "question") && (
              <div className="field">
                <label className="label" htmlFor={`text-${b.id}`}>Text — use {"{{name}}"} / {"{{phone}}"}</label>
                <textarea id={`text-${b.id}`} className="input" rows={2} value={b.text ?? ""} onChange={(e) => patch(b.id, { text: e.target.value })} />
              </div>
            )}
            {b.type === "question" && (
              <div className="field">
                <label className="label" htmlFor={`saveas-${b.id}`}>Save answer as</label>
                <input id={`saveas-${b.id}`} className="input" value={b.saveAs ?? ""} onChange={(e) => patch(b.id, { saveAs: e.target.value })} placeholder="answer" />
              </div>
            )}
            {b.type === "aiAgent" && (
              <>
                <div className="field">
                  <label className="label" htmlFor={`goal-${b.id}`}>Agent goal (optional)</label>
                  <input id={`goal-${b.id}`} className="input" value={b.goal ?? ""} onChange={(e) => patch(b.id, { goal: e.target.value })} placeholder="Close the sale" />
                </div>
                <div className="field">
                  <label className="label" htmlFor={`turns-${b.id}`}>Max turns (optional)</label>
                  <input id={`turns-${b.id}`} className="input" type="number" min={1} max={20} value={b.maxTurns ?? ""} onChange={(e) => patch(b.id, { maxTurns: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </>
            )}
            {b.type === "ai" && <p className="note">Answers the customer's last message from your uploaded knowledge, then continues.</p>}
            {b.type === "end" && <p className="note">Ends the conversation.</p>}

            {b.type === "branch" && (
              <div>
                {(b.cases ?? []).map((c, ci) => (
                  <div key={ci} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    <input
                      className="input" style={{ flex: "1 1 160px" }} placeholder="keywords, comma-separated"
                      value={c.keywords} aria-label={`Case ${ci + 1} keywords`}
                      onChange={(e) => patch(b.id, { cases: (b.cases ?? []).map((x, k) => (k === ci ? { ...x, keywords: e.target.value } : x)) })}
                    />
                    <select
                      className="input" style={{ flex: "1 1 140px" }} value={c.nextId} aria-label={`Case ${ci + 1} target`}
                      onChange={(e) => patch(b.id, { cases: (b.cases ?? []).map((x, k) => (k === ci ? { ...x, nextId: e.target.value } : x)) })}
                    >
                      <option value="">→ go to…</option>
                      {blocks.filter((x) => x.id !== b.id).map((x) => <option key={x.id} value={x.id}>{optionLabel(x, blocks.indexOf(x))}</option>)}
                    </select>
                    <button type="button" className="btn btn--ghost" style={{ minHeight: 30 }} onClick={() => patch(b.id, { cases: (b.cases ?? []).filter((_, k) => k !== ci) })} aria-label={`Remove case ${ci + 1}`}>×</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                  <button type="button" className="btn btn--ghost" style={{ minHeight: 30, fontSize: 12 }} onClick={() => patch(b.id, { cases: [...(b.cases ?? []), { keywords: "", nextId: "" }] })}>+ Add case</button>
                  <label className="label" htmlFor={`default-${b.id}`} style={{ margin: 0 }}>Otherwise</label>
                  <select id={`default-${b.id}`} className="input" style={{ flex: "1 1 140px" }} value={b.defaultNextId ?? ""} onChange={(e) => patch(b.id, { defaultNextId: e.target.value })}>
                    <option value="">→ go to…</option>
                    {blocks.filter((x) => x.id !== b.id).map((x) => <option key={x.id} value={x.id}>{optionLabel(x, blocks.indexOf(x))}</option>)}
                  </select>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {ADDABLE.map((t) => (
          <button key={t} type="button" className="btn btn--ghost" style={{ minHeight: 32, fontSize: 12 }} onClick={() => add(t)}>+ {BLOCK_META[t].label}</button>
        ))}
      </div>

      {msg && <p className="note" data-test-id="builder-msg" style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void save()} data-test-id="builder-save">{busy ? "Saving…" : initial ? "Save changes" : "Create chatbot"}</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `noUncheckedIndexedAccess` flags `blocks.indexOf(x)` label calls, they are safe — `x` comes from `blocks`.)

- [ ] **Step 3: Build**

Run: `SKIP_ENV_VALIDATION=1 npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatbotBuilder.tsx
git commit -m "Add ChatbotBuilder drag-and-drop editor component"
```

---

## Task 3: Wire the builder into `/chatbot`

**Files:**
- Modify: `src/components/ChatbotsManager.tsx`
- Modify: `src/app/chatbot/page.tsx`

**Interfaces:**
- Consumes: `ChatbotBuilder` + `ChatbotBuilderProps` (Task 2); `ChatbotFlow` (`@/lib/validation`); `apiFetch`.
- Produces: the `/chatbot` page now lists bots with **New / Edit** entering the builder and returning to the list on save/cancel.

- [ ] **Step 1: Rewrite `ChatbotsManager` to toggle list ↔ builder**

Replace the entire body of `src/components/ChatbotsManager.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatbotFlow } from "@/lib/validation";
import { apiFetch } from "@/lib/apiFetch";
import ChatbotBuilder from "@/components/ChatbotBuilder";

interface Chatbot { id: string; name: string; status: string; updatedAt: string }

const badgeClass = (status: string) => (status === "PUBLISHED" ? "badge--COMPLETED" : "badge--DRAFT");

export default function ChatbotsManager() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // null = list view; { initial } = builder view (initial null = new bot)
  const [editing, setEditing] = useState<{ initial: { id: string; name: string; flow: ChatbotFlow } | null } | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/chatbots");
    if (r.ok) setChatbots((await r.json()).chatbots);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function openEdit(id: string) {
    setMsg(null);
    const r = await apiFetch(`/api/chatbots/${id}`);
    if (!r.ok) { setMsg("Could not load that chatbot."); return; }
    const { chatbot } = await r.json();
    setEditing({ initial: { id: chatbot.id, name: chatbot.name, flow: chatbot.flow as ChatbotFlow } });
  }

  async function remove(id: string, name: string) {
    setBusy(id); setMsg(null);
    const r = await apiFetch(`/api/chatbots/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) { setMsg(`Deleted "${name}".`); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  if (editing) {
    return (
      <ChatbotBuilder
        initial={editing.initial}
        onDone={() => { setEditing(null); void load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button type="button" className="btn" onClick={() => setEditing({ initial: null })} data-test-id="new-chatbot">+ New chatbot</button>
      </div>

      {msg && <p className="note" data-test-id="chatbots-msg" style={{ marginBottom: 10 }}>{msg}</p>}

      <div className="card">
        <table className="table" data-test-id="chatbots-table">
          <thead><tr><th>Name</th><th>Status</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {chatbots.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td><span className={`badge ${badgeClass(b.status)}`}>{b.status}</span></td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(b.updatedAt).toLocaleString()}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }} onClick={() => void openEdit(b.id)}>Edit</button>
                  <button type="button" className="btn btn--ghost" style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }} disabled={busy !== null} onClick={() => void remove(b.id, b.name)}>{busy === b.id ? "…" : "Delete"}</button>
                </td>
              </tr>
            ))}
            {!loading && chatbots.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No chatbots yet — click “New chatbot” to build one.</td></tr>
            )}
            {loading && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tweak the page copy**

In `src/app/chatbot/page.tsx`, replace the `<p className="note">…</p>` line with:

```tsx
        <p className="note" style={{ marginBottom: 16 }}>
          Build a no-code chatbot from ordered steps — send a message, ask a question, branch on the reply, or
          hand off to AI. Save it, then (next phase) assign it to an automation trigger to run on your channels.
        </p>
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && SKIP_ENV_VALIDATION=1 npm run build`
Expected: both green; `/chatbot` still listed.

- [ ] **Step 4: Full unit gate**

Run: `npm run typecheck && npm test && SKIP_ENV_VALIDATION=1 npm run build`
Expected: all green (chatbotBuilder tests included).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatbotsManager.tsx src/app/chatbot/page.tsx
git commit -m "Wire ChatbotBuilder into /chatbot (New/Edit)"
```

---

## Task 4: e2e smoke (non-blocking — runs against a live app)

**Files:**
- Create: `e2e/pages/chatbot.spec.ts`

> **Note:** Playwright e2e needs the app running with a database + a logged-in session (`npm run test:e2e`). It is **not** part of the unit DoD gate (`typecheck`/`test`/`build`) and cannot run in an environment without a DB. Follow the existing `e2e/pages/*.spec.ts` auth-fixture pattern.

- [ ] **Step 1: Write the spec (mirror an existing authenticated page spec)**

Create `e2e/pages/chatbot.spec.ts` following the auth setup used by the neighboring specs in `e2e/pages/`:

```ts
import { test, expect } from "@playwright/test";

// Assumes the shared authenticated-session fixture used by sibling specs.
test("build and save a chatbot", async ({ page }) => {
  await page.goto("/chatbot");
  await expect(page.getByRole("heading", { name: "Chatbot" })).toBeVisible();

  await page.getByTestId("new-chatbot").click();
  await page.getByTestId("bot-name").fill("E2E Bot");
  // default first block is a "Send message" — fill its text
  await page.getByTestId("chatbot-block").first().getByRole("textbox").first().fill("Hello from e2e");
  await page.getByTestId("builder-save").click();

  // back on the list, the new bot appears
  await expect(page.getByTestId("chatbots-table")).toContainText("E2E Bot");
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/pages/chatbot.spec.ts
git commit -m "Add /chatbot builder e2e smoke (runs against live app)"
```

---

## Self-Review

**Spec coverage (spec §6 "Builder page", Phase 2 row of §9):**
- Saved-bots list + "New chatbot" → Task 3 ✓ (list already existed from the Nav step; New/Edit added)
- `ChatbotBuilder` vertical typed step blocks (message/question/branch/ai/aiAgent/end) → Task 2 ✓
- Native HTML5 `draggable` reorder → Task 2 (`onDragStart/onDragOver/onDragEnd` + `reorder`) ✓
- "add step" menu + per-block config + nested branch case rows → Task 2 ✓
- Save compiles blocks → `ChatbotFlow`, client validates then POST/PATCH → Task 1 (`blocksToFlow`) + Task 2 (`ChatbotFlowSchema.safeParse` then `apiFetch`) ✓
- `ChatbotHowItWorks` slider on `/chatbot` → **intentionally deviated** (documented in Global Constraints: dk-theme/bilingual, kept on public `/chatbots`).
- e2e loads + build + save → Task 4 ✓ (non-blocking)

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `Block`, `BlockType`, `BranchCase`, `BLOCK_META`, `newBlock`, `blocksToFlow`, `flowToBlocks` names + signatures match across Tasks 1→3. `ChatbotBuilderProps` (`initial`/`onDone`/`onCancel`) is defined in Task 2 and consumed identically in Task 3. Node shapes come from Phase-1 `ChatbotFlow`/`ChatbotFlowSchema` (single source of truth).

**Deferred to later phases:** `startChatbot` automation action + UI dropdown (Phase 3); `ChatbotSession` model + `lib/chatbot.ts` runtime + webhook orchestration (Phase 4).
```
