"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { parseMentions } from "@/lib/mentions";
import { substituteVars } from "@/lib/cannedReplies";
import { slaState, formatRemaining } from "@/lib/sla";

interface Assignee { id: string; name: string | null; email: string }
interface Note { id: string; body: string; authorId: string | null; authorName: string | null; createdAt: string }
interface CannedReply { id: string; title: string; shortcut: string | null; body: string }
interface CatalogProduct { id: string; retailerId: string; name: string; priceText: string | null }
interface Convo {
  id: string; phone: string; channel: string; name: string | null;
  lastPreview: string | null; lastMessageAt: string; lastInboundAt: string | null; unread: number;
  status: string; assignedToId: string | null; assignee: Assignee | null; firstResponseAt: string | null;
}
interface Msg {
  id: string; direction: "IN" | "OUT"; type: string; text: string | null;
  mediaMime: string | null; mediaFilename: string | null; status: string | null; error: string | null; createdAt: string;
  aiTags?: { intent: string; sentiment: string } | null;
}

function sentimentBadge(s: string): string {
  return s === "positive" ? "completed" : s === "negative" ? "failed" : "draft";
}

interface Head {
  name: string | null; phone: string; channel: string;
  status: string; assignedToId: string | null; assignee: Assignee | null;
  lastInboundAt: string | null; firstResponseAt: string | null; aiSummary: string | null;
}

function SlaBadge({ status, lastInboundAt, firstResponseAt }: { status: string; lastInboundAt: string | null; firstResponseAt: string | null }) {
  const fr = slaState({ status, lastInboundAt, firstResponseAt, now: new Date() }).firstResponse;
  if (!fr.active) return null;
  return fr.breached
    ? <span className="inbox-badge inbox-badge--breached">🔴 SLA</span>
    : <span className="inbox-badge inbox-badge--sla">⏱ {formatRemaining(fr.remainingMs ?? 0)}</span>;
}

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "MESSENGER"] as const;
type ChannelKey = (typeof CHANNELS)[number];
const CHANNEL_META: Record<string, { label: string; labelAr: string; icon: string }> = {
  WHATSAPP: { label: "WhatsApp", labelAr: "واتساب", icon: "🟢" },
  INSTAGRAM: { label: "Instagram", labelAr: "إنستغرام", icon: "📸" },
  MESSENGER: { label: "Messenger", labelAr: "ماسنجر", icon: "💬" },
};

function ChannelChip({ channel }: { channel: string }) {
  const meta = CHANNEL_META[channel] ?? { label: channel, labelAr: channel, icon: "💬" };
  return (
    <span className="inbox-chip">
      <span>{meta.icon}</span>
      <span data-lang="ar">{meta.labelAr}</span>
      <span data-lang="en">{meta.label}</span>
    </span>
  );
}

const STATUSES = ["OPEN", "PENDING", "CLOSED"] as const;
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  OPEN: { ar: "مفتوح", en: "Open" },
  PENDING: { ar: "معلق", en: "Pending" },
  CLOSED: { ar: "مغلق", en: "Closed" },
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? { ar: status, en: status };
  return (
    <span className={`inbox-badge inbox-badge--${status.toLowerCase()}`}>
      <span data-lang="ar">{label.ar}</span>
      <span data-lang="en">{label.en}</span>
    </span>
  );
}

function assigneeName(a: Assignee | null): string {
  return a ? (a.name ?? a.email) : "Unassigned";
}

const VIEWS = ["ALL", "MINE", "UNASSIGNED", "BREACHING", "OPEN", "PENDING", "CLOSED"] as const;
type ViewKey = (typeof VIEWS)[number];
const VIEW_LABEL: Record<ViewKey, { ar: string; en: string }> = {
  ALL: { ar: "الكل", en: "All" },
  MINE: { ar: "خاصتي", en: "Mine" },
  UNASSIGNED: { ar: "غير معين", en: "Unassigned" },
  BREACHING: { ar: "🔴 متأخر", en: "🔴 Breaching" },
  OPEN: { ar: "مفتوح", en: "Open" },
  PENDING: { ar: "معلق", en: "Pending" },
  CLOSED: { ar: "مغلق", en: "Closed" },
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

function MentionText({ body }: { body: string }) {
  return (
    <>
      {parseMentions(body).map((seg, i) =>
        seg.type === "mention"
          ? <span key={i} className="inbox-mention">{seg.value}</span>
          : <span key={i}>{seg.value}</span>,
      )}
    </>
  );
}

type TimelineItem = { kind: "msg"; at: string; msg: Msg } | { kind: "note"; at: string; note: Note };
function buildTimeline(messages: Msg[], notes: Note[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((m) => ({ kind: "msg" as const, at: m.createdAt, msg: m })),
    ...notes.map((n) => ({ kind: "note" as const, at: n.createdAt, note: n })),
  ];
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function MessageContent({ m }: { m: Msg }) {
  const src = `/api/media/${m.id}`;
  if (m.type === "image" || m.type === "sticker") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="inbox-bubble__media" src={src} alt={m.text ?? "image"} loading="lazy" />
        {m.text && <div className="inbox-bubble__text">{m.text}</div>}
      </>
    );
  }
  if (m.type === "video") {
    return (
      <>
        <video className="inbox-bubble__media" src={src} controls />
        {m.text && <div className="inbox-bubble__text">{m.text}</div>}
      </>
    );
  }
  if (m.type === "audio") return <audio className="inbox-bubble__audio" src={src} controls />;
  if (m.type === "document") {
    return <a className="inbox-bubble__doc" href={src} target="_blank" rel="noreferrer">📄 {m.mediaFilename ?? "Document"}</a>;
  }
  return <div className="inbox-bubble__text">{bodyOf(m)}</div>;
}

export default function InboxClientNew() {
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
  const [aiOn, setAiOn] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [showProducts, setShowProducts] = useState(false);
  const [pickedProducts, setPickedProducts] = useState<Set<string>>(new Set());
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
    setHead({ name: c.name, phone: c.phone, channel: c.channel, status: c.status, assignedToId: c.assignedToId, assignee: c.assignee, lastInboundAt: c.lastInboundAt, firstResponseAt: c.firstResponseAt, aiSummary: c.aiSummary ?? null });
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await apiFetch("/api/team");
      if (r.ok) { const j = await r.json(); setMembers(j.members); setMeId(j.meId ?? null); }
      const rc = await apiFetch("/api/canned-replies");
      if (rc.ok) setCannedReplies((await rc.json()).replies);
      const ra = await apiFetch("/api/ai/status");
      if (ra.ok) setAiOn(!!(await ra.json()).configured);
    })();
  }, []);

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
    setSuggestions([]);
    setTranslations({});
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  async function aiSuggest() {
    if (!activeId) return;
    setAiBusy("suggest"); setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/ai/suggest`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setAiBusy(null);
    if (r.ok) setSuggestions(j.suggestions ?? []);
    else setErr(j.error ?? "Could not get suggestions");
  }

  async function aiSummarize() {
    if (!activeId) return;
    setAiBusy("summary"); setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/ai/summary`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setAiBusy(null);
    if (r.ok) setHead((h) => (h ? { ...h, aiSummary: j.summary } : h));
    else setErr(j.error ?? "Could not summarize");
  }

  async function aiTranslate(msgId: string, text: string, target: "AR" | "EN") {
    if (!activeId) return;
    setAiBusy(`tr:${msgId}`); setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/ai/translate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target }),
    });
    const j = await r.json().catch(() => ({}));
    setAiBusy(null);
    if (r.ok) setTranslations((t) => ({ ...t, [msgId]: j.translation }));
    else setErr(j.error ?? "Could not translate");
  }

  async function aiFaq() {
    if (!activeId) return;
    setAiBusy("faq"); setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/ai/faq`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setAiBusy(null);
    if (r.ok) setReply(j.answer);
    else setErr(j.error ?? "Could not draft an answer");
  }

  async function aiTag(messageId: string) {
    if (!activeId) return;
    setAiBusy(`tag:${messageId}`); setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/ai/tag`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }),
    });
    const j = await r.json().catch(() => ({}));
    setAiBusy(null);
    if (r.ok) loadThread(activeId);
    else setErr(j.error ?? "Could not tag");
  }

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
      loadThread(activeId);
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

  async function openProductPicker() {
    setShowProducts(true);
    if (products === null) {
      const r = await apiFetch("/api/commerce/products");
      setProducts(r.ok ? (await r.json()).products : []);
    }
  }

  function toggleProduct(retailerId: string) {
    setPickedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(retailerId)) next.delete(retailerId);
      else if (next.size < 30) next.add(retailerId);
      return next;
    });
  }

  async function sendProducts() {
    if (!activeId || pickedProducts.size === 0) return;
    setBusy(true);
    setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/send-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retailerIds: [...pickedProducts], ...(reply.trim() ? { body: reply.trim() } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setReply("");
      setPickedProducts(new Set());
      setShowProducts(false);
      setMessages((m) => [...m, j.message]);
      loadConvos();
      loadThread(activeId);
    } else {
      setErr(j.error ?? "Could not send products");
    }
  }

  function matchesView(c: Convo): boolean {
    switch (view) {
      case "ALL": return true;
      case "MINE": return !!meId && c.assignedToId === meId;
      case "UNASSIGNED": return c.assignedToId == null;
      case "BREACHING":
        return slaState({ status: c.status, lastInboundAt: c.lastInboundAt, firstResponseAt: c.firstResponseAt, now: new Date() }).firstResponse.breached;
      default: return c.status === view;
    }
  }

  const shown = convos.filter((c) => (channelFilter === "ALL" || c.channel === channelFilter) && matchesView(c));

  return (
    <div className="inbox-layout">
      {/* Conversation List */}
      <aside className="inbox-list">
        <div className="inbox-list__filters">
          <div className="inbox-filter-group">
            {(["ALL", ...CHANNELS] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`inbox-filter ${channelFilter === f ? "inbox-filter--active" : ""}`}
                onClick={() => setChannelFilter(f)}
              >
                {f === "ALL" ? (
                  <><span data-lang="ar">الكل</span><span data-lang="en">All</span></>
                ) : (
                  <>{CHANNEL_META[f]?.icon} <span data-lang="ar">{CHANNEL_META[f]?.labelAr}</span><span data-lang="en">{CHANNEL_META[f]?.label}</span></>
                )}
              </button>
            ))}
          </div>
          <div className="inbox-filter-group">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className={`inbox-filter inbox-filter--sm ${view === v ? "inbox-filter--active" : ""}`}
                onClick={() => setView(v)}
              >
                <span data-lang="ar">{VIEW_LABEL[v].ar}</span>
                <span data-lang="en">{VIEW_LABEL[v].en}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="inbox-list__items">
          {shown.length === 0 ? (
            <div className="inbox-empty">
              <span className="inbox-empty__icon">💬</span>
              <p>
                {convos.length === 0 ? (
                  <><span data-lang="ar">لا توجد محادثات بعد</span><span data-lang="en">No conversations yet</span></>
                ) : (
                  <><span data-lang="ar">لا توجد محادثات مطابقة</span><span data-lang="en">No matching conversations</span></>
                )}
              </p>
            </div>
          ) : (
            shown.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`inbox-convo ${c.id === activeId ? "inbox-convo--active" : ""}`}
                onClick={() => open(c.id)}
              >
                <div className="inbox-convo__header">
                  <span className="inbox-convo__name">{c.name ?? c.phone}</span>
                  {c.unread > 0 && <span className="inbox-convo__badge">{c.unread}</span>}
                </div>
                <div className="inbox-convo__preview">{c.lastPreview ?? ""}</div>
                <div className="inbox-convo__meta">
                  <ChannelChip channel={c.channel} />
                  <StatusBadge status={c.status} />
                  <SlaBadge status={c.status} lastInboundAt={c.lastInboundAt} firstResponseAt={c.firstResponseAt} />
                  <span className="inbox-convo__assignee">{assigneeName(c.assignee)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className="inbox-thread">
        {!activeId ? (
          <div className="inbox-thread__empty">
            <span className="inbox-thread__empty-icon">📨</span>
            <p>
              <span data-lang="ar">اختر محادثة للقراءة والرد</span>
              <span data-lang="en">Select a conversation to read and reply</span>
            </p>
          </div>
        ) : (
          <>
            <header className="inbox-thread__header">
              <div className="inbox-thread__header-info">
                <strong>{head?.name ?? head?.phone}</strong>
                {head?.name && <span className="text-muted"> · {head?.phone}</span>}
                {head?.channel && <ChannelChip channel={head.channel} />}
                {head && <SlaBadge status={head.status} lastInboundAt={head.lastInboundAt} firstResponseAt={head.firstResponseAt} />}
              </div>
              <div className="inbox-thread__header-actions">
                <select
                  className="inbox-select"
                  aria-label="Status"
                  value={head?.status ?? "OPEN"}
                  onChange={(e) => patchConvo({ status: e.target.value as string })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]?.ar} / {STATUS_LABELS[s]?.en}
                    </option>
                  ))}
                </select>
                <select
                  className="inbox-select"
                  aria-label="Assignee"
                  value={head?.assignedToId ?? ""}
                  onChange={(e) => patchConvo({ assignedToId: e.target.value === "" ? null : e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{(m.name ?? m.email) + (m.id === meId ? " (me)" : "")}</option>
                  ))}
                </select>
                {aiOn && (
                  <button
                    type="button"
                    className="inbox-btn inbox-btn--ghost"
                    disabled={aiBusy === "summary"}
                    onClick={() => void aiSummarize()}
                  >
                    {aiBusy === "summary" ? "…" : "✨"}
                  </button>
                )}
              </div>
            </header>

            {head?.aiSummary && (
              <div className="inbox-summary">
                <strong>✨ <span data-lang="ar">ملخص</span><span data-lang="en">Summary</span></strong>
                <div>{head.aiSummary}</div>
              </div>
            )}

            <div className="inbox-thread__body" ref={threadRef}>
              {buildTimeline(messages, notes).map((it) =>
                it.kind === "note" ? (
                  <div key={`n-${it.note.id}`} className="inbox-note">
                    <div className="inbox-note__meta">
                      📝 <span data-lang="ar">ملاحظة داخلية</span><span data-lang="en">Internal note</span>
                      {it.note.authorName && ` · ${it.note.authorName}`} · {hhmm(it.note.createdAt)}
                    </div>
                    <div className="inbox-note__text"><MentionText body={it.note.body} /></div>
                  </div>
                ) : (
                  <div key={it.msg.id} className={`inbox-bubble inbox-bubble--${it.msg.direction === "OUT" ? "out" : "in"}`}>
                    <MessageContent m={it.msg} />
                    <div className="inbox-bubble__meta">
                      {hhmm(it.msg.createdAt)}
                      {it.msg.direction === "OUT" && it.msg.status ? ` · ${it.msg.status.toLowerCase()}` : ""}
                    </div>
                    {aiOn && it.msg.text && (
                      <div className="inbox-bubble__ai">
                        {translations[it.msg.id] ? (
                          <span className="text-muted">🌐 {translations[it.msg.id]}</span>
                        ) : (
                          <button
                            type="button"
                            className="inbox-bubble__ai-btn"
                            disabled={aiBusy === `tr:${it.msg.id}`}
                            onClick={() => void aiTranslate(it.msg.id, it.msg.text!, it.msg.direction === "IN" ? "EN" : "AR")}
                          >
                            {aiBusy === `tr:${it.msg.id}` ? "…" : "🌐"}
                          </button>
                        )}
                        {it.msg.direction === "IN" && (
                          it.msg.aiTags ? (
                            <span className="inbox-bubble__tags">
                              <span className="inbox-badge inbox-badge--completed">{it.msg.aiTags.intent}</span>
                              <span className={`inbox-badge inbox-badge--${sentimentBadge(it.msg.aiTags.sentiment)}`}>{it.msg.aiTags.sentiment}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="inbox-bubble__ai-btn"
                              disabled={aiBusy === `tag:${it.msg.id}`}
                              onClick={() => void aiTag(it.msg.id)}
                            >
                              {aiBusy === `tag:${it.msg.id}` ? "…" : "🏷"}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>

            <form className={`inbox-reply ${noteMode ? "inbox-reply--note" : ""}`} onSubmit={send}>
              <div className="inbox-reply__modes">
                <button
                  type="button"
                  className={`inbox-mode ${!noteMode ? "inbox-mode--active" : ""}`}
                  onClick={() => setNoteMode(false)}
                >
                  <span data-lang="ar">رد</span><span data-lang="en">Reply</span>
                </button>
                <button
                  type="button"
                  className={`inbox-mode ${noteMode ? "inbox-mode--active" : ""}`}
                  onClick={() => setNoteMode(true)}
                >
                  📝 <span data-lang="ar">ملاحظة</span><span data-lang="en">Note</span>
                </button>
                {aiOn && !noteMode && (
                  <div className="inbox-reply__ai-actions">
                    <button
                      type="button"
                      className="inbox-btn inbox-btn--ghost"
                      disabled={aiBusy === "suggest"}
                      onClick={() => void aiSuggest()}
                    >
                      {aiBusy === "suggest" ? "…" : "✨"} <span data-lang="ar">اقتراح</span><span data-lang="en">Suggest</span>
                    </button>
                    <button
                      type="button"
                      className="inbox-btn inbox-btn--ghost"
                      disabled={aiBusy === "faq"}
                      onClick={() => void aiFaq()}
                    >
                      {aiBusy === "faq" ? "…" : "💡"} <span data-lang="ar">أسئلة</span><span data-lang="en">FAQ</span>
                    </button>
                  </div>
                )}
              </div>

              {!noteMode && suggestions.length > 0 && (
                <div className="inbox-suggestions">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="inbox-suggestion"
                      onClick={() => { setReply(s); setSuggestions([]); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {!noteMode && cannedReplies.length > 0 && (
                <select
                  className="inbox-select inbox-select--canned"
                  aria-label="Insert canned reply"
                  value=""
                  onChange={(e) => { if (e.target.value) insertCanned(e.target.value); e.target.value = ""; }}
                >
                  <option value="">⚡ <span data-lang="ar">رد جاهز</span><span data-lang="en">Canned reply</span>…</option>
                  {cannedReplies.map((c) => (
                    <option key={c.id} value={c.id}>{c.shortcut ? `${c.shortcut} — ${c.title}` : c.title}</option>
                  ))}
                </select>
              )}

              {!noteMode && !windowOpen && (
                <div className="inbox-warning">
                  <span data-lang="ar">نافذة الـ ٢٤ ساعة مغلقة. أرسل قالب معتمد لإعادة الفتح</span>
                  <span data-lang="en">24-hour window closed. Send an approved template to re-open</span>
                </div>
              )}

              {!noteMode && showProducts && (
                <div className="inbox-products">
                  <div className="inbox-products__header">
                    <strong>
                      <span data-lang="ar">إرسال منتجات</span><span data-lang="en">Send products</span>
                      {pickedProducts.size > 0 && ` (${pickedProducts.size}/30)`}
                    </strong>
                    <button
                      type="button"
                      className="inbox-btn inbox-btn--ghost"
                      onClick={() => setShowProducts(false)}
                    >
                      ✕
                    </button>
                  </div>
                  {products === null && <p className="text-muted">Loading…</p>}
                  {products !== null && products.length === 0 && (
                    <p className="text-muted">No synced products</p>
                  )}
                  {products !== null && products.map((p) => (
                    <label key={p.id} className="inbox-products__item">
                      <input
                        type="checkbox"
                        checked={pickedProducts.has(p.retailerId)}
                        onChange={() => toggleProduct(p.retailerId)}
                      />
                      <span>{p.name}</span>
                      {p.priceText && <span className="text-muted">{p.priceText}</span>}
                    </label>
                  ))}
                  {products !== null && products.length > 0 && (
                    <button
                      type="button"
                      className="inbox-btn inbox-btn--primary"
                      disabled={busy || pickedProducts.size === 0}
                      onClick={() => void sendProducts()}
                    >
                      {busy ? "…" : <><span data-lang="ar">إرسال</span><span data-lang="en">Send</span> {pickedProducts.size || ""}</>}
                    </button>
                  )}
                </div>
              )}

              <div className="inbox-reply__input-row">
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
                    className="inbox-btn inbox-btn--attach"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    title="Attach file"
                    aria-label="Attach file"
                  >
                    📎
                  </button>
                )}
                {!noteMode && head?.channel === "WHATSAPP" && (
                  <button
                    type="button"
                    className="inbox-btn inbox-btn--attach"
                    onClick={() => void openProductPicker()}
                    disabled={busy}
                    title="Send products"
                    aria-label="Send products"
                  >
                    🛍
                  </button>
                )}
                <input
                  className="inbox-input"
                  placeholder={
                    noteMode
                      ? "Add note… @mention"
                      : windowOpen
                      ? "Type reply…"
                      : "Window closed"
                  }
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  className="inbox-btn inbox-btn--send"
                  type="submit"
                  disabled={busy || !reply.trim()}
                  aria-busy={busy}
                >
                  {busy ? "…" : noteMode ? "Add" : "Send"}
                </button>
              </div>
              {err && <p className="inbox-error">{err}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
