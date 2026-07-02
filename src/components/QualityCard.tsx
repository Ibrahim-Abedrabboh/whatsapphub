"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Snapshot { qualityRating: string | null; messagingTier: string | null; capturedAt: string }

const RATING_COLOR: Record<string, string> = {
  GREEN: "var(--brand-accent)",
  YELLOW: "#d9a514",
  RED: "#e5484d",
};

/** Number-quality card (V2 M4 §2.9): current Meta rating + tier, with the
 *  auto-pause state and a manual resume. Data comes from the worker's poll. */
export default function QualityCard() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [sendPaused, setSendPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/quality");
    if (r.ok) {
      const j = await r.json();
      setLatest(j.latest);
      setSendPaused(j.sendPaused);
    }
    setLoaded(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function resume() {
    setBusy(true);
    const r = await apiFetch("/api/quality/resume", { method: "POST" });
    if (r.ok) setSendPaused(false);
    setBusy(false);
  }

  // Nothing to show until the first poll has produced a snapshot (or a pause).
  if (!loaded || (!latest && !sendPaused)) return null;

  const rating = latest?.qualityRating ?? "UNKNOWN";

  return (
    <div className="card" data-test-id="quality-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Number quality</h3>
        <span className="badge" style={{ color: RATING_COLOR[rating] ?? "inherit", borderColor: "currentColor" }}>
          {rating}
        </span>
        {latest?.messagingTier && <span className="muted" style={{ fontSize: 13 }}>tier {latest.messagingTier}</span>}
        {latest && <span className="muted" style={{ fontSize: 13 }}>checked {new Date(latest.capturedAt).toLocaleString()}</span>}
      </div>
      {sendPaused && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <p className="note" style={{ margin: 0 }}>
            <strong>Sending is paused</strong> — the number&apos;s quality rating dropped to RED. Queued messages are held;
            new broadcasts are blocked. Fix the cause (spam reports, blocks) before resuming.
          </p>
          <button className="btn btn--sm" data-test-id="quality-resume" onClick={resume} disabled={busy}>
            {busy ? "Resuming…" : "Resume sending"}
          </button>
        </div>
      )}
    </div>
  );
}
