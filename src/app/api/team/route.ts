import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId, getCurrentUserId } from "@/lib/users";

export const runtime = "nodejs";

/**
 * GET /api/team — the caller's client's members (id, name, email) + the caller's
 * own id (`meId`), for the inbox assignee picker + "assigned to me" filter.
 * Unlike /api/users (ADMIN-only), any authenticated agent may read this so they
 * can assign/reassign conversations.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const members = await prisma.user.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ members, meId: await getCurrentUserId(req) });
}
