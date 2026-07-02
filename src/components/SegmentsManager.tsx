"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

// UI row for one condition. "attr" keeps the key separate; buildRules() folds
// it into the API's "attr:<key>" field form. "optedOut" is exposed as a
// yes/no choice (isTrue / eq "false") so agents never type booleans.
interface Row {
  field: "name" | "tag" | "attr" | "optedOut";
  attrKey: string;
  op: "eq" | "neq" | "contains" | "exists";
  optedOut: "yes" | "no";
  value: string;
}

interface ApiCondition { field: string; op: string; value?: string }
interface Segment { id: string; name: string; rules: { match: "all" | "any"; conditions: ApiCondition[] } }

const OPS: { value: Row["op"]; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
];

const blankRow = (): Row => ({ field: "tag", attrKey: "", op: "eq", optedOut: "yes", value: "" });

function buildRules(match: "all" | "any", rows: Row[]): { match: "all" | "any"; conditions: ApiCondition[] } {
  const conditions = rows.map((r): ApiCondition => {
    if (r.field === "optedOut") {
      return r.optedOut === "yes" ? { field: "optedOut", op: "isTrue" } : { field: "optedOut", op: "eq", value: "false" };
    }
    const field = r.field === "attr" ? `attr:${r.attrKey.trim()}` : r.field;
    return r.op === "exists" ? { field, op: "exists" } : { field, op: r.op, value: r.value };
  });
  return { match, conditions };
}

function rowFromCondition(c: ApiCondition): Row {
  const row = blankRow();
  if (c.field === "optedOut") {
    row.field = "optedOut";
    row.optedOut = c.op === "isTrue" || c.value === "true" ? "yes" : "no";
    return row;
  }
  if (c.field.startsWith("attr:")) {
    row.field = "attr";
    row.attrKey = c.field.slice(5);
  } else {
    row.field = c.field === "name" ? "name" : "tag";
  }
  row.op = (OPS.some((o) => o.value === c.op) ? c.op : "eq") as Row["op"];
  row.value = c.value ?? "";
  return row;
}

function rowValid(r: Row): boolean {
  if (r.field === "optedOut") return true;
  if (r.field === "attr" && !r.attrKey.trim()) return false;
  return r.op === "exists" || r.value.trim().length > 0;
}

export default function SegmentsManager() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [preview, setPreview] = useState<{ matched: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/segments");
    if (r.ok) setSegments((await r.json()).segments);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const allValid = useMemo(() => rows.length > 0 && rows.every(rowValid), [rows]);

  // Live preview: debounce, then count matching contacts for the current rules.
  useEffect(() => {
    if (!allValid) { setPreview(null); return; }
    const rules = buildRules(match, rows);
    const t = setTimeout(async () => {
      const r = await apiFetch("/api/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (r.ok) { const j = await r.json(); setPreview({ matched: j.matched, total: j.total }); }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, JSON.stringify(rows), allValid]);

  function resetForm() { setEditingId(null); setName(""); setMatch("all"); setRows([blankRow()]); setPreview(null); }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const payload = { name, rules: buildRules(match, rows) };
    const r = editingId
      ? await apiFetch(`/api/segments/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await apiFetch("/api/segments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg(editingId ? "Updated." : "Created."); resetForm(); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  function edit(s: Segment) {
    setEditingId(s.id);
    setName(s.name);
    setMatch(s.rules?.match === "any" ? "any" : "all");
    const conds = Array.isArray(s.rules?.conditions) ? s.rules.conditions : [];
    setRows(conds.length ? conds.map(rowFromCondition) : [blankRow()]);
    setMsg(null);
  }

  async function remove(id: string) {
    const r = await apiFetch(`/api/segments/${id}`, { method: "DELETE" });
    if (r.ok) { if (editingId === id) resetForm(); await load(); }
  }

  return (
    <div className="grid-forms">
      <form onSubmit={save} className="card" data-test-id="segment-form">
        <h3>{editingId ? "Edit segment" : "New segment"}</h3>

        <div className="field">
          <label className="label" htmlFor="seg-name">Name</label>
          <input id="seg-name" data-test-id="segment-name" className="input" value={name}
            onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="e.g. VIPs in Riyadh" />
        </div>

        <div className="field">
          <label className="label" htmlFor="seg-match">A contact matches when</label>
          <select id="seg-match" className="input" value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")}>
            <option value="all">all conditions are true</option>
            <option value="any">any condition is true</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Conditions</label>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <select className="input" style={{ flex: "1 1 110px" }} value={r.field}
                onChange={(e) => setRow(i, { field: e.target.value as Row["field"] })}>
                <option value="tag">Tag</option>
                <option value="name">Name</option>
                <option value="attr">Attribute</option>
                <option value="optedOut">Opted out</option>
              </select>

              {r.field === "attr" && (
                <input className="input" style={{ flex: "1 1 100px" }} value={r.attrKey} placeholder="key, e.g. city"
                  onChange={(e) => setRow(i, { attrKey: e.target.value })} />
              )}

              {r.field === "optedOut" ? (
                <select className="input" style={{ flex: "1 1 90px" }} value={r.optedOut}
                  onChange={(e) => setRow(i, { optedOut: e.target.value as Row["optedOut"] })}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              ) : (
                <>
                  <select className="input" style={{ flex: "1 1 100px" }} value={r.op}
                    onChange={(e) => setRow(i, { op: e.target.value as Row["op"] })}>
                    {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {r.op !== "exists" && (
                    <input className="input" style={{ flex: "2 1 120px" }} value={r.value} placeholder="value"
                      onChange={(e) => setRow(i, { value: e.target.value })} />
                  )}
                </>
              )}

              {rows.length > 1 && (
                <button type="button" className="btn btn--ghost" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn--ghost" onClick={() => setRows((p) => [...p, blankRow()])} disabled={rows.length >= 20}>
            + Add condition
          </button>
        </div>

        <p className="note" data-test-id="segment-preview" style={{ marginTop: 4 }}>
          {preview ? `Matches ${preview.matched} of ${preview.total} opted-in contacts right now.` : allValid ? "Counting…" : "Complete the conditions to preview."}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit" data-test-id="segment-submit" disabled={busy || !allValid || !name.trim()}>
            {busy ? "Saving…" : editingId ? "Save" : "Create segment"}
          </button>
          {editingId && <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Segments</h3>
        <p className="note">Membership is dynamic — rules are re-evaluated at send time, so a segment broadcast always reaches whoever matches right then.</p>
        <table className="table" data-test-id="segments-table">
          <thead><tr><th>Name</th><th>Rules</th><th></th></tr></thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">
                  {Array.isArray(s.rules?.conditions) ? s.rules.conditions.length : 0} condition{(s.rules?.conditions?.length ?? 0) === 1 ? "" : "s"} · {s.rules?.match === "any" ? "any" : "all"}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn--ghost" onClick={() => edit(s)}>Edit</button>
                  <button type="button" className="btn btn--ghost" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {segments.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16 }}>No segments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
