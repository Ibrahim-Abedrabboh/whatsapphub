"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Reply { id: string; title: string; shortcut: string | null; body: string }

export default function CannedRepliesManager() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/canned-replies");
    if (r.ok) setReplies((await r.json()).replies);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function resetForm() { setEditingId(null); setTitle(""); setShortcut(""); setBody(""); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = { title, shortcut: shortcut.trim() || undefined, body };
    const r = editingId
      ? await apiFetch(`/api/canned-replies/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await apiFetch("/api/canned-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg(editingId ? "Updated." : "Created."); resetForm(); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function edit(rep: Reply) { setEditingId(rep.id); setTitle(rep.title); setShortcut(rep.shortcut ?? ""); setBody(rep.body); setMsg(null); }

  async function remove(id: string) {
    const r = await apiFetch(`/api/canned-replies/${id}`, { method: "DELETE" });
    if (r.ok) { if (editingId === id) resetForm(); await load(); }
  }

  return (
    <div className="grid-forms">
      <form onSubmit={save} className="card">
        <h3>{editingId ? "Edit snippet" : "New snippet"}</h3>
        <div className="field">
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} />
        </div>
        <div className="field">
          <label className="label">Shortcut (optional)</label>
          <input className="input" value={shortcut} onChange={(e) => setShortcut(e.target.value)} maxLength={40} placeholder="/greeting" />
        </div>
        <div className="field">
          <label className="label">Body — use {"{{name}}"} / {"{{phone}}"} for the contact</label>
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} required rows={4} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Create"}</button>
          {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Snippets</h3>
        <table className="table">
          <thead><tr><th>Title</th><th>Shortcut</th><th></th></tr></thead>
          <tbody>
            {replies.map((rep) => (
              <tr key={rep.id}>
                <td>{rep.title}</td>
                <td className="muted">{rep.shortcut ?? "—"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" onClick={() => edit(rep)}>Edit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => remove(rep.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {replies.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16 }}>No snippets yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
