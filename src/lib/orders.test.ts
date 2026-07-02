import { describe, it, expect } from "vitest";
import { parseOrderMessage, orderPreview, canTransition, statusNotification, ORDER_STATUSES } from "./orders";

describe("parseOrderMessage", () => {
  it("parses a multi-item order with totals", () => {
    const o = parseOrderMessage({
      catalog_id: "123",
      product_items: [
        { product_retailer_id: "SKU-1", quantity: 2, item_price: 25, currency: "SAR" },
        { product_retailer_id: "SKU-2", quantity: 1, item_price: 10.5, currency: "SAR" },
      ],
    });
    expect(o).toMatchObject({ catalogId: "123", itemCount: 3, total: 60.5, currency: "SAR" });
    expect(o!.items).toHaveLength(2);
  });
  it("accepts string quantities/prices (Meta sometimes sends strings)", () => {
    const o = parseOrderMessage({ product_items: [{ product_retailer_id: "S", quantity: "3", item_price: "9.99" }] });
    expect(o).toMatchObject({ itemCount: 3, total: 29.97 });
  });
  it("defaults quantity to 1 and nulls the total when a price is unknown", () => {
    const o = parseOrderMessage({
      product_items: [
        { product_retailer_id: "A", item_price: 5 },
        { product_retailer_id: "B", quantity: 2 }, // no price
      ],
    });
    expect(o).toMatchObject({ itemCount: 3, total: null });
  });
  it("drops items without a retailer id; null when nothing usable", () => {
    expect(parseOrderMessage({ product_items: [{ quantity: 2 }] })).toBeNull();
    expect(parseOrderMessage({ product_items: [] })).toBeNull();
    expect(parseOrderMessage(null)).toBeNull();
    expect(parseOrderMessage({})).toBeNull();
  });
  it("never produces negative or fractional quantities", () => {
    const o = parseOrderMessage({ product_items: [{ product_retailer_id: "A", quantity: -3, item_price: 2 }] });
    expect(o!.items[0]!.quantity).toBe(1);
  });
});

describe("orderPreview", () => {
  it("includes the amount when known", () => {
    expect(orderPreview({ itemCount: 3, total: 60.5, currency: "SAR" })).toBe("🛒 Order: 3 items — SAR 60.50");
  });
  it("singular item, no amount when total unknown", () => {
    expect(orderPreview({ itemCount: 1, total: null, currency: null })).toBe("🛒 Order: 1 item");
  });
});

describe("canTransition", () => {
  it("allows the happy path NEW → CONFIRMED → SHIPPED → DELIVERED", () => {
    expect(canTransition("NEW", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });
  it("allows cancellation before shipping only", () => {
    expect(canTransition("NEW", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
  });
  it("rejects skips, reversals, no-ops, and unknown statuses", () => {
    expect(canTransition("NEW", "SHIPPED")).toBe(false);
    expect(canTransition("DELIVERED", "NEW")).toBe(false);
    expect(canTransition("NEW", "NEW")).toBe(false);
    expect(canTransition("WAT", "CONFIRMED")).toBe(false);
    expect(canTransition("NEW", "WAT")).toBe(false);
  });
});

describe("statusNotification", () => {
  it("has a bilingual message for every non-NEW status", () => {
    for (const s of ORDER_STATUSES.filter((x) => x !== "NEW")) {
      expect(statusNotification(s)).toMatch(/\//); // EN / AR separator
    }
  });
});
