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
