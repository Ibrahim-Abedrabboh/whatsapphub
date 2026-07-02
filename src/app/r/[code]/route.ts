import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeContactRef } from "@/lib/shortLinks";

export const runtime = "nodejs";

/**
 * GET /r/:code[?c=<contactId>] — public tracked-link redirect (V2 M4 §2.9).
 * Resolves the short link, logs a LinkClick (best-effort — a logging failure
 * must never block the redirect), and 302s to the stored target URL.
 * Unauthenticated by design: middleware exempts "/r/".
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^[a-zA-Z0-9]{4,32}$/.test(code)) return new NextResponse("Not found", { status: 404 });

  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) return new NextResponse("Not found", { status: 404 });

  const contactId = sanitizeContactRef(req.nextUrl.searchParams.get("c"));
  try {
    await prisma.linkClick.create({ data: { shortLinkId: link.id, contactId } });
  } catch {
    // best-effort — never block the redirect
  }

  return NextResponse.redirect(link.targetUrl, 302);
}
