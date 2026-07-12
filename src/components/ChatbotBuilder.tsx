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
            {b.type === "ai" && <p className="note">Answers the customer&apos;s last message from your uploaded knowledge, then continues.</p>}
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
