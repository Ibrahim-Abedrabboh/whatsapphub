import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /connect/ar — channel connection checklist, opens in Arabic (RTL). */
export async function GET() {
  return guidePage("ConnectionChecklist.html", "ar");
}
