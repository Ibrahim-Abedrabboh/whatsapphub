import { NextRequest, NextResponse } from "next/server";
import { getClientByInstagramAsset, isInstagramVerifyToken } from "@/lib/igConfig";
import { InstagramWebhookSchema } from "@/lib/validation";
import { verifyWebhookSignature } from "@/lib/webhookSig";
import { recordInboundMessage } from "@/lib/conversations";
import { normalizeInstagramInbound } from "@/lib/channels/instagram";

export const runtime = "nodejs";

/** GET — Meta webhook verification handshake for Instagram (object=instagram). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && (await isInstagramVerifyToken(p.get("hub.verify_token") ?? ""))) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * POST — inbound Instagram DMs. Signature-verified per client. Dark until a
 * ChannelConnection(channel="INSTAGRAM") exists: with no connection, the asset
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
  const routed = assetId ? await getClientByInstagramAsset(String(assetId)) : null;
  if (!routed) return NextResponse.json({ ok: true }); // not connected → ack & ignore
  if (!verifyWebhookSignature(routed.appSecret, raw, sig)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const parsed = InstagramWebhookSchema.safeParse(JSON.parse(raw));
  if (!parsed.success || parsed.data.object !== "instagram") return NextResponse.json({ ok: true });

  for (const entry of parsed.data.entry) {
    const entryRouted = entry.id ? await getClientByInstagramAsset(entry.id) : null;
    const clientId = entryRouted?.clientId ?? routed.clientId;
    for (const messaging of entry.messaging ?? []) {
      const m = normalizeInstagramInbound(messaging);
      if (m) await recordInboundMessage(clientId, m, "INSTAGRAM");
    }
  }

  return NextResponse.json({ ok: true });
}
