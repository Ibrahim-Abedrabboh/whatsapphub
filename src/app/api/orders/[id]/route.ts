import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { UpdateOrderSchema } from "@/lib/validation";
import { canTransition, statusNotification, type OrderStatus } from "@/lib/orders";
import { sendText, WhatsAppError } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * PATCH /api/orders/:id — move an order through its status machine
 * (NEW → CONFIRMED → SHIPPED → DELIVERED, cancellable before shipping).
 * Unless notify=false, the customer gets a WhatsApp status message —
 * best-effort: outside the 24h window the send is skipped and reported,
 * never blocking the status change itself.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = UpdateOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({ where: { id, clientId } });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canTransition(order.status, parsed.data.status)) {
    return NextResponse.json({ error: `cannot move an order from ${order.status} to ${parsed.data.status}` }, { status: 422 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  // Customer notification (best-effort, service-window aware).
  let notified = false;
  let notifyError: string | null = null;
  if (parsed.data.notify) {
    const body = statusNotification(parsed.data.status as OrderStatus);
    try {
      const wamid = await sendText({ to: order.phone, body, clientId });
      notified = true;
      if (order.conversationId) {
        const created = await prisma.message.create({
          data: { clientId, conversationId: order.conversationId, channel: "WHATSAPP", direction: "OUT", type: "text", text: body, wamid, status: "SENT" },
        });
        await prisma.conversation.update({
          where: { id: order.conversationId },
          data: { lastMessageAt: created.createdAt, lastPreview: body },
        });
      }
    } catch (e) {
      // 131047 = outside the 24h window; anything else surfaces the same way.
      notifyError = e instanceof WhatsAppError ? e.message : "notification failed";
      console.log(`[orders] status → ${parsed.data.status} for ${order.id}; customer NOT notified: ${notifyError}`);
    }
  }

  return NextResponse.json({ order: { id: updated.id, status: updated.status }, notified, notifyError });
}
