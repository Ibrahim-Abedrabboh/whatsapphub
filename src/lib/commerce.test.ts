import { describe, it, expect } from "vitest";
import { parseCatalogProducts, nextPageUrl, productListSections } from "./commerce";

const node = (over: Record<string, unknown> = {}) => ({
  id: "1234",
  retailer_id: "SKU-1",
  name: "Chocolate cake",
  price: "SAR 25.00",
  currency: "sar",
  image_url: "https://cdn.x/cake.jpg",
  availability: "in stock",
  ...over,
});

describe("parseCatalogProducts", () => {
  it("normalizes a full product node", () => {
    const [p] = parseCatalogProducts({ data: [node()] });
    expect(p).toMatchObject({
      retailerId: "SKU-1",
      name: "Chocolate cake",
      priceText: "SAR 25.00",
      currency: "SAR",
      imageUrl: "https://cdn.x/cake.jpg",
      availability: "in stock",
    });
  });
  it("nulls missing optional fields", () => {
    const [p] = parseCatalogProducts({ data: [{ retailer_id: "SKU-2", name: "Tea" }] });
    expect(p).toMatchObject({ retailerId: "SKU-2", name: "Tea", priceText: null, currency: null, imageUrl: null, availability: null });
  });
  it("drops nodes without a retailer id or name", () => {
    const out = parseCatalogProducts({ data: [node({ retailer_id: "" }), node({ name: undefined }), node({ retailer_id: "SKU-3" })] });
    expect(out.map((p) => p.retailerId)).toEqual(["SKU-3"]);
  });
  it("never throws on garbage", () => {
    expect(parseCatalogProducts(null)).toEqual([]);
    expect(parseCatalogProducts("nope")).toEqual([]);
    expect(parseCatalogProducts({ data: "not-an-array" })).toEqual([]);
    expect(parseCatalogProducts({ data: [null, 42, "x"] })).toEqual([]);
  });
});

describe("nextPageUrl", () => {
  it("returns the next page link", () => {
    expect(nextPageUrl({ paging: { next: "https://graph.facebook.com/v20.0/123/products?after=abc" } }))
      .toBe("https://graph.facebook.com/v20.0/123/products?after=abc");
  });
  it("returns null when paging is done or malformed", () => {
    expect(nextPageUrl({ paging: {} })).toBeNull();
    expect(nextPageUrl({})).toBeNull();
    expect(nextPageUrl({ paging: { next: "javascript:alert(1)" } })).toBeNull();
  });
});

describe("productListSections", () => {
  it("puts up to 10 products in one section", () => {
    const s = productListSections(["a", "b", "c"]);
    expect(s).toHaveLength(1);
    expect(s[0]!.product_items).toEqual([
      { product_retailer_id: "a" },
      { product_retailer_id: "b" },
      { product_retailer_id: "c" },
    ]);
  });
  it("chunks more than 10 into numbered sections", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `sku-${i}`);
    const s = productListSections(ids);
    expect(s.map((x) => x.product_items.length)).toEqual([10, 10, 5]);
    expect(s[1]!.title).toBe("Products 2");
  });
  it("dedupes, drops blanks, and hard-caps at 30", () => {
    const ids = ["a", "a", " ", ...Array.from({ length: 40 }, (_, i) => `sku-${i}`)];
    const s = productListSections(ids);
    const total = s.reduce((n, x) => n + x.product_items.length, 0);
    expect(total).toBe(30);
    expect(s.flatMap((x) => x.product_items.map((p) => p.product_retailer_id)).filter((id) => id === "a")).toHaveLength(1);
  });
  it("returns no sections for no ids", () => {
    expect(productListSections([])).toEqual([]);
  });
});
