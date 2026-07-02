import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** POST /api/quality/resume — manually clear the auto-pause flag (V2 M4 §2.9).
 *  The poller may re-pause on its next tick if the rating is still RED. */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);

  await prisma.whatsAppConfig.updateMany({ where: { clientId }, data: { sendPaused: false } });
  return NextResponse.json({ ok: true, sendPaused: false });
}
