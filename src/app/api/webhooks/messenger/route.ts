import { NextRequest, NextResponse } from "next/server";
import { getClientByPageAsset, isMessengerVerifyToken } from "@/lib/pageConfig";
import { MessengerWebhookSchema } from "@/lib/validation";
import { verifyWebhookSignature } from "@/lib/webhookSig";
import { recordInboundMessage } from "@/lib/conversations";
import { normalizeMessengerInbound } from "@/lib/channels/messenger";

export const runtime = "nodejs";

/** GET — Meta webhook verification handshake for Messenger (object=page). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && (await isMessengerVerifyToken(p.get("hub.verify_token") ?? ""))) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * POST — inbound Messenger messages. Signature-verified per client. Dark until a
 * ChannelConnection(channel="MESSENGER") exists: with no connection, the page
 * lookup returns null and we ack-and-ignore (Meta still expects a 200).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  let assetId: string | undefined;
  try {
    assetId = JSON.parse(raw)?.entry?.[0]?.id;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const routed = assetId ? await getClientByPageAsset(String(assetId)) : null;
  if (!routed) return NextResponse.json({ ok: true }); // not connected → ack & ignore
  if (!verifyWebhookSignature(routed.appSecret, raw, sig)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const parsed = MessengerWebhookSchema.safeParse(JSON.parse(raw));
  if (!parsed.success || parsed.data.object !== "page") return NextResponse.json({ ok: true });

  for (const entry of parsed.data.entry) {
    const entryRouted = entry.id ? await getClientByPageAsset(entry.id) : null;
    const clientId = entryRouted?.clientId ?? routed.clientId;
    for (const messaging of entry.messaging ?? []) {
      const m = normalizeMessengerInbound(messaging);
      if (m) await recordInboundMessage(clientId, m, "MESSENGER");
    }
  }

  return NextResponse.json({ ok: true });
}
