import { env } from "./env";
import { DEFAULT_CLIENT_ID } from "./tenancy";
import { getWaConfig, markWabaAutoConnected, saveWaConfig } from "./waConfig";

/**
 * Meta Embedded Signup (V2 M1) — one-click WhatsApp onboarding.
 *
 * Flow: the browser launches Meta's Embedded Signup popup (Facebook JS SDK),
 * which returns an authorization `code` plus the selected `waba_id` /
 * `phone_number_id`. This module exchanges the code for a long-lived
 * system-user token server-side, subscribes our app to the WABA's webhooks,
 * discovers the phone number when not supplied, and persists everything to the
 * per-client WhatsAppConfig — so the client never copy-pastes an id or token.
 *
 * The URL builders and response parsers are pure so they can be unit-tested
 * without touching the network; only `completeEmbeddedSignup` does I/O.
 */

const GRAPH = "https://graph.facebook.com";

export class EmbeddedSignupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddedSignupError";
  }
}

// ── platform config ────────────────────────────────────────────────
// The Meta app that runs Embedded Signup is platform-level (one app, many
// tenants), so its id/secret come from env, never from a client's row.

export interface EmbeddedSignupPublicConfig {
  available: boolean;
  appId: string;
  configId: string;
  graphApiVersion: string;
}

/** App id used by the flow: the dedicated ES app id, falling back to WA_APP_ID. */
export function platformAppId(): string {
  return env.META_APP_ID || env.WA_APP_ID || "";
}

/** Non-secret config the browser needs to launch the popup. */
export function getEmbeddedSignupPublicConfig(): EmbeddedSignupPublicConfig {
  const appId = platformAppId();
  const configId = env.META_CONFIG_ID || "";
  return {
    available: Boolean(appId && configId && env.META_APP_SECRET),
    appId,
    configId,
    graphApiVersion: env.GRAPH_API_VERSION,
  };
}

// ── pure helpers (unit-tested) ─────────────────────────────────────

/** OAuth code→token exchange endpoint (uses the PLATFORM app credentials). */
export function tokenExchangeUrl(
  ver: string,
  appId: string,
  appSecret: string,
  code: string,
): string {
  const qs = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });
  return `${GRAPH}/${ver}/oauth/access_token?${qs.toString()}`;
}

/** A WABA's phone numbers (to auto-discover the phone number id). */
export function phoneNumbersUrl(ver: string, wabaId: string): string {
  const qs = new URLSearchParams({ fields: "id,display_phone_number,verified_name" });
  return `${GRAPH}/${ver}/${encodeURIComponent(wabaId)}/phone_numbers?${qs.toString()}`;
}

/** Subscribe our app to a WABA so its webhooks reach us. */
export function subscribedAppsUrl(ver: string, wabaId: string): string {
  return `${GRAPH}/${ver}/${encodeURIComponent(wabaId)}/subscribed_apps`;
}

export interface TokenResult {
  accessToken: string;
  /** null = long-lived / no expiry reported by Graph. */
  tokenExpiresAt: Date | null;
}

/** Parse the oauth/access_token response. Throws on a Graph error / missing token. */
export function parseTokenResponse(json: unknown, nowMs: number = Date.now()): TokenResult {
  const obj = (json ?? {}) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (obj.error) throw new EmbeddedSignupError(obj.error.message || "Token exchange failed");
  if (!obj.access_token) throw new EmbeddedSignupError("Meta did not return an access token");
  const expiresIn = typeof obj.expires_in === "number" && obj.expires_in > 0 ? obj.expires_in : null;
  return {
    accessToken: obj.access_token,
    tokenExpiresAt: expiresIn ? new Date(nowMs + expiresIn * 1000) : null,
  };
}

export interface DiscoveredPhone {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

/** Pick the first phone number from a /phone_numbers response (null if none). */
export function pickPhoneNumber(json: unknown): DiscoveredPhone | null {
  const data = (json as { data?: Array<Record<string, unknown>> } | null)?.data;
  const first = Array.isArray(data) ? data[0] : undefined;
  if (!first || typeof first.id !== "string") return null;
  return {
    phoneNumberId: first.id,
    displayPhoneNumber: typeof first.display_phone_number === "string" ? first.display_phone_number : null,
    verifiedName: typeof first.verified_name === "string" ? first.verified_name : null,
  };
}

// ── orchestrator (network) ─────────────────────────────────────────

export interface CompleteInput {
  code: string;
  wabaId: string;
  /** Optional — discovered from the WABA when the popup didn't supply it. */
  phoneNumberId?: string;
}

export interface CompleteResult {
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  tokenExpiresAt: string | null;
  subscribed: boolean;
}

/**
 * Run the full server-side Embedded Signup exchange and persist the result to
 * the given client's WhatsAppConfig. Throws EmbeddedSignupError on failure.
 */
export async function completeEmbeddedSignup(
  input: CompleteInput,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<CompleteResult> {
  const { appId, available, graphApiVersion: ver } = getEmbeddedSignupPublicConfig();
  if (!available) {
    throw new EmbeddedSignupError("Embedded Signup is not configured on this server.");
  }
  const appSecret = env.META_APP_SECRET;

  // 1) Exchange the authorization code for a long-lived system-user token.
  const tokenRes = await fetch(tokenExchangeUrl(ver, appId, appSecret, input.code)).catch(() => null);
  if (!tokenRes) throw new EmbeddedSignupError("Could not reach Meta to exchange the code.");
  const { accessToken, tokenExpiresAt } = parseTokenResponse(await tokenRes.json().catch(() => ({})));

  // 2) Subscribe our app to the WABA's webhooks (best-effort; report the result).
  let subscribed = false;
  try {
    const subRes = await fetch(subscribedAppsUrl(ver, input.wabaId), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const subJson = (await subRes.json().catch(() => ({}))) as { success?: boolean };
    subscribed = subRes.ok && subJson.success !== false;
  } catch {
    subscribed = false;
  }

  // 3) Resolve the phone number id (discover from the WABA when not supplied).
  let phoneNumberId = input.phoneNumberId?.trim() || "";
  let displayPhoneNumber: string | null = null;
  let verifiedName: string | null = null;
  if (!phoneNumberId) {
    const pnRes = await fetch(phoneNumbersUrl(ver, input.wabaId), {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    const picked = pnRes ? pickPhoneNumber(await pnRes.json().catch(() => ({}))) : null;
    if (!picked) {
      throw new EmbeddedSignupError("Connected the account, but no phone number was found on the WABA.");
    }
    phoneNumberId = picked.phoneNumberId;
    displayPhoneNumber = picked.displayPhoneNumber;
    verifiedName = picked.verifiedName;
  }

  // 4) Persist credentials + mark the connection as auto-connected.
  await saveWaConfig(
    {
      phoneNumberId,
      businessAccountId: input.wabaId,
      appId,
      appSecret,
      accessToken,
      graphApiVersion: ver,
    },
    clientId,
  );
  await markWabaAutoConnected(clientId, { tokenExpiresAt });

  return {
    phoneNumberId,
    businessAccountId: input.wabaId,
    displayPhoneNumber,
    verifiedName,
    tokenExpiresAt: tokenExpiresAt?.toISOString() ?? null,
    subscribed,
  };
}

// Re-exported so callers can read the effective config after connecting.
export { getWaConfig };
