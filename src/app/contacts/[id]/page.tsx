"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { apiFetch } from "@/lib/apiFetch";

interface Profile {
  id: string; phone: string; name: string | null;
  attributes: Record<string, string>; tags: string[]; optedOut: boolean; createdAt: string;
  lists: { id: string; name: string }[];
}
type TimelineItem =
  | { kind: "message"; at: string; channel: string; direction: "IN" | "OUT"; text: string | null; type: string; id: string }
  | { kind: "broadcast"; at: string; templateName: string; status: string; id: string }
  | { kind: "note"; at: string; body: string; authorName: string | null; id: string };

const CHANNEL_ICON: Record<string, string> = { WHATSAPP: "🟢", INSTAGRAM: "📸", MESSENGER: "💬" };
const when = (s: string) => new Date(s).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function ContactProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [newTag, setNewTag] = useState("");
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch(`/api/contacts/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    setProfile(j.contact);
    setTimeline(j.timeline);
    setAttrRows(Object.entries(j.contact.attributes ?? {}).map(([key, value]) => ({ key, value: String(value) })));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    const r = await apiFetch(`/api/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setProfile((p) => (p ? { ...p, ...j.contact } : p)); setMsg(null); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function addTag() {
    const t = newTag.trim();
    if (!t || !profile || profile.tags.includes(t)) return;
    void patch({ tags: [...profile.tags, t] });
    setNewTag("");
  }
  function removeTag(t: string) {
    if (!profile) return;
    void patch({ tags: profile.tags.filter((x) => x !== t) });
  }
  function saveAttrs() {
    const attributes: Record<string, string> = {};
    for (const { key, value } of attrRows) if (key.trim()) attributes[key.trim()] = value;
    void patch({ attributes });
    setMsg("Saved.");
  }

  if (!profile) return (<><Nav /><main className="app"><p className="muted">Loading…</p></main></>);

  return (
    <>
      <Nav />
      <main className="app">
        <p style={{ marginBottom: 8 }}><Link href="/contacts" className="muted">← Contacts</Link></p>
        <h1>{profile.name ?? profile.phone}</h1>
        <p className="muted">{profile.phone} {profile.optedOut && <span className="badge badge--FAILED">opted out</span>}</p>

        <div className="grid-forms" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Tags</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {profile.tags.map((t) => (
                <span key={t} className="badge">{t} <button type="button" onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button></span>
              ))}
              {profile.tags.length === 0 && <span className="muted">No tags.</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="input" value={newTag} placeholder="Add a tag" onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <button type="button" className="btn" onClick={addTag}>Add</button>
            </div>

            <h3 style={{ marginTop: 20 }}>Attributes</h3>
            {attrRows.map((row, i) => (
              <div key={i} className="field" style={{ display: "flex", gap: 6, margin: "0 0 6px" }}>
                <input className="input" value={row.key} placeholder="key" onChange={(e) => setAttrRows((rs) => rs.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} />
                <input className="input" value={row.value} placeholder="value" onChange={(e) => setAttrRows((rs) => rs.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                <button type="button" className="btn btn--ghost" onClick={() => setAttrRows((rs) => rs.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setAttrRows((rs) => [...rs, { key: "", value: "" }])}>+ Add attribute</button>
              <button type="button" className="btn" onClick={saveAttrs}>Save attributes</button>
            </div>
            {profile.lists.length > 0 && (
              <>
                <h3 style={{ marginTop: 20 }}>Lists</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{profile.lists.map((l) => <span key={l.id} className="badge badge--READ">{l.name}</span>)}</div>
              </>
            )}
            {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
          </div>

          <div className="card">
            <h3>Timeline</h3>
            {timeline.length === 0 && <p className="muted">No activity yet.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {timeline.map((it) => (
                <div key={`${it.kind}-${it.id}`} style={{ borderLeft: "2px solid var(--line2)", paddingLeft: 10 }}>
                  <div className="muted" style={{ fontSize: 11 }}>{when(it.at)}</div>
                  {it.kind === "message" && (
                    <div style={{ fontSize: 13 }}>
                      {CHANNEL_ICON[it.channel] ?? "💬"} <b>{it.direction === "IN" ? "Customer" : "Agent"}</b>: {it.text ?? `[${it.type}]`}
                    </div>
                  )}
                  {it.kind === "broadcast" && (
                    <div style={{ fontSize: 13 }}>📣 Broadcast <b>{it.templateName}</b> <span className={`badge badge--${it.status}`}>{it.status}</span></div>
                  )}
                  {it.kind === "note" && (
                    <div style={{ fontSize: 13 }}>📝 Note{it.authorName ? ` · ${it.authorName}` : ""}: {it.body}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
