// Growth tools (V2 §2.x): build click-to-WhatsApp (wa.me) links, a QR of that
// link, and a copy-paste website widget. Pure helpers — no DB/IO. The operator
// types their WhatsApp number; wa.me needs the E.164 digits (no + / spaces).

/** Reduce any phone input to bare digits (wa.me links use digits only). */
export function normalizeWaNumber(input: string): string {
  return input.replace(/\D/g, "");
}

/** https://wa.me/<digits>[?text=<encoded message>] */
export function waMeLink(number: string, message?: string): string {
  const n = normalizeWaNumber(number);
  const base = `https://wa.me/${n}`;
  const text = message?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** A self-contained floating WhatsApp button the client pastes onto their site. */
export function widgetSnippet(number: string, message: string | undefined, label = "Chat with us on WhatsApp"): string {
  const href = waMeLink(number, message);
  const safeLabel = label.replace(/"/g, "&quot;");
  return [
    `<a href="${href}" target="_blank" rel="noopener" aria-label="${safeLabel}"`,
    `   style="position:fixed;bottom:24px;right:20px;z-index:9999;display:flex;align-items:center;justify-content:center;`,
    `width:60px;height:60px;border-radius:100px;background:#25D366;box-shadow:0 4px 12px rgba(0,0,0,.15);">`,
    `  <svg viewBox="0 0 32 32" width="32" height="32" fill="#fff" aria-hidden="true">`,
    `    <path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.9 1 .9-4.8-.2-.4A9.7 9.7 0 0 1 6.2 15C6.2 9.6 10.6 5.2 16 5.2S25.8 9.6 25.8 15 21.4 24.8 16 24.8zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-1.8-.9-3-1.6-4.2-3.6-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.3 5.3 4.7.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"/>`,
    `  </svg>`,
    `</a>`,
  ].join("\n");
}
