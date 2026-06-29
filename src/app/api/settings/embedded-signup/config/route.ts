import { NextResponse } from "next/server";
import { getEmbeddedSignupPublicConfig } from "@/lib/embeddedSignup";

export const runtime = "nodejs";

/**
 * GET /api/settings/embedded-signup/config — non-secret config the browser
 * needs to launch Meta's Embedded Signup popup (app id, configuration id,
 * Graph version) and whether the flow is available on this server.
 */
export async function GET() {
  return NextResponse.json(getEmbeddedSignupPublicConfig());
}
