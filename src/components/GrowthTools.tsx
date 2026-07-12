"use client";

import { useState } from "react";
import { normalizeWaNumber, waMeLink, widgetSnippet } from "@/lib/growth";

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard blocked — user can select manually */ }
  }
  return (
    <button type="button" className="btn btn--ghost" style={{ minHeight: small ? 30 : 40, padding: small ? "3px 12px" : "8px 16px", fontSize: small ? 12 : 14 }} onClick={() => void copy()}>
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

export default function GrowthTools() {
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("Chat with us on WhatsApp");

  const digits = normalizeWaNumber(number);
  const ready = digits.length >= 8;
  const link = ready ? waMeLink(number, message) : "";
  const snippet = ready ? widgetSnippet(number, message, label) : "";
  const qrUrl = ready ? `/api/growth/qr?data=${encodeURIComponent(link)}` : "";

  return (
    <div className="grid-forms">
      {/* Inputs */}
      <div className="card">
        <h3>Your details</h3>
        <div className="field">
          <label className="label" htmlFor="growth-number">WhatsApp number (with country code)</label>
          <input id="growth-number" className="input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+966 50 000 0000" inputMode="tel" data-test-id="growth-number" />
        </div>
        <div className="field">
          <label className="label" htmlFor="growth-message">Pre-filled first message (optional)</label>
          <textarea id="growth-message" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! I'd like to ask about…" />
        </div>
        <div className="field">
          <label className="label" htmlFor="growth-label">Website button label</label>
          <input id="growth-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        </div>
        {!ready && <p className="note">Enter your full number with country code to generate your link, QR, and button.</p>}
      </div>

      {/* Outputs */}
      <div className="card">
        <h3>Your growth tools</h3>

        {ready ? (
          <>
            {/* Link */}
            <div className="field">
              <label className="label">Click-to-chat link</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <a href={link} target="_blank" rel="noopener noreferrer" className="input" style={{ flex: "1 1 220px", wordBreak: "break-all", textDecoration: "none", display: "block" }} data-test-id="growth-link">{link}</a>
                <CopyButton text={link} />
              </div>
            </div>

            {/* QR */}
            <div className="field">
              <label className="label">QR code (print it on flyers, tables, receipts)</label>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="WhatsApp QR code" width={160} height={160} style={{ borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "#FFFCF3" }} />
                <a className="btn btn--ghost" href={qrUrl} download="whatsapp-qr.svg" style={{ textDecoration: "none" }}>Download QR (SVG)</a>
              </div>
            </div>

            {/* Widget */}
            <div className="field">
              <label className="label">Website button — paste before <code>&lt;/body&gt;</code></label>
              <textarea className="input" readOnly rows={6} value={snippet} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} onFocus={(e) => e.currentTarget.select()} data-test-id="growth-widget" />
              <div style={{ marginTop: 8 }}><CopyButton text={snippet} small /></div>
              <p className="note" style={{ marginTop: 8 }}>Adds a floating green WhatsApp button to the bottom-right of any web page.</p>
            </div>
          </>
        ) : (
          <p className="muted">Your link, QR code, and website button will appear here.</p>
        )}
      </div>
    </div>
  );
}
