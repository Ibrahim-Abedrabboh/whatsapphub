"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

type Trigger =
  | { type: "keyword"; keywords: string[] }
  | { type: "away"; days: number[]; start: string; end: string; tzOffset?: number };
type Action = { type: "sendText"; body: string };
interface Rule { id: string; name: string; enabled: boolean; trigger: Trigger; action: Action }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function triggerSummary(t: Trigger): string {
  if (t.type === "keyword") return `keyword: ${t.keywords.join(", ")}`;
  return `away · ${t.days.map((d) => DAYS[d]).join("/")} ${t.start}–${t.end}`;
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/automation-rules");
    if (r.ok) setRules((await r.json()).rules);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setEditingId(null); setName(""); setKind("keyword"); setKeywords("");
    setDays([1, 2, 3, 4, 5]); setStart("09:00"); setEnd("17:00"); setTzOffset(180); setBody("");
  }

  function buildTrigger(): Trigger {
    return kind === "keyword"
      ? { type: "keyword", keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) }
      : { type: "away", days, start, end, tzOffset };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = { name, enabled: true, trigger: buildTrigger(), action: { type: "sendText", body } };
    const r = editingId
      ? await apiFetch(`/api/automation-rules/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, enabled: rules.find((x) => x.id === editingId)?.enabled ?? true }) })
      : await apiFetch("/api/automation-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg(editingId ? "Updated." : "Created."); resetForm(); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function edit(rule: Rule) {
    setEditingId(rule.id); setName(rule.name); setKind(rule.trigger.type); setBody(rule.action.body); setMsg(null);
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
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </div>
        <div className="field">
          <label className="label">Trigger</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "keyword" | "away")}>
            <option value="keyword">Keyword match</option>
            <option value="away">Outside business hours (away)</option>
          </select>
        </div>
        {kind === "keyword" ? (
          <div className="field">
            <label className="label">Keywords (comma-separated)</label>
            <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="price, hours, location" />
          </div>
        ) : (
          <>
            <div className="field">
              <label className="label">Business days</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {DAYS.map((d, i) => (
                  <button key={d} type="button" className={`btn ${days.includes(i) ? "" : "btn--ghost"}`} style={{ minHeight: 30, padding: "3px 8px", fontSize: 12 }}
                    onClick={() => setDays((ds) => ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i].sort())}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="field" style={{ display: "flex", gap: 8 }}>
              <span><label className="label">Open</label><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></span>
              <span><label className="label">Close</label><input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></span>
              <span><label className="label">TZ offset (min)</label><input className="input" type="number" value={tzOffset} onChange={(e) => setTzOffset(Number(e.target.value))} style={{ maxWidth: 110 }} /></span>
            </div>
          </>
        )}
        <div className="field">
          <label className="label">Auto-reply text</label>
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} required rows={3} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Create"}</button>
          {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Rules</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Trigger</th><th></th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name} {!rule.enabled && <span className="badge badge--PENDING">off</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{triggerSummary(rule.trigger)}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" onClick={() => toggle(rule)}>{rule.enabled ? "Disable" : "Enable"}</button>
                  <button type="button" className="btn btn--ghost" onClick={() => edit(rule)}>Edit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => remove(rule.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16 }}>No rules yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
