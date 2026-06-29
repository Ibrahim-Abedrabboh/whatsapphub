import { NextRequest, NextResponse } from "next/server";
import { EmbeddedSignupSchema } from "@/lib/validation";
import { completeEmbeddedSignup, EmbeddedSignupError } from "@/lib/embeddedSignup";
import { getWaConfigStatus } from "@/lib/waConfig";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/**
 * POST /api/settings/embedded-signup/complete — finish Meta's one-click flow:
 * exchange the authorization code for a long-lived token, subscribe our app to
 * the WABA, discover the phone number, and persist to the caller's client.
 */
export async function POST(req: NextRequest) {
  const parsed = EmbeddedSignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const clientId = await getClientId(req);
  try {
    const result = await completeEmbeddedSignup(parsed.data, clientId);
    return NextResponse.json({ ok: true, ...result, status: await getWaConfigStatus(clientId) });
  } catch (err) {
    const message = err instanceof EmbeddedSignupError ? err.message : "Embedded Signup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
