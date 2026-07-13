import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /deploy/ar — self-hosting guide, opens in Arabic (RTL). */
export async function GET() {
  return guidePage("SelfHosting.html", "ar");
}
