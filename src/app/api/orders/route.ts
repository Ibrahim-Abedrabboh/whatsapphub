import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { ORDER_STATUSES } from "@/lib/orders";

export const runtime = "nodejs";

/** GET /api/orders[?status=NEW] — this client's orders, newest first. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);

  const statusParam = req.nextUrl.searchParams.get("status");
  const status = ORDER_STATUSES.includes(statusParam as never) ? statusParam! : undefined;

  const orders = await prisma.order.findMany({
    where: { clientId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve contact names in one query (Order.contactId has no relation).
  const contactIds = [...new Set(orders.map((o) => o.contactId).filter((id): id is string => !!id))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(contacts.map((c) => [c.id, c.name]));

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      phone: o.phone,
      contactName: (o.contactId ? nameById.get(o.contactId) : null) ?? null,
      conversationId: o.conversationId,
      items: o.items,
      itemCount: o.itemCount,
      total: o.total,
      currency: o.currency,
      status: o.status,
      createdAt: o.createdAt,
    })),
  });
}
