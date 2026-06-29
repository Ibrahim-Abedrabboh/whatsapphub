"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

// ── minimal Facebook JS SDK typings (the SDK ships no types) ──
interface FBLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}
interface FBSdk {
  init(opts: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
  login(cb: (resp: FBLoginResponse) => void, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    FB?: FBSdk;
    fbAsyncInit?: () => void;
  }
}

interface PublicConfig {
  available: boolean;
  appId: string;
  configId: string;
  graphApiVersion: string;
}
interface SessionInfo {
  phoneNumberId?: string;
  wabaId?: string;
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";

/** Load + init the Facebook JS SDK once, resolving when window.FB is ready. */
function loadFbSdk(appId: string, version: string): Promise<FBSdk> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      if (window.FB) resolve(window.FB);
      else reject(new Error("Facebook SDK failed to initialise"));
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.src = SDK_SRC;
      s.onerror = () => reject(new Error("Could not load the Facebook SDK"));
      document.body.appendChild(s);
    }
  });
}

export default function EmbeddedSignup({ onConnected }: { onConnected?: () => void }) {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [autoConnected, setAutoConnected] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const sessionRef = useRef<SessionInfo>({});

  // Load the public flow config + current connection status.
  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        apiFetch("/api/settings/embedded-signup/config"),
        apiFetch("/api/settings/whatsapp"),
      ]);
      if (cRes.ok) setCfg(await cRes.json());
      if (sRes.ok) {
        const s = await sRes.json();
        setAutoConnected(Boolean(s.wabaAutoConnected));
        setPhoneNumberId(s.phoneNumberId ?? "");
      }
    })();
  }, []);

  // Meta posts the selected phone_number_id + waba_id via window.postMessage.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!/facebook\.com$/.test(new URL(ev.origin).hostname) && !ev.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data.data) {
          sessionRef.current = {
            phoneNumberId: data.data.phone_number_id,
            wabaId: data.data.waba_id,
          };
        }
      } catch {
        /* non-JSON messages from other senders — ignore */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const connect = useCallback(async () => {
    if (!cfg?.available) return;
    setMsg(null);
    setBusy(true);
    sessionRef.current = {};
    try {
      const FB = await loadFbSdk(cfg.appId, cfg.graphApiVersion);
      const resp = await new Promise<FBLoginResponse>((resolve) => {
        FB.login((r) => resolve(r), {
          config_id: cfg.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
        });
      });

      const code = resp.authResponse?.code;
      const { wabaId, phoneNumberId: pnId } = sessionRef.current;
      if (!code || !wabaId) {
        setBusy(false);
        setMsg({ kind: "err", text: "Sign-up was cancelled before a WhatsApp account was selected." });
        return;
      }

      const done = await apiFetch("/api/settings/embedded-signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wabaId, ...(pnId ? { phoneNumberId: pnId } : {}) }),
      });
      const j = await done.json().catch(() => ({}));
      setBusy(false);
      if (done.ok && j.ok) {
        setAutoConnected(true);
        setPhoneNumberId(j.phoneNumberId ?? "");
        const label = j.verifiedName || j.displayPhoneNumber || j.phoneNumberId;
        setMsg({ kind: "ok", text: `Connected ✓ ${label}`.trim() });
        onConnected?.();
      } else {
        setMsg({ kind: "err", text: j.error ?? `Error ${done.status}` });
      }
    } catch (err) {
      setBusy(false);
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Connection failed" });
    }
  }, [cfg, onConnected]);

  // Hidden entirely when the server can't offer the flow — the manual form below
  // remains the fallback path.
  if (cfg && !cfg.available) return null;

  return (
    <div className="card" style={{ maxWidth: 680, marginBottom: 16 }}>
      <h3>Connect WhatsApp in one click</h3>
      <p className="note" style={{ margin: "0 0 16px" }}>
        Use Meta&rsquo;s secure sign-up to link your WhatsApp Business account — no phone number ID, token, or
        app secret to copy. {autoConnected && phoneNumberId && (
          <>Currently connected (phone number ID <code>{phoneNumberId}</code>).</>
        )}
      </p>
      <div className="row">
        <button
          className="btn"
          type="button"
          onClick={connect}
          disabled={!cfg || busy}
          aria-busy={busy}
          data-test-id="es-connect"
        >
          {busy ? "Connecting…" : autoConnected ? "Reconnect WhatsApp" : "Connect WhatsApp"}
        </button>
        {msg && (
          <span
            className="note"
            data-test-id="es-result"
            style={{ color: msg.kind === "ok" ? "var(--green)" : "var(--danger)" }}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
