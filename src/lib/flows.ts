// WhatsApp Flows (V2 M3 §2.5). Submission mirrors template creation. Dark until
// the Meta app has Flows access — submitFlow surfaces Meta's error verbatim.

import { getWaConfig } from "./waConfig";

/** Minimal structural check of a Flow JSON definition. Pure (unit-tested). */
export function validateFlowDefinition(def: unknown): { ok: boolean; error?: string } {
  if (typeof def !== "object" || def === null || Array.isArray(def)) {
    return { ok: false, error: "definition must be a JSON object" };
  }
  const screens = (def as Record<string, unknown>).screens;
  if (!Array.isArray(screens) || screens.length === 0) {
    return { ok: false, error: "definition needs a non-empty 'screens' array" };
  }
  return { ok: true };
}

/** Create the Flow on Meta (name + category); the flow_json is uploaded as an
 *  asset in a follow-up once Flows access is granted. Returns the Meta flow id. */
export async function submitFlow(clientId: string, name: string): Promise<{ metaId: string }> {
  const cfg = await getWaConfig(clientId);
  const res = await fetch(`https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.businessAccountId}/flows`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, categories: ["OTHER"] }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) throw new Error(json.error?.message ?? `Flow submit failed (${res.status})`);
  return { metaId: json.id };
}
