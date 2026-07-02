import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** GET /api/quality — the client's latest number-quality snapshot, a short
 *  history, and whether sending is auto-paused (V2 M4 §2.9). */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);

  const [history, cfg] = await Promise.all([
    prisma.qualitySnapshot.findMany({
      where: { clientId },
      orderBy: { capturedAt: "desc" },
      take: 20,
      select: { qualityRating: true, messagingTier: true, capturedAt: true },
    }),
    prisma.whatsAppConfig.findUnique({ where: { clientId }, select: { sendPaused: true } }),
  ]);

  return NextResponse.json({
    latest: history[0] ?? null,
    history,
    sendPaused: cfg?.sendPaused ?? false,
  });
}
