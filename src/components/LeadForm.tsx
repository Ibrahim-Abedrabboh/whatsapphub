"use client";

import { useState } from "react";

/** Bilingual span pair — CSS shows one side based on <html lang> (landing pattern). */
function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

/**
 * Public lead-capture form on the landing page (#get-started). Posts to the
 * unauthenticated /api/leads endpoint; `website` is a honeypot field bots
 * fill and humans never see.
 */
export default function LeadForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailed(false);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, business: business.trim() || undefined, website }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setDone(true);
    else setFailed(true);
  }

  if (done) {
    return (
      <p className="dk-lead-form__ok" data-test-id="lead-done">
        <T en="Got it — we'll message you on WhatsApp shortly. 💬" ar="وصلنا طلبك — سنراسلك على واتساب قريبًا. 💬" />
      </p>
    );
  }

  return (
    <form className="dk-lead-form" data-test-id="lead-form" onSubmit={onSubmit}>
      <input
        className="dk-input" data-test-id="lead-name" value={name} maxLength={120} required
        placeholder="Name · الاسم" onChange={(e) => setName(e.target.value)}
      />
      <input
        className="dk-input" data-test-id="lead-phone" value={phone} inputMode="tel" dir="ltr" required
        placeholder="WhatsApp · 9665xxxxxxxx" onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="dk-input" data-test-id="lead-business" value={business} maxLength={120}
        placeholder="Business (optional) · اسم النشاط (اختياري)" onChange={(e) => setBusiness(e.target.value)}
      />
      {/* Honeypot: off-screen, skipped by keyboard + screen readers, still posted. */}
      <input
        className="dk-lead-form__hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={website} onChange={(e) => setWebsite(e.target.value)}
      />
      <button
        className="dk-btn dk-btn--primary" type="submit" data-test-id="lead-submit"
        disabled={busy || !name.trim() || !phone.trim()} aria-busy={busy}
      >
        {busy
          ? <T en="Sending…" ar="جارٍ الإرسال…" />
          : <T en="Message me on WhatsApp" ar="راسلوني على واتساب" />}
      </button>
      {failed && (
        <p className="dk-lead-form__err" data-test-id="lead-error">
          <T
            en="Check the number (international format, e.g. 9665xxxxxxxx) and try again."
            ar="تحقّق من الرقم بالصيغة الدولية (مثل 9665xxxxxxxx) وحاول مجددًا."
          />
        </p>
      )}
    </form>
  );
}
