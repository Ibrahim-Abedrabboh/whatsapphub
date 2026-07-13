import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ACCESS_COOKIE } from "@/lib/auth";

// Public paths that must NOT require auth. "/r/" is the tracked-link redirect
// (V2 M4 §2.9) — trailing slash matters: a bare "/r" prefix would over-match.
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/webhooks", "/api/health", "/api/leads", "/r/", "/api/growth/qr",
  "/deploy", "/guide", "/features", "/connect", "/ar/"];
// Public exact paths (prefix match would over-match, e.g. "/" matches everything).
const PUBLIC_EXACT = new Set(["/", "/deploy", "/chatbots", "/contacts-template.csv", "/tutorial.html", "/USER-GUIDE.html", "/FeatureList.html", "/ConnectionChecklist.html", "/SelfHosting.html"]);

// Edge runtime: verifies ONLY the short-lived (15m) access token. No Redis here,
// so refresh/rotation/revocation live in /api/auth/refresh (Node). When the
// access token has expired:
//   • API calls → 401; the client `apiFetch` wrapper refreshes + retries.
//   • Page navs → redirect to /login, which silently refreshes on mount and
//     forwards to `next` (seamless unless the session was actually revoked).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (claims) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
