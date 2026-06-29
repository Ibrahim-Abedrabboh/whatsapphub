"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { parseMentions } from "@/lib/mentions";
import { substituteVars } from "@/lib/cannedReplies";
import { slaState, formatRemaining } from "@/lib/sla";

interface Assignee { id: string; name: string | null; email: string }
interface Note { id: string; body: string; authorId: string | null; authorName: string | null; createdAt: string }
interface CannedReply { id: string; title: string; shortcut: string | null; body: string }
interface Convo {
  id: string; phone: string; channel: string; name: string | null;
  lastPreview: string | null; lastMessageAt: string; lastInboundAt: string | null; unread: number;
  status: string; assignedToId: string | null; assignee: Assignee | null; firstResponseAt: string | null;
}
interface Msg {
  id: string; direction: "IN" | "OUT"; type: string; text: string | null;
  mediaMime: string | null; mediaFilename: string | null; status: string | null; error: string | null; createdAt: string;
}
interface Head {
  name: string | null; phone: string; channel: string;
  status: string; assignedToId: string | null; assignee: Assignee | null;
  lastInboundAt: string | null; firstResponseAt: string | null;
}

// First-response SLA badge (compute-on-read). Renders only while the clock is
// active (open + awaiting first reply): a countdown, or a breach marker.
function SlaBadge({ status, lastInboundAt, firstResponseAt }: { status: string; lastInboundAt: string | null; firstResponseAt: string | null }) {
  const fr = slaState({ status, lastInboundAt, firstResponseAt, now: new Date() }).firstResponse;
  if (!fr.active) return null;
  return fr.breached
    ? <span className="badge badge--FAILED" title="First-response SLA breached">🔴 SLA</span>
    : <span className="badge badge--PENDING" title="First response due">⏱ {formatRemaining(fr.remainingMs ?? 0)}</span>;
}

// Channel display metadata. New channels (Instagram/Messenger) light up here once
// their adapters + connections go live; until then only WhatsApp threads appear.
const CHANNELS = ["WHATSAPP", "INSTAGRAM", "MESSENGER"] as const;
type ChannelKey = (typeof CHANNELS)[number];
const CHANNEL_META: Record<string, { label: string; icon: string }> = {
  WHATSAPP: { label: "WhatsApp", icon: "🟢" },
  INSTAGRAM: { label: "Instagram", icon: "📸" },
  MESSENGER: { label: "Messenger", icon: "💬" },
};
function ChannelChip({ channel }: { channel: string }) {
  const meta = CHANNEL_META[channel] ?? { label: channel, icon: "💬" };
  return <span className="badge" title={meta.label}>{meta.icon} {meta.label}</span>;
}

const STATUSES = ["OPEN", "PENDING", "CLOSED"] as const;
type StatusKey = (typeof STATUSES)[number];
function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge--${status}`}>{status}</span>;
}
function assigneeName(a: Assignee | null): string {
  return a ? (a.name ?? a.email) : "Unassigned";
}

// Conversation-list view filters, applied on top of the channel filter.
const VIEWS = ["ALL", "MINE", "UNASSIGNED", "BREACHING", "OPEN", "PENDING", "CLOSED"] as const;
type ViewKey = (typeof VIEWS)[number];
const VIEW_LABEL: Record<ViewKey, string> = {
  ALL: "All", MINE: "Mine", UNASSIGNED: "Unassigned", BREACHING: "🔴 Breaching",
  OPEN: "Open", PENDING: "Pending", CLOSED: "Closed",
};

const MEDIA_LABEL: Record<string, string> = {
  image: "📷 Photo", audio: "🎙️ Voice message", video: "🎬 Video",
  sticker: "🌟 Sticker", location: "📍 Location", reaction: "Reaction",
};
function bodyOf(m: Msg): string {
  if (m.text) return m.text;
  if (m.type === "document") return "📄 " + (m.mediaFilename ?? "Document");
  return MEDIA_LABEL[m.type] ?? "Message";
}
const hhmm = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Render note text with @mentions highlighted (safe — segment-by-segment). */
function MentionText({ body }: { body: string }) {
  return (
    <>
      {parseMentions(body).map((seg, i) =>
        seg.type === "mention"
          ? <span key={i} className="mention">{seg.value}</span>
          : <span key={i}>{seg.value}</span>,
      )}
    </>
  );
}

// One unified, time-ordered timeline of messages + internal notes.
type TimelineItem = { kind: "msg"; at: string; msg: Msg } | { kind: "note"; at: string; note: Note };
function buildTimeline(messages: Msg[], notes: Note[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((m) => ({ kind: "msg" as const, at: m.createdAt, msg: m })),
    ...notes.map((n) => ({ kind: "note" as const, at: n.createdAt, note: n })),
  ];
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Render a bubble's content — media is streamed (token-safe) via /api/media/:id. */
function MessageContent({ m }: { m: Msg }) {
  const src = `/api/media/${m.id}`;
  if (m.type === "image" || m.type === "sticker") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bubble__media" src={src} alt={m.text ?? "image"} loading="lazy" />
        {m.text && <div className="bubble__text">{m.text}</div>}
      </>
    );
  }
  if (m.type === "video") {
    return (
      <>
        <video className="bubble__media" src={src} controls />
        {m.text && <div className="bubble__text">{m.text}</div>}
      </>
    );
  }
  if (m.type === "audio") return <audio className="bubble__audio" src={src} controls />;
  if (m.type === "document") {
    return <a className="bubble__doc" href={src} target="_blank" rel="noreferrer">📄 {m.mediaFilename ?? "Document"}</a>;
  }
  return <div className="bubble__text">{bodyOf(m)}</div>;
}

export default function InboxClient() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [head, setHead] = useState<Head | null>(null);
  const [channelFilter, setChannelFilter] = useState<"ALL" | ChannelKey>("ALL");
  const [view, setView] = useState<ViewKey>("ALL");
  const [members, setMembers] = useState<Assignee[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConvos = useCallback(async () => {
    const r = await apiFetch("/api/conversations");
    if (r.ok) setConvos((await r.json()).conversations);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const r = await apiFetch(`/api/conversations/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    const c = j.conversation;
    setMessages(j.messages);
    setNotes(j.notes ?? []);
    setWindowOpen(c.windowOpen);
    setHead({ name: c.name, phone: c.phone, channel: c.channel, status: c.status, assignedToId: c.assignedToId, assignee: c.assignee, lastInboundAt: c.lastInboundAt, firstResponseAt: c.firstResponseAt });
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await apiFetch("/api/team");
      if (r.ok) { const j = await r.json(); setMembers(j.members); setMeId(j.meId ?? null); }
      const rc = await apiFetch("/api/canned-replies");
      if (rc.ok) setCannedReplies((await rc.json()).replies);
    })();
  }, []);

  // Insert a canned reply, substituting {{name}}/{{phone}} from the active contact.
  function insertCanned(replyId: string) {
    const c = cannedReplies.find((x) => x.id === replyId);
    if (!c) return;
    setReply(substituteVars(c.body, { name: head?.name ?? null, phone: head?.phone ?? null }));
  }

  useEffect(() => {
    loadConvos();
    const t = setInterval(loadConvos, 5000);
    return () => clearInterval(t);
  }, [loadConvos]);

  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), 5000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  function open(id: string) {
    setActiveId(id);
    setErr(null);
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  // Patch status / assignment, then reflect it in the head + list without a reload.
  async function patchConvo(body: { status?: string; assignedToId?: string | null }) {
    if (!activeId) return;
    const r = await apiFetch(`/api/conversations/${activeId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Could not update"); return; }
    const c = j.conversation;
    setHead((h) => (h ? { ...h, status: c.status, assignedToId: c.assignedToId, assignee: c.assignee } : h));
    setConvos((cs) => cs.map((x) => (x.id === activeId ? { ...x, status: c.status, assignedToId: c.assignedToId, assignee: c.assignee } : x)));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !activeId) return;
    setBusy(true);
    setErr(null);

    if (noteMode) {
      const r = await apiFetch(`/api/conversations/${activeId}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }),
      });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (r.ok) { setReply(""); setNotes((n) => [...n, j.note]); }
      else setErr(j.error ?? "Could not add note");
      return;
    }

    const r = await apiFetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setReply("");
      setMessages((m) => [...m, j.message]);
      loadConvos();
      loadThread(activeId); // pick up any auto-assignment
    } else {
      setErr(j.error ?? "Could not send");
    }
  }

  async function sendFile(file: File) {
    if (!activeId) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    if (reply.trim()) fd.append("caption", reply.trim());
    const r = await apiFetch(`/api/conversations/${activeId}/media`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setReply("");
      setMessages((m) => [...m, j.message]);
      loadConvos();
      loadThread(activeId);
    } else {
      setErr(j.error ?? "Could not send file");
    }
  }

  function matchesView(c: Convo): boolean {
    switch (view) {
      case "ALL": return true;
      case "MINE": return !!meId && c.assignedToId === meId;
      case "UNASSIGNED": return c.assignedToId == null;
      case "BREACHING":
        return slaState({ status: c.status, lastInboundAt: c.lastInboundAt, firstResponseAt: c.firstResponseAt, now: new Date() }).firstResponse.breached;
      default: return c.status === view; // OPEN | PENDING | CLOSED
    }
  }
  const shown = convos.filter((c) => (channelFilter === "ALL" || c.channel === channelFilter) && matchesView(c));

  return (
    <div className="inbox">
      <aside className="inbox__list">
        <div className="inbox__filters" style={{ display: "flex", gap: 6, padding: 8, flexWrap: "wrap" }}>
          {(["ALL", ...CHANNELS] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn ${channelFilter === f ? "" : "btn--ghost"}`}
              style={{ minHeight: 32, padding: "4px 10px", fontSize: 12 }}
              onClick={() => setChannelFilter(f)}
            >
              {f === "ALL" ? "All" : `${CHANNEL_META[f]?.icon ?? ""} ${CHANNEL_META[f]?.label ?? f}`}
            </button>
          ))}
        </div>
        <div className="inbox__filters" style={{ display: "flex", gap: 6, padding: "0 8px 8px", flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={`btn ${view === v ? "" : "btn--ghost"}`}
              style={{ minHeight: 28, padding: "3px 9px", fontSize: 12 }}
              onClick={() => setView(v)}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            {convos.length === 0
              ? "No conversations yet — they appear here when a contact messages you back."
              : "No conversations match this filter."}
          </p>
        ) : (
          shown.map((c) => (
            <button key={c.id} type="button" className={`convo${c.id === activeId ? " convo--active" : ""}`} onClick={() => open(c.id)}>
              <div className="convo__top">
                <span className="convo__name">{c.name ?? c.phone}</span>
                {c.unread > 0 && <span className="convo__badge">{c.unread}</span>}
              </div>
              <div className="convo__preview">{c.lastPreview ?? ""}</div>
              <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <ChannelChip channel={c.channel} />
                <StatusBadge status={c.status} />
                <SlaBadge status={c.status} lastInboundAt={c.lastInboundAt} firstResponseAt={c.firstResponseAt} />
                <span className="muted" style={{ fontSize: 11 }}>· {assigneeName(c.assignee)}</span>
              </div>
            </button>
          ))
        )}
      </aside>

      <section className="inbox__thread">
        {!activeId ? (
          <div className="inbox__empty muted">Select a conversation to read and reply.</div>
        ) : (
          <>
            <header className="thread__head">
              <div>
                <strong>{head?.name ?? head?.phone}</strong>
                {head?.name && <span className="muted"> · {head?.phone}</span>}
                {head?.channel && <span style={{ marginLeft: 8 }}><ChannelChip channel={head.channel} /></span>}
                {head && <span style={{ marginLeft: 6 }}><SlaBadge status={head.status} lastInboundAt={head.lastInboundAt} firstResponseAt={head.firstResponseAt} /></span>}
              </div>
              <div className="thread__controls" style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
                <select
                  className="input"
                  style={{ minHeight: 34, width: "auto", padding: "4px 8px", fontSize: 13 }}
                  aria-label="Status"
                  value={head?.status ?? "OPEN"}
                  onChange={(e) => patchConvo({ status: e.target.value as StatusKey })}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="input"
                  style={{ minHeight: 34, width: "auto", padding: "4px 8px", fontSize: 13 }}
                  aria-label="Assignee"
                  value={head?.assignedToId ?? ""}
                  onChange={(e) => patchConvo({ assignedToId: e.target.value === "" ? null : e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{(m.name ?? m.email) + (m.id === meId ? " (me)" : "")}</option>
                  ))}
                </select>
              </div>
            </header>

            <div className="thread__body" ref={threadRef}>
              {buildTimeline(messages, notes).map((it) =>
                it.kind === "note" ? (
                  <div key={`n-${it.note.id}`} className="note-bubble">
                    <div className="note-bubble__meta">📝 Internal note{it.note.authorName ? ` · ${it.note.authorName}` : ""} · {hhmm(it.note.createdAt)}</div>
                    <div className="note-bubble__text"><MentionText body={it.note.body} /></div>
                  </div>
                ) : (
                  <div key={it.msg.id} className={`bubble bubble--${it.msg.direction === "OUT" ? "out" : "in"}`}>
                    <MessageContent m={it.msg} />
                    <div className="bubble__meta">
                      {hhmm(it.msg.createdAt)}
                      {it.msg.direction === "OUT" && it.msg.status ? ` · ${it.msg.status.toLowerCase()}` : ""}
                    </div>
                  </div>
                ),
              )}
            </div>

            <form className={`thread__reply${noteMode ? " thread__reply--note" : ""}`} onSubmit={send}>
              <div className="thread__mode" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button type="button" className={`btn ${noteMode ? "btn--ghost" : ""}`} style={{ minHeight: 30, padding: "3px 12px", fontSize: 12 }} onClick={() => setNoteMode(false)}>Reply</button>
                <button type="button" className={`btn ${noteMode ? "" : "btn--ghost"}`} style={{ minHeight: 30, padding: "3px 12px", fontSize: 12 }} onClick={() => setNoteMode(true)}>📝 Internal note</button>
              </div>
              {!noteMode && cannedReplies.length > 0 && (
                <select
                  className="input"
                  aria-label="Insert canned reply"
                  style={{ minHeight: 32, fontSize: 13, marginBottom: 8, maxWidth: 280 }}
                  value=""
                  onChange={(e) => { if (e.target.value) insertCanned(e.target.value); e.target.value = ""; }}
                >
                  <option value="">⚡ Insert canned reply…</option>
                  {cannedReplies.map((c) => (
                    <option key={c.id} value={c.id}>{c.shortcut ? `${c.shortcut} — ${c.title}` : c.title}</option>
                  ))}
                </select>
              )}
              {!noteMode && !windowOpen && (
                <div className="thread__closed">
                  The 24-hour reply window is closed. Send an approved <b>template</b> to re-open the conversation.
                </div>
              )}
              <div className="thread__inputrow">
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendFile(f);
                    e.target.value = "";
                  }}
                />
                {!noteMode && (
                  <button
                    type="button"
                    className="btn btn--ghost thread__attach"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    title="Attach a file"
                    aria-label="Attach a file"
                  >
                    📎
                  </button>
                )}
                <input
                  className="input"
                  placeholder={
                    noteMode
                      ? "Add an internal note… use @name to mention a teammate"
                      : windowOpen ? "Type a reply…" : "Window closed — a free-form reply may be rejected"
                  }
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button className="btn" type="submit" disabled={busy || !reply.trim()} aria-busy={busy}>
                  {busy ? "Saving…" : noteMode ? "Add note" : "Send"}
                </button>
              </div>
              {err && <p className="note" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
