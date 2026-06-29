import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/users";
import { isAiConfigured } from "@/lib/ai";

export const runtime = "nodejs";

/** GET /api/ai/status — whether AI assist is configured (drives the inbox UI gate). */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ configured: isAiConfigured() });
}
