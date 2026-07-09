"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface List { id: string; name: string }
interface Segment { id: string; name: string }
interface Template { id: string; name: string; language: string; variableCount: number; headerFormat?: string | null; copyCode?: boolean }

export default function BroadcastForm({ lists, segments = [], templates }: { lists: List[]; segments?: Segment[]; templates: Template[] }) {
  const [templateId, setTemplateId] = useState("");
  // Audience encoded as "list:<id>" | "segment:<id>" so one select covers both.
  const [audience, setAudience] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [abEnabled, setAbEnabled] = useState(false);
  const [templateBId, setTemplateBId] = useState("");
  const [splitPercent, setSplitPercent] = useState(50);
  const [stEnabled, setStEnabled] = useState(false);
  const [targetLocal, setTargetLocal] = useState("09:00");
  const [tzAttr, setTzAttr] = useState("tz");
  const [defaultTz, setDefaultTz] = useState("");
  const [trackedUrl, setTrackedUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => templates.find((t) => t.id === templateId), [templateId, templates]);
  const mediaHeader = !!selected && ["IMAGE", "DOCUMENT", "VIDEO"].includes(selected.headerFormat ?? "");
  const needsCoupon = !!selected?.copyCode;
  // Variant B candidates: same variable count as A (the one variableMap feeds both).
  const bCandidates = useMemo(
    () => (selected ? templates.filter((t) => t.id !== selected.id && t.variableCount === selected.variableCount) : []),
    [selected, templates],
  );

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setVars(Array(t?.variableCount ?? 0).fill(""));
    setHeaderMediaUrl("");
    setCouponCode("");
    setTemplateBId(""); // variant B depends on A's variable count
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const variableMap = vars.map((v) => (v.startsWith("field:") ? { from: v.slice(6).trim() } : { literal: v }));
    const body: Record<string, unknown> = { templateId, variableMap };
    if (audience.startsWith("segment:")) body.segmentId = audience.slice(8);
    else body.listId = audience.slice(5);
    if (mediaHeader && headerMediaUrl.trim()) body.headerMediaUrl = headerMediaUrl.trim();
    if (needsCoupon && couponCode.trim()) body.couponCode = couponCode.trim();
    if (scheduleAt) body.scheduleAt = new Date(scheduleAt).toISOString();
    if (abEnabled && templateBId) body.abTest = { templateBId, splitPercent };
    if (trackedUrl.trim()) body.trackedUrl = trackedUrl.trim();
    if (stEnabled && targetLocal) {
      body.sendTime = { targetLocal, tzAttr: tzAttr.trim() || "tz", ...(defaultTz.trim() ? { defaultTz: defaultTz.trim() } : {}) };
    }

    const res = await apiFetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(
      res.ok
        ? j.scheduledAt
          ? `Scheduled ${j.queued} messages for ${new Date(j.scheduledAt).toLocaleString()}${j.variantBId ? " across variants A + B" : ""}.`
          : `Queued ${j.queued} messages now${j.variantBId ? " across variants A + B" : ""}.`
        : `Error: ${j.error ?? res.status}`,
    );
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3>New broadcast</h3>

      <div className="field">
        <label className="label" htmlFor="tpl">Template (approved only)</label>
        <select id="tpl" data-test-id="bc-template" className="input" value={templateId} onChange={(e) => onTemplateChange(e.target.value)} required>
          <option value="">— choose —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language}) · {t.variableCount} vars</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="lst">Audience — a list or a dynamic segment</label>
        <select id="lst" data-test-id="bc-list" className="input" value={audience} onChange={(e) => setAudience(e.target.value)} required>
          <option value="">— choose —</option>
          <optgroup label="Lists">
            {lists.map((l) => <option key={l.id} value={`list:${l.id}`}>{l.name}</option>)}
          </optgroup>
          {segments.length > 0 && (
            <optgroup label="Segments (matched at send time)">
              {segments.map((s) => <option key={s.id} value={`segment:${s.id}`}>{s.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {mediaHeader && (
        <div className="field">
          <label className="label" htmlFor="bc-hdr">
            Header media URL <span className="muted">— this template has a {selected?.headerFormat?.toLowerCase()} header</span>
          </label>
          <input id="bc-hdr" data-test-id="bc-header-media" className="input" type="url" value={headerMediaUrl}
            onChange={(e) => setHeaderMediaUrl(e.target.value)}
            placeholder="https://… (public link to the image/PDF/video)" required />
        </div>
      )}

      {needsCoupon && (
        <div className="field">
          <label className="label" htmlFor="bc-coupon">
            Coupon code <span className="muted">— this template has a copy-code button</span>
          </label>
          <input id="bc-coupon" data-test-id="bc-coupon" className="input" value={couponCode}
            maxLength={15} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. SAVE20" required />
        </div>
      )}

      {selected && selected.variableCount > 0 && (
        <div className="field">
          <label className="label" htmlFor="bc-var-1">
            Template variables — literal text, or <code>field:name</code> / <code>field:city</code> to pull per-contact
          </label>
          {vars.map((v, i) => (
            <input key={i} id={`bc-var-${i + 1}`} data-test-id={`bc-var-${i + 1}`} className="input" placeholder={`{{${i + 1}}}`}
              value={v} onChange={(e) => setVars((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
              style={{ marginBottom: 8 }} />
          ))}
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="sch">Schedule (optional — blank = send now)</label>
        <input id="sch" data-test-id="bc-schedule" className="input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
      </div>

      <div className="field">
        <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" data-test-id="bc-ab" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} disabled={!selected} />
          A/B test — send a second template to part of the audience
        </label>
        {abEnabled && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <select className="input" data-test-id="bc-ab-template" style={{ flex: "2 1 200px" }} value={templateBId}
              onChange={(e) => setTemplateBId(e.target.value)} required>
              <option value="">— template B ({selected?.variableCount ?? 0} vars, like A) —</option>
              {bCandidates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
            </select>
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 130px" }}>
              <input className="input" data-test-id="bc-ab-split" type="number" min={1} max={99} value={splitPercent}
                onChange={(e) => setSplitPercent(Math.min(99, Math.max(1, Number(e.target.value) || 50)))} style={{ width: 80 }} />
              % get A
            </label>
            {bCandidates.length === 0 && selected && (
              <p className="note" style={{ flexBasis: "100%", margin: 0 }}>
                No other approved template has {selected.variableCount} variables — variant B must take the same variables as A.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="bc-tracked-url">
          Tracked link <span className="muted">(optional — counts URL-button clicks)</span>
        </label>
        <input id="bc-tracked-url" data-test-id="bc-tracked-url" className="input" type="url" value={trackedUrl}
          onChange={(e) => setTrackedUrl(e.target.value)} placeholder="https://your-site.com/offer" />
        {trackedUrl.trim() && (
          <p className="note" style={{ marginTop: 6 }}>
            The template&apos;s first button must be a <strong>URL button ending in {"{{1}}"}</strong> that points at this
            app&apos;s <code>/r/{"{{1}}"}</code> route. Recipients are redirected to this URL and each click is counted.
          </p>
        )}
      </div>

      <div className="field">
        <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" data-test-id="bc-sendtime" checked={stEnabled} onChange={(e) => setStEnabled(e.target.checked)} />
          Send-time optimization — deliver at a local time per contact
        </label>
        {stEnabled && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" data-test-id="bc-sendtime-target" type="time" value={targetLocal}
              onChange={(e) => setTargetLocal(e.target.value)} style={{ flex: "0 1 130px" }} required />
            <span className="muted" style={{ fontSize: 13 }}>local time, read from attribute</span>
            <input className="input" data-test-id="bc-sendtime-attr" value={tzAttr} maxLength={60}
              onChange={(e) => setTzAttr(e.target.value)} placeholder="tz" style={{ flex: "0 1 120px" }} />
            <label className="label" style={{ flexBasis: "100%", margin: "4px 0 0" }} htmlFor="bc-default-tz">
              Timezone for everyone else <span className="muted">(optional — offset like <code>+3</code> or a name like <code>Asia/Riyadh</code>)</span>
            </label>
            <input id="bc-default-tz" className="input" data-test-id="bc-sendtime-default-tz" value={defaultTz} maxLength={64}
              onChange={(e) => setDefaultTz(e.target.value)} placeholder="e.g. Asia/Riyadh" style={{ flex: "1 1 200px" }} />
            <p className="note" style={{ flexBasis: "100%", margin: 0 }}>
              A contact&apos;s own timezone attribute wins (offset or name, e.g. <code>tz=+3</code> or <code>tz=Europe/Berlin</code>).
              This manual timezone covers contacts without one; leave both empty and they send on the normal schedule.
            </p>
          </div>
        )}
      </div>

      <button data-test-id="bc-submit" className="btn" type="submit"
        disabled={busy || !templateId || !audience || (mediaHeader && !headerMediaUrl.trim()) || (needsCoupon && !couponCode.trim()) || (abEnabled && !templateBId) || (stEnabled && !targetLocal)} aria-busy={busy}>
        {busy ? "Submitting…" : scheduleAt ? "Schedule broadcast" : "Send now"}
      </button>
      {msg && <p data-test-id="bc-result" className="note" style={{ marginTop: 10 }}>{msg}</p>}
    </form>
  );
}
