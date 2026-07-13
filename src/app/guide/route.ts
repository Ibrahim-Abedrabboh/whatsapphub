import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /guide — user guide (English). */
export async function GET() {
  return guidePage("USER-GUIDE.html", "en");
}
