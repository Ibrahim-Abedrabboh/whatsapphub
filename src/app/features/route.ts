import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /features — feature list (English). */
export async function GET() {
  return guidePage("FeatureList.html", "en");
}
