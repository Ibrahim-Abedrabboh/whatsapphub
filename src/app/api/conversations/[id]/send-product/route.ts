import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId, getCurrentUserId } from "@/lib/users";
import { SendProductSchema } from "@/lib/validation";
import { WhatsAppError, buildProductPayload, buildProductListPayload, sendInteractive } from "@/lib/whatsapp";
import { productListSections } from "@/lib/commerce";
import { autoAssignee, isFirstResponse } from "@/lib/conversationStatus";

export const runtime = "nodejs";

/**
 * POST /api/conversations/:id/send-product — send catalog product(s) into a
 * WhatsApp thread (V2 M5 §2.10). One product → interactive `product`; more →
 * `product_list`. Same 24h-window rule as free-text (Meta enforces; we surface).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = SendProductSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const convo = await prisma.conversation.findFirst({
    where: { id, clientId },
    select: { id: true, phone: true, channel: true, assignedToId: true, firstResponseAt: true, lastInboundAt: true },
  });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (convo.channel !== "WHATSAPP") {
    return NextResponse.json({ error: "product messages are WhatsApp-only" }, { status: 422 });
  }

  const catalog = await prisma.commerceCatalog.findUnique({ where: { clientId } });
  if (!catalog) return NextResponse.json({ error: "connect a catalog first (Settings → Commerce)" }, { status: 422 });

  // Only send products we know exist (synced) — a typo'd retailer id would
  // render a broken card on the customer's phone.
  const products = await prisma.product.findMany({
    where: { clientId, retailerId: { in: parsed.data.retailerIds } },
    select: { retailerId: true, name: true, priceText: true },
  });
  if (products.length === 0) {
    return NextResponse.json({ error: "none of those products are in the synced catalog — run a sync?" }, { status: 422 });
  }

  const ids = products.map((p) => p.retailerId);
  const payload =
    ids.length === 1
      ? buildProductPayload({ to: convo.phone, catalogId: catalog.metaCatalogId, retailerId: ids[0]!, bodyText: parsed.data.body })
      : buildProductListPayload({
          to: convo.phone,
          catalogId: catalog.metaCatalogId,
          headerText: "Products",
          bodyText: parsed.data.body?.trim() || `${ids.length} products for you`,
          sections: productListSections(ids),
        });

  let wamid: string;
  try {
    wamid = await sendInteractive(payload as unknown as Record<string, unknown>, clientId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    const code = e instanceof WhatsAppError ? e.status : 502;
    return NextResponse.json({ error: message }, { status: code });
  }

  const preview =
    ids.length === 1
      ? `🛍 ${products[0]!.name}${products[0]!.priceText ? ` — ${products[0]!.priceText}` : ""}`
      : `🛍 ${ids.length} products: ${products.slice(0, 3).map((p) => p.name).join(", ")}${ids.length > 3 ? "…" : ""}`;

  const created = await prisma.message.create({
    data: { clientId, conversationId: id, channel: convo.channel, direction: "OUT", type: "product", text: preview, wamid, status: "SENT" },
  });
  const newAssignee = autoAssignee(convo.assignedToId, await getCurrentUserId(req));
  await prisma.conversation.update({
    where: { id },
    data: {
      lastMessageAt: created.createdAt, lastPreview: preview, unread: 0,
      ...(newAssignee ? { assignedToId: newAssignee } : {}),
      ...(isFirstResponse(convo.firstResponseAt, convo.lastInboundAt) ? { firstResponseAt: created.createdAt } : {}),
    },
  });

  return NextResponse.json({
    message: { id: created.id, direction: "OUT", type: "product", text: preview, status: "SENT", createdAt: created.createdAt },
    sent: ids.length,
  }, { status: 201 });
}
