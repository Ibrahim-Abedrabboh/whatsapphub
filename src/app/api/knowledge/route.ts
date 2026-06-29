import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { KnowledgeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/knowledge — this client's FAQ/KB docs, alphabetical. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const docs = await prisma.knowledgeDoc.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { title: "asc" },
    select: { id: true, title: true, content: true, source: true },
  });
  return NextResponse.json({ docs });
}

/** POST /api/knowledge — create a KB doc (unique title per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = KnowledgeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  try {
    const doc = await prisma.knowledgeDoc.create({
      data: { clientId, title: parsed.data.title, content: parsed.data.content, source: parsed.data.source ?? null },
      select: { id: true, title: true, content: true, source: true },
    });
    return NextResponse.json({ doc }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A doc titled "${parsed.data.title}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
