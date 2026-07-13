import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /guide/ar — user guide, opens in Arabic (RTL). */
export async function GET() {
  return guidePage("USER-GUIDE.html", "ar");
}
