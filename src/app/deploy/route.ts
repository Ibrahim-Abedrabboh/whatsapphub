import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** GET /deploy — serves the self-hosting guide (public/SelfHosting.html) at a
 *  clean URL. Public (allowlisted in middleware); intentionally unlinked. */
export async function GET() {
  const html = await readFile(join(process.cwd(), "public", "SelfHosting.html"), "utf8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
