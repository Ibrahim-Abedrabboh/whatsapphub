import { NextRequest, NextResponse } from "next/server";
import { getClientId } from "@/lib/users";
import { TranslateSchema } from "@/lib/validation";
import { isAiConfigured, translateText, AiNotConfiguredError } from "@/lib/ai";

export const runtime = "nodejs";

/** POST /api/conversations/:id/ai/translate — translate a message body to AR or EN.
 *  (Conversation id keeps it tenant-scoped + consistent with the other AI routes.) */
export async function POST(req: NextRequest) {
  if (!isAiConfigured()) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  await getClientId(req); // ensure the caller is authenticated/tenant-resolved

  const parsed = TranslateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  try {
    const translation = await translateText(parsed.data.text, parsed.data.target);
    return NextResponse.json({ translation });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}
