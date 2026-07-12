import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CreateChatbotSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/chatbots — this client's bots, most-recently-updated first. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const chatbots = await prisma.chatbot.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, updatedAt: true },
  });
  return NextResponse.json({ chatbots });
}

/** POST /api/chatbots — create a bot (unique name per client). */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CreateChatbotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  try {
    const chatbot = await prisma.chatbot.create({
      data: { clientId, name: parsed.data.name, status: parsed.data.status, flow: parsed.data.flow as Prisma.InputJsonValue },
      select: { id: true, name: true, status: true },
    });
    return NextResponse.json({ chatbot }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A chatbot named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
