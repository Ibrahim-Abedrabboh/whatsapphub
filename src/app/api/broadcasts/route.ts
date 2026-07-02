import { NextRequest, NextResponse } from "next/server";
import { CreateBroadcastSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { createAndEnqueueBroadcast } from "@/lib/broadcast";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** POST /api/broadcasts — create + enqueue (immediate or scheduled). */
export async function POST(req: NextRequest) {
  const parsed = CreateBroadcastSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { templateId, listId, segmentId, variableMap, scheduleAt, headerMediaUrl, couponCode, abTest, sendTime } = parsed.data;

  const result = await createAndEnqueueBroadcast({
    clientId: await getClientId(req),
    templateId,
    listId,
    segmentId,
    variableMap,
    scheduledAt: scheduleAt ? new Date(scheduleAt) : null,
    headerMediaUrl,
    couponCode,
    abTest,
    sendTime,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code ?? 422 });
  return NextResponse.json({
    broadcastId: result.broadcastId,
    variantBId: result.variantBId,
    queued: result.queued,
    scheduledAt: result.scheduledAt,
  });
}

/** GET /api/broadcasts — list this client's broadcasts with progress. */
export async function GET(req: NextRequest) {
  const broadcasts = await prisma.broadcast.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { template: true, list: true, segment: true },
  });
  return NextResponse.json({ broadcasts });
}
