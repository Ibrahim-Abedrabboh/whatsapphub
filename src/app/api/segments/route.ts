import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { SegmentSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/segments — this client's segments, alphabetical. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const segments = await prisma.segment.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rules: true, updatedAt: true },
  });
  return NextResponse.json({ segments });
}

/** POST /api/segments — create a segment (unique name per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = SegmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  try {
    const segment = await prisma.segment.create({
      data: { clientId, name: parsed.data.name, rules: parsed.data.rules },
      select: { id: true, name: true, rules: true, updatedAt: true },
    });
    return NextResponse.json({ segment }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A segment named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
