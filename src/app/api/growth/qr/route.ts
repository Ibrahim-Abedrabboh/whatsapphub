import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

/** GET /api/growth/qr?data=<text> — public Opal-themed SVG QR (charcoal on cream).
 *  Stateless generator (no data access) — used by both the app /growth page and
 *  the public landing tool, so it stays outside auth. */
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data") ?? "";
  if (!data || data.length > 2000) return NextResponse.json({ error: "invalid data" }, { status: 400 });

  try {
    const svg = await QRCode.toString(data, {
      type: "svg",
      margin: 1,
      width: 320,
      color: { dark: "#2C2C2C", light: "#FFFCF3" },
    });
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "qr generation failed" }, { status: 500 });
  }
}
