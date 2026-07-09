"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Flow { id: string; name: string; definition: unknown; metaId: string | null; status: string }

const STATUS_BADGE: Record<string, string> = { DRAFT: "PENDING", PENDING: "SCHEDULED", APPROVED: "COMPLETED", REJECTED: "FAILED" };

export default function FlowsManager() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [defText, setDefText] = useState('{\n  "screens": []\n}');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/flows");
    if (r.ok) setFlows((await r.json()).flows);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function resetForm() { setEditingId(null); setName(""); setDefText('{\n  "screens": []\n}'); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    let definition: unknown;
    try { definition = JSON.parse(defText); } catch { setBusy(false); setMsg("Definition must be valid JSON."); return; }
    const payload = { name, definition };
    const r = editingId
      ? await apiFetch(`/api/flows/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await apiFetch("/api/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg(editingId ? "Updated." : "Created."); resetForm(); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function edit(f: Flow) { setEditingId(f.id); setName(f.name); setDefText(JSON.stringify(f.definition, null, 2)); setMsg(null); }

  async function submit(id: string) {
    setMsg(null);
    const r = await apiFetch(`/api/flows/${id}/submit`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) await load();
    else setMsg(`Submit error: ${j.error ?? r.status}`);
  }

  async function remove(id: string) {
    const r = await apiFetch(`/api/flows/${id}`, { method: "DELETE" });
    if (r.ok) { if (editingId === id) resetForm(); await load(); }
  }

  return (
    <div className="grid-forms">
      <form onSubmit={save} className="card">
        <h3>{editingId ? "Edit flow" : "New flow"}</h3>
        <p className="note" style={{ marginTop: 0 }}>WhatsApp Flows are native in-chat forms. Submitting requires Meta Flows access on your app.</p>
        <div className="field">
          <label className="label" htmlFor="flows-name">Name</label>
          <input id="flows-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </div>
        <div className="field">
          <label className="label" htmlFor="flows-definition">Definition (Flow JSON)</label>
          <textarea id="flows-definition" className="input" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }} value={defText} onChange={(e) => setDefText(e.target.value)} rows={8} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Create"}</button>
          {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Flows</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td><span className={`badge badge--${STATUS_BADGE[f.status] ?? "PENDING"}`}>{f.status}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" onClick={() => submit(f.id)}>Submit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => edit(f)}>Edit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => remove(f.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {flows.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16 }}>No flows yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
