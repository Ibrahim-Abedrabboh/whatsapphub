"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Chatbot {
  id: string;
  name: string;
  status: string; // DRAFT | PUBLISHED
  updatedAt: string;
}

// PUBLISHED has no dedicated badge class — reuse the green "COMPLETED" tint.
const badgeClass = (status: string) => (status === "PUBLISHED" ? "badge--COMPLETED" : "badge--DRAFT");

/** /chatbot (V2 M3): lists this client's saved no-code chatbots. The visual
 *  drag-and-drop builder lands in a later phase — for now bots are created via
 *  the /api/chatbots API (or demo seed) and managed here. */
export default function ChatbotsManager() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/chatbots");
    if (r.ok) setChatbots((await r.json()).chatbots);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string, name: string) {
    setBusy(id); setMsg(null);
    const r = await apiFetch(`/api/chatbots/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) { setMsg(`Deleted "${name}".`); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  return (
    <div>
      {msg && <p className="note" data-test-id="chatbots-msg" style={{ marginBottom: 10 }}>{msg}</p>}

      <div className="card">
        <table className="table" data-test-id="chatbots-table">
          <thead>
            <tr><th>Name</th><th>Status</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>
            {chatbots.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td><span className={`badge ${badgeClass(b.status)}`}>{b.status}</span></td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(b.updatedAt).toLocaleString()}</td>
                <td>
                  <button type="button" className="btn btn--ghost" style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }}
                    disabled={busy !== null} onClick={() => void remove(b.id, b.name)}>
                    {busy === b.id ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && chatbots.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>
                No chatbots yet — the visual builder is coming soon. Bots created via the API appear here.
              </td></tr>
            )}
            {loading && (
              <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
