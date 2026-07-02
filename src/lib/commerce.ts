// Commerce (V2 M5 §2.10). Pure logic — no DB/network — so parsing and payload
// chunking are unit-testable. The sync API feeds Graph's
// GET /{catalogId}/products response through parseCatalogProducts.

export interface CatalogProduct {
  retailerId: string;
  name: string;
  priceText: string | null;
  currency: string | null;
  imageUrl: string | null;
  availability: string | null;
  raw: Record<string, unknown>;
}

/**
 * Normalize one page of Graph catalog products. Tolerant: nodes without a
 * retailer_id or name are dropped (they can't be messaged or ordered), other
 * missing fields become null. Never throws on a malformed payload.
 */
export function parseCatalogProducts(graphResponse: unknown): CatalogProduct[] {
  const data = (graphResponse as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];

  const products: CatalogProduct[] = [];
  for (const node of data) {
    if (node === null || typeof node !== "object") continue;
    const r = node as Record<string, unknown>;
    const retailerId = typeof r.retailer_id === "string" ? r.retailer_id.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!retailerId || !name) continue;
    products.push({
      retailerId,
      name,
      priceText: typeof r.price === "string" && r.price.trim() ? r.price.trim() : null,
      currency: typeof r.currency === "string" && r.currency.trim() ? r.currency.trim().toUpperCase() : null,
      imageUrl: typeof r.image_url === "string" && r.image_url.trim() ? r.image_url.trim() : null,
      availability: typeof r.availability === "string" && r.availability.trim() ? r.availability.trim() : null,
      raw: r,
    });
  }
  return products;
}

/** Next page URL from a Graph paged response (null when done). */
export function nextPageUrl(graphResponse: unknown): string | null {
  const next = (graphResponse as { paging?: { next?: unknown } } | null)?.paging?.next;
  return typeof next === "string" && next.startsWith("https://") ? next : null;
}

export interface ProductListSection {
  title: string;
  product_items: { product_retailer_id: string }[];
}

/**
 * Chunk retailer ids into the sections shape of a WhatsApp product_list
 * message. Meta limits: ≤10 sections, ≤30 products total. Excess ids are
 * dropped (callers cap selection in the UI; this is the hard backstop).
 */
export function productListSections(retailerIds: string[], title = "Products"): ProductListSection[] {
  const ids = [...new Set(retailerIds.filter((id) => id.trim()))].slice(0, 30);
  const sections: ProductListSection[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    sections.push({
      title: sections.length === 0 && ids.length <= 10 ? title : `${title} ${sections.length + 1}`,
      product_items: chunk.map((id) => ({ product_retailer_id: id })),
    });
  }
  return sections;
}
