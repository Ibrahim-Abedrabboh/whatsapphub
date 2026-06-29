"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Doc { id: string; title: string; content: string; source: string | null }

export default function KnowledgeManager() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/knowledge");
    if (r.ok) setDocs((await r.json()).docs);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function resetForm() { setEditingId(null); setTitle(""); setContent(""); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = { title, content };
    const r = editingId
      ? await apiFetch(`/api/knowledge/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await apiFetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg(editingId ? "Updated." : "Created."); resetForm(); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function edit(d: Doc) { setEditingId(d.id); setTitle(d.title); setContent(d.content); setMsg(null); }

  async function remove(id: string) {
    const r = await apiFetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (r.ok) { if (editingId === id) resetForm(); await load(); }
  }

  return (
    <div className="grid-forms">
      <form onSubmit={save} className="card">
        <h3>{editingId ? "Edit doc" : "New doc"}</h3>
        <p className="note" style={{ marginTop: 0 }}>Grounds the AI <b>FAQ answer</b> in the inbox — agents draft replies from these docs.</p>
        <div className="field">
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </div>
        <div className="field">
          <label className="label">Content</label>
          <textarea className="input" value={content} onChange={(e) => setContent(e.target.value)} required rows={6} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Create"}</button>
          {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Knowledge base</h3>
        <table className="table">
          <thead><tr><th>Title</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" onClick={() => edit(d)}>Edit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => remove(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={2} className="muted" style={{ padding: 16 }}>No docs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
