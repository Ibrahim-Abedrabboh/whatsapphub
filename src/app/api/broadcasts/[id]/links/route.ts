import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { clickStats } from "@/lib/shortLinks";

export const runtime = "nodejs";

/** GET /api/broadcasts/:id/links — the broadcast's tracked links + click stats. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const clientId = await getClientId(req);

  const broadcast = await prisma.broadcast.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!broadcast) return NextResponse.json({ error: "not found" }, { status: 404 });

  const links = await prisma.shortLink.findMany({
    where: { broadcastId: id, clientId },
    include: { clicks: { select: { contactId: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    links: links.map((l) => ({
      code: l.code,
      targetUrl: l.targetUrl,
      ...clickStats(l.clicks),
    })),
  });
}
