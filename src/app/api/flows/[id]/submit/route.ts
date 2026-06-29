import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { submitFlow } from "@/lib/flows";

export const runtime = "nodejs";

/** POST /api/flows/:id/submit — submit a flow to Meta. Dark until the Meta app
 *  has Flows access (Meta's error is surfaced); on success stores metaId + PENDING. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const flow = await prisma.flow.findFirst({ where: { id, clientId }, select: { id: true, name: true } });
  if (!flow) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const { metaId } = await submitFlow(clientId, flow.name);
    const updated = await prisma.flow.update({
      where: { id },
      data: { metaId, status: "PENDING" },
      select: { id: true, name: true, definition: true, metaId: true, status: true },
    });
    return NextResponse.json({ flow: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "submit failed" }, { status: 502 });
  }
}
