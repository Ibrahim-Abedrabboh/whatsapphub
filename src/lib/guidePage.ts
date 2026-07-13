import { readFile } from "fs/promises";
import { join } from "path";

/** Serve a bilingual guide from /public at a clean route. For the Arabic
 *  variant (…/ar) we flip the root <html> to lang="ar" dir="rtl" server-side,
 *  so the page opens in Arabic with no flash and no JS required. */
export async function guidePage(file: string, lang: "en" | "ar" = "en"): Promise<Response> {
  let html = await readFile(join(process.cwd(), "public", file), "utf8");
  if (lang === "ar") html = html.replace('<html lang="en">', '<html lang="ar" dir="rtl">');
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
