import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /connect — channel connection checklist (English). */
export async function GET() {
  return guidePage("ConnectionChecklist.html", "en");
}
