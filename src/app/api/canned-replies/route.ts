import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CannedReplySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/canned-replies — this client's snippets, alphabetical. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const replies = await prisma.cannedReply.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { title: "asc" },
    select: { id: true, title: true, shortcut: true, body: true },
  });
  return NextResponse.json({ replies });
}

/** POST /api/canned-replies — create a snippet (unique title per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CannedReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  try {
    const reply = await prisma.cannedReply.create({
      data: { clientId, title: parsed.data.title, shortcut: parsed.data.shortcut ?? null, body: parsed.data.body },
      select: { id: true, title: true, shortcut: true, body: true },
    });
    return NextResponse.json({ reply }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A snippet titled "${parsed.data.title}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
