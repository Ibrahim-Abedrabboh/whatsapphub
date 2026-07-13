import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /features/ar — feature list, opens in Arabic (RTL). */
export async function GET() {
  return guidePage("FeatureList.html", "ar");
}
