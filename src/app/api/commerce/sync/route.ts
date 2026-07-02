import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { getWaConfig } from "@/lib/waConfig";
import { parseCatalogProducts, nextPageUrl } from "@/lib/commerce";

export const runtime = "nodejs";

const FIELDS = "retailer_id,name,price,currency,image_url,availability";
const MAX_PAGES = 20; // 20 × 100 products — plenty for current tenants, bounded on purpose

/**
 * POST /api/commerce/sync — pull the connected Meta catalog's products into
 * the local Product table (upsert by retailerId; stale rows are removed so
 * the picker never offers a deleted product).
 */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);

  const catalog = await prisma.commerceCatalog.findUnique({ where: { clientId } });
  if (!catalog) return NextResponse.json({ error: "connect a catalog first (Settings → Commerce)" }, { status: 422 });

  const cfg = await getWaConfig(clientId);
  if (!cfg.accessToken) return NextResponse.json({ error: "no WhatsApp access token configured" }, { status: 422 });

  // Page through the catalog, surfacing Graph errors verbatim so a wrong
  // catalog id / missing permission is diagnosable from the UI.
  const products = [];
  let url: string | null =
    `https://graph.facebook.com/${cfg.graphApiVersion}/${catalog.metaCatalogId}/products?fields=${FIELDS}&limit=100`;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } } | null)?.error?.message ?? `Graph responded ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    products.push(...parseCatalogProducts(json));
    url = nextPageUrl(json);
  }

  // Upsert current products, then drop rows that vanished from the catalog.
  for (const p of products) {
    const raw = p.raw as Prisma.InputJsonValue;
    await prisma.product.upsert({
      where: { clientId_retailerId: { clientId, retailerId: p.retailerId } },
      create: { clientId, retailerId: p.retailerId, name: p.name, priceText: p.priceText, currency: p.currency, imageUrl: p.imageUrl, availability: p.availability, raw },
      update: { name: p.name, priceText: p.priceText, currency: p.currency, imageUrl: p.imageUrl, availability: p.availability, raw },
    });
  }
  const removed = await prisma.product.deleteMany({
    where: { clientId, retailerId: { notIn: products.map((p) => p.retailerId) } },
  });

  await prisma.commerceCatalog.update({ where: { clientId }, data: { lastSyncedAt: new Date() } });

  return NextResponse.json({ synced: products.length, removed: removed.count });
}
