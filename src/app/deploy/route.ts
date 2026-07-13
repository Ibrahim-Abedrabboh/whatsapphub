import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /deploy — self-hosting guide (English). Public, intentionally unlinked. */
export async function GET() {
  return guidePage("SelfHosting.html", "en");
}
