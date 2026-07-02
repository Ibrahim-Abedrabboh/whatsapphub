import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { CommerceCatalogSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** GET /api/commerce/catalog — the client's catalog connection + sync state. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const clientId = await getClientId(req);

  const [catalog, productCount] = await Promise.all([
    prisma.commerceCatalog.findUnique({ where: { clientId } }),
    prisma.product.count({ where: { clientId } }),
  ]);

  return NextResponse.json({
    catalog: catalog
      ? { metaCatalogId: catalog.metaCatalogId, name: catalog.name, lastSyncedAt: catalog.lastSyncedAt }
      : null,
    productCount,
  });
}

/** PUT /api/commerce/catalog — connect (or change) the Meta catalog id. */
export async function PUT(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CommerceCatalogSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const clientId = await getClientId(req);

  const catalog = await prisma.commerceCatalog.upsert({
    where: { clientId },
    create: { clientId, metaCatalogId: parsed.data.metaCatalogId },
    // Changing the catalog id resets the sync stamp — the products table
    // still holds the old catalog's rows until the next sync replaces them.
    update: { metaCatalogId: parsed.data.metaCatalogId, lastSyncedAt: null },
  });

  return NextResponse.json({ catalog: { metaCatalogId: catalog.metaCatalogId, name: catalog.name, lastSyncedAt: catalog.lastSyncedAt } });
}
