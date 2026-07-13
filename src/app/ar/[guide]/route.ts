import { guidePage } from "@/lib/guidePage";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Arabic variants live under /ar/* (e.g. /ar/deploy) so the language shows
// right after the domain. Each maps to the same public HTML, served in Arabic.
const FILES: Record<string, string> = {
  deploy: "SelfHosting.html",
  guide: "USER-GUIDE.html",
  features: "FeatureList.html",
  connect: "ConnectionChecklist.html",
};

export function generateStaticParams() {
  return Object.keys(FILES).map((guide) => ({ guide }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ guide: string }> }) {
  const { guide } = await ctx.params;
  const file = FILES[guide];
  if (!file) return new Response("Not found", { status: 404 });
  return guidePage(file, "ar");
}
