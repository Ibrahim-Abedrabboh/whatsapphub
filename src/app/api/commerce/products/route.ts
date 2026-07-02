import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** GET /api/commerce/products — the client's synced products, alphabetical. */
export async function GET(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const products = await prisma.product.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { name: "asc" },
    select: { id: true, retailerId: true, name: true, priceText: true, currency: true, imageUrl: true, availability: true },
  });
  return NextResponse.json({ products });
}
