"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

type Trigger =
  | { type: "keyword"; keywords: string[] }
  | { type: "away"; days: number[]; start: string; end: string; tzOffset?: number };
type Action = { type: "sendText"; body: string } | { type: "startChatbot"; chatbotId: string };
interface BotOption { id: string; name: string; status: string }
interface Rule { id: string; name: string; enabled: boolean; trigger: Trigger; action: Action }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function triggerSummary(t: Trigger): string {
  if (t.type === "keyword") return `keyword: ${t.keywords.join(", ")}`;
  return `away · ${t.days.map((d) => DAYS[d]).join("/")} ${t.start}–${t.end}`;
}

function actionSummary(a: Action, bots: { id: string; name: string }[]): string {
  if (a.type === "sendText") return "auto-reply";
  const bot = bots.find((b) => b.id === a.chatbotId);
  return `start bot: ${bot?.name ?? a.chatbotId}`;
}

export default function AutomationRulesManager() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"keyword" | "away">("keyword");
  const [keywords, setKeywords] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [tzOffset, setTzOffset] = useState(180);
  const [body, setBody] = useState("");
  const [actionType, setActionType] = useState<"sendText" | "startChatbot">("sendText");
  const [chatbotId, setChatbotId] = useState("");
  const [bots, setBots] = useState<BotOption[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [rr, br] = await Promise.all([apiFetch("/api/automation-rules"), apiFetch("/api/chatbots")]);
    if (rr.ok) setRules((await rr.json()).rules);
    if (br.ok) setBots(((await br.json()).chatbots as BotOption[]).filter((b) => b.status === "PUBLISHED"));
  }, []);
  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setEditingId(null); setName(""); setKind("keyword"); setKeywords("");
    setDays([1, 2, 3, 4, 5]); setStart("09:00"); setEnd("17:00"); setTzOffset(180); setBody("");
    setActionType("sendText"); setChatbotId("");
  }

  function buildTrigger(): Trigger {
    return kind === "keyword"
      ? { type: "keyword", keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) }
      : { type: "away", days, start, end, tzOffset };
  }

  function buildAction(): Action {
    return actionType === "startChatbot" ? { type: "startChatbot", chatbotId } : { type: "sendText", body };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = { name, enabled: true, trigger: buildTrigger(), action: buildAction() };
    const r = editingId
      ? await apiFetch(`/api/automation-rules/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, enabled: rules.find((x) => x.id === editingId)?.enabled ?? true }) })
      : await apiFetch("/api/automation-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg(editingId ? "Updated." : "Created."); resetForm(); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function edit(rule: Rule) {
    setEditingId(rule.id); setName(rule.name); setKind(rule.trigger.type); setMsg(null);
    setActionType(rule.action.type);
    if (rule.action.type === "sendText") { setBody(rule.action.body); setChatbotId(""); }
    else { setChatbotId(rule.action.chatbotId); setBody(""); }
    if (rule.trigger.type === "keyword") setKeywords(rule.trigger.keywords.join(", "));
    else { setDays(rule.trigger.days); setStart(rule.trigger.start); setEnd(rule.trigger.end); setTzOffset(rule.trigger.tzOffset ?? 0); }
  }

  async function toggle(rule: Rule) {
    await apiFetch(`/api/automation-rules/${rule.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rule.name, enabled: !rule.enabled, trigger: rule.trigger, action: rule.action }),
    });
    await load();
  }

  async function remove(id: string) {
    const r = await apiFetch(`/api/automation-rules/${id}`, { method: "DELETE" });
    if (r.ok) { if (editingId === id) resetForm(); await load(); }
  }

  return (
    <div className="grid-forms">
      <form onSubmit={save} className="card">
        <h3>{editingId ? "Edit rule" : "New rule"}</h3>
        <p className="note" style={{ marginTop: 0 }}>Auto-reply to inbound messages by keyword, or send an away message outside business hours.</p>
        <div className="field">
          <label className="label" htmlFor="rules-name">Name</label>
          <input id="rules-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </div>
        <div className="field">
          <label className="label" htmlFor="rules-trigger">Trigger</label>
          <select id="rules-trigger" className="input" value={kind} onChange={(e) => setKind(e.target.value as "keyword" | "away")}>
            <option value="keyword">Keyword match</option>
            <option value="away">Outside business hours (away)</option>
          </select>
        </div>
        {kind === "keyword" ? (
          <div className="field">
            <label className="label" htmlFor="rules-keywords">Keywords (comma-separated)</label>
            <input id="rules-keywords" className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="price, hours, location" />
          </div>
        ) : (
          <>
            <div className="field">
              <span className="label" id="rules-days-label">Business days</span>
              <div role="group" aria-labelledby="rules-days-label" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {DAYS.map((d, i) => (
                  <button key={d} type="button" aria-pressed={days.includes(i)} className={`btn ${days.includes(i) ? "" : "btn--ghost"}`} style={{ minHeight: 30, padding: "3px 8px", fontSize: 12 }}
                    onClick={() => setDays((ds) => ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i].sort())}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="field" style={{ display: "flex", gap: 8 }}>
              <span><label className="label" htmlFor="rules-open">Open</label><input id="rules-open" className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></span>
              <span><label className="label" htmlFor="rules-close">Close</label><input id="rules-close" className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></span>
              <span><label className="label" htmlFor="rules-tzoffset">TZ offset (min)</label><input id="rules-tzoffset" className="input" type="number" value={tzOffset} onChange={(e) => setTzOffset(Number(e.target.value))} style={{ maxWidth: 110 }} /></span>
            </div>
          </>
        )}
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Create"}</button>
          {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Rules</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Trigger</th><th>Action</th><th></th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name} {!rule.enabled && <span className="badge badge--PENDING">off</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{triggerSummary(rule.trigger)}</td>
                <td className="muted" style={{ fontSize: 12 }}>{actionSummary(rule.action, bots)}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" onClick={() => toggle(rule)}>{rule.enabled ? "Disable" : "Enable"}</button>
                  <button type="button" className="btn btn--ghost" onClick={() => edit(rule)}>Edit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => remove(rule.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No rules yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
